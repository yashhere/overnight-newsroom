import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ingestionRuns: defineTable({
    runId: v.string(),
    trigger: v.union(v.literal("scheduled"), v.literal("manual")),
    serviceVersion: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("partial"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    feedCount: v.number(),
    feedsSucceeded: v.optional(v.number()),
    feedsFailed: v.optional(v.number()),
    itemsSeen: v.optional(v.number()),
    clustersCreated: v.optional(v.number()),
    clustersUpdated: v.optional(v.number()),
    duplicatesSkipped: v.optional(v.number()),
    errorSummary: v.optional(v.string()),
  })
    .index("by_startedAt", ["startedAt"])
    .index("by_status_startedAt", ["status", "startedAt"])
    .index("by_trigger_startedAt", ["trigger", "startedAt"]),

  storyClusters: defineTable({
    titleHash: v.string(),
    leadTitle: v.string(),
    normalizedTitle: v.string(),
    alternateHeadlines: v.array(v.string()),
    outletNames: v.array(v.string()),
    outletCount: v.number(),
    beats: v.array(v.string()),
    language: v.string(),
    country: v.string(),
    publishedAt: v.optional(v.number()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    status: v.union(
      v.literal("discovered"),
      v.literal("summarized"),
      v.literal("thin"),
      v.literal("selected"),
      v.literal("aired"),
      v.literal("suppressed")
    ),
    summaryStatus: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("summarized"),
      v.literal("thin"),
      v.literal("failed")
    ),
    claimedAt: v.optional(v.number()),
    summaryBullets: v.optional(v.array(v.string())),
    whyItMatters: v.optional(v.string()),
    summaryConfidence: v.optional(v.number()),
    missingContext: v.optional(v.array(v.string())),
    summaryPromptVersion: v.optional(v.string()),
    latestHermesCallId: v.optional(v.string()),
    canonicalPublisherUrl: v.optional(v.string()),
    extractionConfidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // NOTE: Compound indexes in Convex are NOT unique.
    // Application-level upsert: query by titleHash+language, update if exists.
    .index("by_titleHash_language", ["titleHash", "language"])
    .index("by_status_lastSeenAt", ["status", "lastSeenAt"])
    .index("by_summaryStatus_lastSeenAt", ["summaryStatus", "lastSeenAt"])
    .index("by_language_lastSeenAt", ["language", "lastSeenAt"]),

  clusterReceipts: defineTable({
    clusterId: v.id("storyClusters"),
    runId: v.string(),
    feedUrl: v.string(),
    beat: v.string(),
    googleNewsUrl: v.string(),
    rssGuid: v.optional(v.string()),
    rssPublishedAt: v.optional(v.number()),
    rssTitle: v.string(),
    rssDescriptionText: v.optional(v.string()),
    outletNames: v.array(v.string()),
    retrievedAt: v.number(),
  })
    .index("by_clusterId_retrievedAt", ["clusterId", "retrievedAt"])
    .index("by_runId", ["runId"])
    .index("by_googleNewsUrl", ["googleNewsUrl"]),

  hermesCalls: defineTable({
    callId: v.string(),
    runId: v.optional(v.string()),
    clusterId: v.optional(v.id("storyClusters")),
    purpose: v.union(v.literal("rss_summary")),
    provider: v.union(v.literal("hermes_openai_compat")),
    baseUrlHost: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("parse_error")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    httpStatus: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    usageSource: v.union(
      v.literal("provider"),
      v.literal("estimated"),
      v.literal("none")
    ),
    estimatedCostCents: v.optional(v.number()),
    requestSummary: v.string(),
    responseSummary: v.optional(v.string()),
    errorClass: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_clusterId_startedAt", ["clusterId", "startedAt"])
    .index("by_status_startedAt", ["status", "startedAt"])
    .index("by_model_startedAt", ["model", "startedAt"]),

  events: defineTable({
    eventId: v.string(),
    runId: v.optional(v.string()),
    clusterId: v.optional(v.id("storyClusters")),
    hermesCallId: v.optional(v.string()),
    family: v.union(
      v.literal("ingestion"),
      v.literal("enrichment"),
      v.literal("source"),
      v.literal("cost"),
      v.literal("health"),
      v.literal("exception")
    ),
    type: v.string(),
    severity: v.union(
      v.literal("debug"),
      v.literal("info"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    dataRedacted: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_runId_createdAt", ["runId", "createdAt"])
    .index("by_family_createdAt", ["family", "createdAt"])
    .index("by_severity_createdAt", ["severity", "createdAt"])
});
