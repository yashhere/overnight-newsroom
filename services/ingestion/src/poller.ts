// ---------------------------------------------------------------------------
// Poller — one-shot Node script triggered by systemd timer
// Fetches all configured Google News RSS feeds, parses, dedupes,
// and writes clusters + receipts to Convex.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { FEEDS } from "./feeds.js";
import { parseRss, extractCluster } from "./googleNews.js";
import {
  startIngestionRun,
  finishIngestionRun,
  ingestClusters,
  logIngestionEvent,
} from "./convex.js";
import type { CandidateCluster, FeedFetchOutcome } from "./types.js";

const USER_AGENT = "OvernightNewsroom/1.0 (buildathon)";
const SERVICE_VERSION = "1.0.0";
const ALLOWED_FEED_HOSTS = new Set(["news.google.com"]);

function getAllowedFeedUrl(feedUrl: string): URL {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error(`Invalid feed URL: ${feedUrl}`);
  }
  if (url.protocol !== "https:" || !ALLOWED_FEED_HOSTS.has(url.hostname)) {
    throw new Error(`Blocked non-allowlisted feed URL: ${feedUrl}`);
  }
  return url;
}

async function fetchFeed(
  feed: (typeof FEEDS)[number]
): Promise<FeedFetchOutcome> {
  const start = Date.now();
  try {
    const feedUrl = getAllowedFeedUrl(feed.url);
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    const xml = await res.text();
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        status: "error",
        feed,
        error: `HTTP ${res.status}: ${res.statusText}`,
        errorClass: "http_error",
        latencyMs,
        httpCode: res.status,
      };
    }

    const items = parseRss(xml);
    const retrievedAt = Date.now();
    const candidates: CandidateCluster[] = [];

    for (const item of items) {
      try {
        const cluster = extractCluster(
          item,
          feed.beat,
          feed.url,
          retrievedAt
        );
        candidates.push(cluster);
      } catch {
        // Skip items that can't be parsed into clusters
      }
    }

    return {
      status: "ok",
      feed,
      httpCode: res.status,
      byteCount: xml.length,
      latencyMs,
      itemCount: items.length,
      candidates,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      status: "error",
      feed,
      error: err?.message || String(err),
      errorClass: "fetch_error",
      latencyMs,
    };
  }
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  console.log(`[poller] Starting run ${runId} at ${new Date(startedAt).toISOString()}`);

  // 1. Start the ingestion run
  try {
    await startIngestionRun({
      runId,
      trigger: "scheduled",
      serviceVersion: SERVICE_VERSION,
      feedCount: FEEDS.length,
      startedAt,
    });
  } catch (err: any) {
    console.error(`[poller] Failed to start ingestion run: ${err?.message || err}`);
    process.exit(1);
  }

  // 2. Fetch all feeds concurrently
  const outcomes = await Promise.allSettled(
    FEEDS.map((feed) => fetchFeed(feed))
  );

  const feedOutcomes: FeedFetchOutcome[] = [];
  for (const result of outcomes) {
    if (result.status === "fulfilled") {
      feedOutcomes.push(result.value);
    } else {
      // Promise rejected (unexpected)
      feedOutcomes.push({
        status: "error",
        feed: { url: "unknown", beat: "unknown" },
        error: result.reason?.message || String(result.reason),
        errorClass: "promise_rejection",
        latencyMs: 0,
      });
    }
  }

  // 3. Log feed events and aggregate
  let feedsSucceeded = 0;
  let feedsFailed = 0;
  let totalItems = 0;
  const allCandidates: CandidateCluster[] = [];
  const errors: string[] = [];

  for (const outcome of feedOutcomes) {
    if (outcome.status === "ok") {
      feedsSucceeded++;
      totalItems += outcome.itemCount;
      allCandidates.push(...outcome.candidates);

      // Log success event
      try {
        await logIngestionEvent({
          eventId: randomUUID(),
          runId,
          family: "ingestion",
          type: "feed_fetch",
          severity: "debug",
          message: `Feed ${outcome.feed.beat} OK: ${outcome.itemCount} items, ${outcome.latencyMs}ms`,
          dataRedacted: JSON.stringify({
            status: "success",
            beat: outcome.feed.beat,
            feedUrl: outcome.feed.url,
            httpCode: outcome.httpCode,
            byteCount: outcome.byteCount,
            latencyMs: outcome.latencyMs,
            itemCount: outcome.itemCount,
          }),
          createdAt: Date.now(),
        });
      } catch {
        // Event logging is best-effort
      }
    } else {
      feedsFailed++;
      errors.push(
        `[${outcome.feed.beat}] ${outcome.error}`
      );

      // Log error event
      try {
        await logIngestionEvent({
          eventId: randomUUID(),
          runId,
          family: "ingestion",
          type: "feed_fetch",
          severity: "error",
          message: `Feed ${outcome.feed.beat} FAILED: ${outcome.error}`,
          dataRedacted: JSON.stringify({
            status: "failed",
            beat: outcome.feed.beat,
            feedUrl: outcome.feed.url,
            httpCode: outcome.httpCode,
            latencyMs: outcome.latencyMs,
            itemCount: 0,
            errorClass: outcome.errorClass,
          }),
          createdAt: Date.now(),
        });
      } catch {
        // Event logging is best-effort
      }
    }
  }

  // 4. Count duplicate hashes for observability, but do not drop candidate
  // sightings. Convex receives every candidate so it can upsert the cluster and
  // insert one clusterReceipt per RSS sighting/cross-feed occurrence.
  const uniqueHashes = new Set(allCandidates.map((candidate) => candidate.titleHash));
  const duplicatesSkipped = allCandidates.length - uniqueHashes.size;

  // 5. Upsert clusters + receipts in Convex
  let clustersCreated = 0;
  let clustersUpdated = 0;

  if (allCandidates.length > 0) {
    // Batch into chunks of 20 to stay under Convex arg size limits
    const BATCH_SIZE = 20;
    for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
      const batch = allCandidates.slice(i, i + BATCH_SIZE);
      try {
        const result = await ingestClusters({
          runId,
          clusters: batch.map((c) => ({
            titleHash: c.titleHash,
            leadTitle: c.leadTitle,
            normalizedTitle: c.normalizedTitle,
            alternateHeadlines: c.alternateHeadlines,
            outletNames: c.outletNames,
            outletCount: c.outletCount,
            beat: c.beat,
            language: c.language,
            country: c.country,
            publishedAt: c.publishedAt,
            feedUrl: c.feedUrl,
            googleNewsUrl: c.googleNewsUrl,
            rssGuid: c.rssGuid,
            rssPublishedAt: c.rssPublishedAt,
            rssTitle: c.rssTitle,
            rssDescriptionText: c.rssDescriptionText,
            retrievedAt: c.retrievedAt,
          })),
        });
        clustersCreated += (result as any).created ?? 0;
        clustersUpdated += (result as any).updated ?? 0;
      } catch (err: any) {
        console.error(
          `[poller] Failed to ingest batch ${i}: ${err?.message || err}`
        );
        errors.push(`Cluster ingestion error: ${err?.message || err}`);
      }
    }
  }

  // 6. Finish the run
  const runStatus =
    feedsFailed === FEEDS.length
      ? "failed"
      : feedsFailed > 0
        ? "partial"
        : "success";

  try {
    await finishIngestionRun({
      runId,
      status: runStatus,
      feedsSucceeded,
      feedsFailed,
      itemsSeen: totalItems,
      clustersCreated,
      clustersUpdated,
      duplicatesSkipped,
      errorSummary: errors.length > 0 ? errors.join("; ") : undefined,
    });
  } catch (err: any) {
    console.error(
      `[poller] Failed to finish run: ${err?.message || err}`
    );
    process.exit(1);
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[poller] Run ${runId} complete: ${runStatus} — ` +
      `${clustersCreated} created, ${clustersUpdated} updated, ` +
      `${duplicatesSkipped} dupes, ${elapsed}ms`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("[poller] Fatal error:", err?.message || err);
  process.exit(1);
});
