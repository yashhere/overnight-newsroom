// ---------------------------------------------------------------------------
// Enricher — long-running Node loop under systemd
// Claims pending clusters, calls Hermes, writes enrichment to Convex.
// Capped at 30 enrichments per hour (rolling window).
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import {
  claimPending,
  saveEnrichment,
  markThin,
  logIngestionEvent,
} from "./convex.js";
import { callHermes } from "./hermes.js";
import { buildCostEstimate } from "./cost.js";
import type { StoryBundle, HermesResponse } from "./types.js";

const POLL_INTERVAL_MS = Number(process.env.ENRICHER_POLL_INTERVAL_MS || "60000");
const MAX_PER_HOUR = Number(process.env.ENRICHER_MAX_PER_HOUR || "30");
const CLAIM_MAX = Number(process.env.ENRICHER_CLAIM_MAX || "3");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildStoryBundle(cluster: any): StoryBundle {
  return {
    leadTitle: cluster.leadTitle || "",
    alternateHeadlines: cluster.alternateHeadlines || [],
    outletNames: cluster.outletNames || [],
    googleNewsUrl: cluster.googleNewsUrl || "",
    beats: cluster.beats || [],
  };
}

function getHermesBaseUrlHost(): string {
  const rawBaseUrl = process.env.HERMES_BASE_URL;
  if (!rawBaseUrl) return "localhost";
  try {
    return new URL(rawBaseUrl).host;
  } catch {
    return "invalid-hermes-base-url";
  }
}

async function logEventSafely(args: Parameters<typeof logIngestionEvent>[0]) {
  try {
    await logIngestionEvent(args);
  } catch {
    // Observability is important, but should not crash the enrichment loop.
  }
}

async function main() {
  console.log("[enricher] Starting enrichment loop");

  // Rolling timestamps of enrichments in the last hour
  const hourlyTimestamps: number[] = [];

  let running = true;

  process.on("SIGTERM", () => {
    console.log("[enricher] SIGTERM received, shutting down");
    running = false;
  });

  process.on("SIGINT", () => {
    console.log("[enricher] SIGINT received, shutting down");
    running = false;
  });

  while (running) {
    const now = Date.now();

    // Prune stale timestamps (older than 1 hour)
    while (
      hourlyTimestamps.length > 0 &&
      hourlyTimestamps[0] < now - 3600_000
    ) {
      hourlyTimestamps.shift();
    }

    // Check if we're at the hourly cap
    if (hourlyTimestamps.length >= MAX_PER_HOUR) {
      console.log(
        `[enricher] Hourly cap reached (${MAX_PER_HOUR}), waiting...`
      );
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Calculate how many we can claim
    const available = Math.min(
      CLAIM_MAX,
      MAX_PER_HOUR - hourlyTimestamps.length
    );

    if (available <= 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Claim pending clusters from Convex
    let claimed: any[];
    try {
      claimed = await claimPending({ max: available, now });
    } catch (err: any) {
      console.error(
        `[enricher] Failed to claim pending clusters: ${err?.message || err}`
      );
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (!claimed || claimed.length === 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(
      `[enricher] Claimed ${claimed.length} clusters for enrichment`
    );

    // Process each claimed cluster sequentially
    for (const cluster of claimed) {
      if (!running) break;

      const callId = randomUUID();
      const hermesCallStartedAt = Date.now();
      const model = process.env.HERMES_MODEL || "hermes-agent";
      const promptVersion =
        process.env.SUMMARY_PROMPT_VERSION || "rss-summary-v1";
      const baseUrlHost = getHermesBaseUrlHost();

      console.log(
        `[enricher] Enriching cluster ${cluster._id}: "${cluster.leadTitle}"`
      );

      // Call Hermes
      const bundle = buildStoryBundle(cluster);
      await logEventSafely({
        eventId: `${callId}-attempt`,
        clusterId: cluster._id,
        hermesCallId: callId,
        family: "enrichment",
        type: "enrich_attempt",
        severity: "info",
        message: `Starting Hermes enrichment for cluster ${cluster._id}`,
        dataRedacted: JSON.stringify({
          model,
          promptVersion,
          leadTitle: cluster.leadTitle?.slice(0, 140),
          googleNewsUrlPresent: Boolean(bundle.googleNewsUrl),
          outletCount: bundle.outletNames.length,
          beatCount: bundle.beats.length,
        }),
        createdAt: Date.now(),
      });
      const result = await callHermes(bundle);

      const hermesCallFinishedAt = Date.now();
      const latencyMs = hermesCallFinishedAt - hermesCallStartedAt;

      // Build request summary (redacted — no secrets)
      const requestSummary = JSON.stringify({
        leadTitle: cluster.leadTitle?.slice(0, 100),
        beatCount: cluster.beats?.length ?? 0,
      });

      if (result.status === "success" && result.response) {
        const resp: HermesResponse = result.response;

        // Build cost estimate
        const cost = buildCostEstimate(
          result.usage,
          JSON.stringify({
            system: "[system prompt redacted]",
            user: JSON.stringify(bundle),
          }),
          JSON.stringify(resp)
        );

        await logEventSafely({
          eventId: `${callId}-cost`,
          clusterId: cluster._id,
          hermesCallId: callId,
          family: "cost",
          type: "hermes_cost_estimated",
          severity: "debug",
          message: `Hermes enrichment cost recorded for cluster ${cluster._id}`,
          dataRedacted: JSON.stringify({
            status: result.status,
            latencyMs,
            inputTokens: cost.inputTokens,
            outputTokens: cost.outputTokens,
            totalTokens: cost.totalTokens,
            usageSource: cost.usageSource,
            estimatedCostCents: cost.estimatedCostCents,
          }),
          createdAt: Date.now(),
        });

        // Determine if we should accept or mark thin based on confidence
        if (resp.confidence >= 0.3) {
          // Extract best source for canonical URL
          let canonicalPublisherUrl: string | undefined;
          let extractionConfidence: number | undefined;
          if (resp.sources && resp.sources.length > 0) {
            const bestSource = resp.sources.reduce((best, s) =>
              s.confidence > (best?.confidence ?? 0) ? s : best
            );
            canonicalPublisherUrl = bestSource.url;
            extractionConfidence = bestSource.confidence;
          }

          try {
            await saveEnrichment({
              clusterId: cluster._id,
              callId,
              summaryBullets: resp.summaryBullets,
              whyItMatters: resp.whyItMatters,
              suggestedBeat: resp.suggestedBeat,
              confidence: resp.confidence,
              missingContext: resp.missingContext,
              canonicalPublisherUrl,
              extractionConfidence,
              summaryPromptVersion: promptVersion,
              hermesCallStartedAt,
              hermesCallFinishedAt,
              hermesCallLatencyMs: latencyMs,
              hermesCallHttpStatus: result.httpStatus ?? 200,
              hermesCallModel: model,
              hermesCallPromptVersion: promptVersion,
              hermesCallBaseUrlHost: baseUrlHost,
              hermesCallInputTokens: cost.inputTokens,
              hermesCallOutputTokens: cost.outputTokens,
              hermesCallTotalTokens: cost.totalTokens,
              hermesCallUsageSource: cost.usageSource,
              hermesCallEstimatedCostCents: cost.estimatedCostCents,
              hermesCallRequestSummary: requestSummary,
              hermesCallResponseSummary: JSON.stringify(
                resp.summaryBullets
              ).slice(0, 500),
            });

            console.log(
              `[enricher] Enriched ${cluster._id} — confidence ${resp.confidence.toFixed(2)}, cost ${cost.estimatedCostCents}c`
            );
          } catch (err: any) {
            console.error(
              `[enricher] Failed to save enrichment for ${cluster._id}: ${err?.message || err}`
            );
          }
        } else {
          // Low confidence → mark thin
          try {
            await markThin({
              clusterId: cluster._id,
              callId,
              reason: `Low confidence: ${resp.confidence}`,
              hermesCallStatus: "failed",
              hermesCallStartedAt,
              hermesCallFinishedAt,
              hermesCallLatencyMs: latencyMs,
              hermesCallHttpStatus: result.httpStatus ?? 200,
              hermesCallModel: model,
              hermesCallPromptVersion: promptVersion,
              hermesCallBaseUrlHost: baseUrlHost,
              hermesCallInputTokens: cost.inputTokens,
              hermesCallOutputTokens: cost.outputTokens,
              hermesCallTotalTokens: cost.totalTokens,
              hermesCallUsageSource: cost.usageSource,
              hermesCallEstimatedCostCents: cost.estimatedCostCents,
              hermesCallRequestSummary: requestSummary,
              hermesCallResponseSummary:
                resp.summaryBullets.length === 0
                  ? "empty (could not read enough)"
                  : JSON.stringify(resp.summaryBullets).slice(0, 500),
            });

            console.log(
              `[enricher] Marked ${cluster._id} thin — confidence ${resp.confidence.toFixed(2)}`
            );
          } catch (err: any) {
            console.error(
              `[enricher] Failed to mark thin for ${cluster._id}: ${err?.message || err}`
            );
          }
        }
      } else {
        // Hermes call failed (timeout, parse_error, or failed)
        const hermesCallStatus =
          result.status === "timeout"
            ? "timeout"
            : result.status === "parse_error"
              ? "parse_error"
              : "failed";

        // Estimate cost from what we have (may be partial)
        const cost = buildCostEstimate(
          result.usage,
          JSON.stringify({
            system: "[system prompt redacted]",
            user: JSON.stringify(bundle),
          }),
          result.error || ""
        );

        await logEventSafely({
          eventId: `${callId}-cost`,
          clusterId: cluster._id,
          hermesCallId: callId,
          family: "cost",
          type: "hermes_cost_estimated",
          severity: "debug",
          message: `Hermes enrichment cost recorded for cluster ${cluster._id}`,
          dataRedacted: JSON.stringify({
            status: result.status,
            latencyMs,
            inputTokens: cost.inputTokens,
            outputTokens: cost.outputTokens,
            totalTokens: cost.totalTokens,
            usageSource: cost.usageSource,
            estimatedCostCents: cost.estimatedCostCents,
          }),
          createdAt: Date.now(),
        });

        try {
          await markThin({
            clusterId: cluster._id,
            callId,
            reason: result.error || result.status,
            hermesCallStatus,
            hermesCallStartedAt,
            hermesCallFinishedAt,
            hermesCallLatencyMs: latencyMs,
            hermesCallHttpStatus: result.httpStatus,
            hermesCallModel: model,
            hermesCallPromptVersion: promptVersion,
            hermesCallBaseUrlHost: baseUrlHost,
            hermesCallInputTokens: cost.inputTokens,
            hermesCallOutputTokens: cost.outputTokens,
            hermesCallTotalTokens: cost.totalTokens,
            hermesCallUsageSource: cost.usageSource,
            hermesCallEstimatedCostCents: cost.estimatedCostCents,
            hermesCallRequestSummary: requestSummary,
            hermesCallResponseSummary: result.error?.slice(0, 500),
            hermesCallErrorClass: result.status,
            hermesCallErrorMessage: result.error?.slice(0, 500),
          });

          console.log(
            `[enricher] Marked ${cluster._id} thin — ${result.status}: ${result.error?.slice(0, 100)}`
          );
        } catch (err: any) {
          console.error(
            `[enricher] Failed to mark thin for ${cluster._id}: ${err?.message || err}`
          );
        }
      }

      // Record the enrichment timestamp for hourly cap
      hourlyTimestamps.push(Date.now());
    }
  }

  console.log("[enricher] Enrichment loop exited");
  process.exit(0);
}

main().catch((err) => {
  console.error("[enricher] Fatal error:", err?.message || err);
  process.exit(1);
});
