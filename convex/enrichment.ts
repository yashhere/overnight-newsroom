import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

// ---------------------------------------------------------------------------
// Secret check
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ---------------------------------------------------------------------------
// claimPending
//
// 1. Reclaim stuck clusters: claimedAt older than 5 minutes → back to pending
// 2. Claim up to max pending clusters → flip to claimed
// 3. Return the claimed cluster documents
// ---------------------------------------------------------------------------
export const claimPending = mutation({
  args: {
    secret: v.string(),
    max: v.number(),         // max clusters to claim (e.g., 3)
    now: v.number(),         // client-provided timestamp for deterministic reclaim
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const fiveMinutesAgo = args.now - 5 * 60 * 1000;

    // 1. Reclaim stuck clusters: query all "claimed" and filter in-memory
    //    (Convex indexes don't support inequality on non-indexed fields,
    //     but the "claimed" set is small enough for in-memory filtering)
    const stuckDocs = await ctx.db
      .query("storyClusters")
      .withIndex("by_summaryStatus_lastSeenAt", (q) =>
        q.eq("summaryStatus", "claimed")
      )
      .collect();

    for (const doc of stuckDocs) {
      if (doc.claimedAt !== undefined && doc.claimedAt < fiveMinutesAgo) {
        await ctx.db.patch(doc._id, {
          summaryStatus: "pending",
          claimedAt: undefined,
          updatedAt: args.now,
        });
      }
    }

    // 2. Find pending clusters, ordered by lastSeenAt descending (freshest first)
    const pendingDocs = await ctx.db
      .query("storyClusters")
      .withIndex("by_summaryStatus_lastSeenAt", (q) =>
        q.eq("summaryStatus", "pending")
      )
      .order("desc")
      .take(args.max);

    // 3. Flip each to "claimed" and include the latest receipt/discovery
    // link so the OCI enricher can give Hermes the Google News URL.
    const claimed = await Promise.all(
      pendingDocs.map(async (doc) => {
        await ctx.db.patch(doc._id, {
          summaryStatus: "claimed",
          claimedAt: args.now,
          updatedAt: args.now,
        });
        const updated = await ctx.db.get(doc._id);
        if (!updated) return null;

        const latestReceipt = await ctx.db
          .query("clusterReceipts")
          .withIndex("by_clusterId_retrievedAt", (q) =>
            q.eq("clusterId", updated._id)
          )
          .order("desc")
          .first();

        return {
          ...updated,
          googleNewsUrl: latestReceipt?.googleNewsUrl ?? "",
          latestReceipt,
        };
      })
    );

    return claimed.filter(
      (doc): doc is NonNullable<(typeof claimed)[number]> => doc !== null
    );
  },
});

// ---------------------------------------------------------------------------
// saveEnrichment
//
// Updates a storyCluster with enrichment data + inserts a hermesCalls row
// (success) + inserts an enricher success event. Atomic within one mutation.
// ---------------------------------------------------------------------------
export const saveEnrichment = mutation({
  args: {
    secret: v.string(),
    clusterId: v.id("storyClusters"),
    callId: v.string(),
    runId: v.optional(v.string()),
    // Enrichment result
    summaryBullets: v.array(v.string()),
    whyItMatters: v.string(),
    suggestedBeat: v.string(),
    confidence: v.number(),
    missingContext: v.array(v.string()),
    canonicalPublisherUrl: v.optional(v.string()),
    extractionConfidence: v.optional(v.number()),
    summaryPromptVersion: v.string(),
    // Hermes call fields
    hermesCallStartedAt: v.number(),
    hermesCallFinishedAt: v.number(),
    hermesCallLatencyMs: v.number(),
    hermesCallHttpStatus: v.number(),
    hermesCallModel: v.string(),
    hermesCallPromptVersion: v.string(),
    hermesCallBaseUrlHost: v.string(),
    hermesCallInputTokens: v.optional(v.number()),
    hermesCallOutputTokens: v.optional(v.number()),
    hermesCallTotalTokens: v.optional(v.number()),
    hermesCallUsageSource: v.union(
      v.literal("provider"),
      v.literal("estimated"),
      v.literal("none")
    ),
    hermesCallEstimatedCostCents: v.optional(v.number()),
    hermesCallRequestSummary: v.string(),
    hermesCallResponseSummary: v.string(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Update cluster
    await ctx.db.patch(args.clusterId, {
      status: "summarized",
      summaryStatus: "summarized",
      summaryBullets: args.summaryBullets,
      whyItMatters: args.whyItMatters,
      summaryConfidence: args.confidence,
      missingContext: args.missingContext,
      summaryPromptVersion: args.summaryPromptVersion,
      latestHermesCallId: args.callId,
      canonicalPublisherUrl: args.canonicalPublisherUrl,
      extractionConfidence: args.extractionConfidence,
      updatedAt: now,
    });

    // Insert hermesCalls row
    await ctx.db.insert("hermesCalls", {
      callId: args.callId,
      runId: args.runId,
      clusterId: args.clusterId,
      purpose: "rss_summary",
      provider: "hermes_openai_compat",
      baseUrlHost: args.hermesCallBaseUrlHost,
      model: args.hermesCallModel,
      promptVersion: args.hermesCallPromptVersion,
      status: "success",
      startedAt: args.hermesCallStartedAt,
      finishedAt: args.hermesCallFinishedAt,
      latencyMs: args.hermesCallLatencyMs,
      httpStatus: args.hermesCallHttpStatus,
      inputTokens: args.hermesCallInputTokens,
      outputTokens: args.hermesCallOutputTokens,
      totalTokens: args.hermesCallTotalTokens,
      usageSource: args.hermesCallUsageSource,
      estimatedCostCents: args.hermesCallEstimatedCostCents,
      requestSummary: args.hermesCallRequestSummary,
      responseSummary: args.hermesCallResponseSummary,
    });

    // Insert success event
    await ctx.db.insert("events", {
      eventId: `${args.callId}-success`,
      runId: args.runId,
      clusterId: args.clusterId,
      hermesCallId: args.callId,
      family: "enrichment",
      type: "enrich_success",
      severity: "info",
      message: `Enriched cluster ${args.clusterId} with confidence ${args.confidence}`,
      createdAt: now,
    });

    return { status: "summarized" };
  },
});

// ---------------------------------------------------------------------------
// markDuplicate
//
// Suppresses a cluster when Hermes memory says the article was already
// processed. We still record the Hermes call and event for audit/cost.
// ---------------------------------------------------------------------------
export const markDuplicate = mutation({
  args: {
    secret: v.string(),
    clusterId: v.id("storyClusters"),
    callId: v.string(),
    runId: v.optional(v.string()),
    duplicateOf: v.optional(v.string()),
    duplicateReason: v.string(),
    // Hermes call fields
    hermesCallStartedAt: v.number(),
    hermesCallFinishedAt: v.number(),
    hermesCallLatencyMs: v.number(),
    hermesCallHttpStatus: v.optional(v.number()),
    hermesCallModel: v.string(),
    hermesCallPromptVersion: v.string(),
    hermesCallBaseUrlHost: v.string(),
    hermesCallInputTokens: v.optional(v.number()),
    hermesCallOutputTokens: v.optional(v.number()),
    hermesCallTotalTokens: v.optional(v.number()),
    hermesCallUsageSource: v.union(
      v.literal("provider"),
      v.literal("estimated"),
      v.literal("none")
    ),
    hermesCallEstimatedCostCents: v.optional(v.number()),
    hermesCallRequestSummary: v.string(),
    hermesCallResponseSummary: v.string(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();
    const duplicateSummary = JSON.stringify({
      duplicateOf: args.duplicateOf,
      duplicateReason: args.duplicateReason,
    }).slice(0, 500);

    await ctx.db.patch(args.clusterId, {
      status: "suppressed",
      summaryStatus: "duplicate",
      latestHermesCallId: args.callId,
      updatedAt: now,
    });

    await ctx.db.insert("hermesCalls", {
      callId: args.callId,
      runId: args.runId,
      clusterId: args.clusterId,
      purpose: "rss_summary",
      provider: "hermes_openai_compat",
      baseUrlHost: args.hermesCallBaseUrlHost,
      model: args.hermesCallModel,
      promptVersion: args.hermesCallPromptVersion,
      status: "duplicate",
      startedAt: args.hermesCallStartedAt,
      finishedAt: args.hermesCallFinishedAt,
      latencyMs: args.hermesCallLatencyMs,
      httpStatus: args.hermesCallHttpStatus,
      inputTokens: args.hermesCallInputTokens,
      outputTokens: args.hermesCallOutputTokens,
      totalTokens: args.hermesCallTotalTokens,
      usageSource: args.hermesCallUsageSource,
      estimatedCostCents: args.hermesCallEstimatedCostCents,
      requestSummary: args.hermesCallRequestSummary,
      responseSummary: args.hermesCallResponseSummary,
      errorClass: "duplicate",
      errorMessage: duplicateSummary,
    });

    await ctx.db.insert("events", {
      eventId: `${args.callId}-duplicate`,
      runId: args.runId,
      clusterId: args.clusterId,
      hermesCallId: args.callId,
      family: "enrichment",
      type: "enrich_duplicate",
      severity: "info",
      message: `Cluster ${args.clusterId} skipped as duplicate: ${args.duplicateReason}`,
      dataRedacted: duplicateSummary,
      createdAt: now,
    });

    return { status: "duplicate" };
  },
});

// ---------------------------------------------------------------------------
// markThin
//
// Marks a cluster as thin/failed after a Hermes call failure.
// ---------------------------------------------------------------------------
export const markThin = mutation({
  args: {
    secret: v.string(),
    clusterId: v.id("storyClusters"),
    callId: v.string(),
    runId: v.optional(v.string()),
    reason: v.string(),
    hermesCallStatus: v.union(
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("parse_error")
    ),
    // Hermes call fields (may be partial on failure)
    hermesCallStartedAt: v.number(),
    hermesCallFinishedAt: v.optional(v.number()),
    hermesCallLatencyMs: v.optional(v.number()),
    hermesCallHttpStatus: v.optional(v.number()),
    hermesCallModel: v.string(),
    hermesCallPromptVersion: v.string(),
    hermesCallBaseUrlHost: v.string(),
    hermesCallInputTokens: v.optional(v.number()),
    hermesCallOutputTokens: v.optional(v.number()),
    hermesCallTotalTokens: v.optional(v.number()),
    hermesCallUsageSource: v.union(
      v.literal("provider"),
      v.literal("estimated"),
      v.literal("none")
    ),
    hermesCallEstimatedCostCents: v.optional(v.number()),
    hermesCallRequestSummary: v.string(),
    hermesCallResponseSummary: v.optional(v.string()),
    hermesCallErrorClass: v.optional(v.string()),
    hermesCallErrorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Update cluster to thin
    await ctx.db.patch(args.clusterId, {
      status: "thin",
      summaryStatus: "thin",
      updatedAt: now,
    });

    // Insert hermesCalls row
    await ctx.db.insert("hermesCalls", {
      callId: args.callId,
      runId: args.runId,
      clusterId: args.clusterId,
      purpose: "rss_summary",
      provider: "hermes_openai_compat",
      baseUrlHost: args.hermesCallBaseUrlHost,
      model: args.hermesCallModel,
      promptVersion: args.hermesCallPromptVersion,
      status: args.hermesCallStatus,
      startedAt: args.hermesCallStartedAt,
      finishedAt: args.hermesCallFinishedAt,
      latencyMs: args.hermesCallLatencyMs,
      httpStatus: args.hermesCallHttpStatus,
      inputTokens: args.hermesCallInputTokens,
      outputTokens: args.hermesCallOutputTokens,
      totalTokens: args.hermesCallTotalTokens,
      usageSource: args.hermesCallUsageSource,
      estimatedCostCents: args.hermesCallEstimatedCostCents,
      requestSummary: args.hermesCallRequestSummary,
      responseSummary: args.hermesCallResponseSummary,
      errorClass: args.hermesCallErrorClass,
      errorMessage: args.hermesCallErrorMessage,
    });

    // Insert failure event
    await ctx.db.insert("events", {
      eventId: `${args.callId}-thin`,
      runId: args.runId,
      clusterId: args.clusterId,
      hermesCallId: args.callId,
      family: "enrichment",
      type: "enrich_thin",
      severity: "warning",
      message: `Cluster ${args.clusterId} marked thin: ${args.reason}`,
      createdAt: now,
    });

    return { status: "thin" };
  },
});
