import { v } from "convex/values";
import { mutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

// ---------------------------------------------------------------------------
// Secret check — every external mutation must pass a valid secret.
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ---------------------------------------------------------------------------
// startIngestionRun
// ---------------------------------------------------------------------------
export const startIngestionRun = mutation({
  args: {
    secret: v.string(),
    runId: v.string(),
    trigger: v.union(v.literal("scheduled"), v.literal("manual")),
    serviceVersion: v.optional(v.string()),
    feedCount: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    await ctx.db.insert("ingestionRuns", {
      runId: args.runId,
      trigger: args.trigger,
      serviceVersion: args.serviceVersion,
      status: "running",
      startedAt: args.startedAt,
      feedCount: args.feedCount,
    });
    return args.runId;
  },
});

// ---------------------------------------------------------------------------
// finishIngestionRun
// ---------------------------------------------------------------------------
export const finishIngestionRun = mutation({
  args: {
    secret: v.string(),
    runId: v.string(),
    status: v.union(v.literal("success"), v.literal("partial"), v.literal("failed")),
    feedsSucceeded: v.number(),
    feedsFailed: v.number(),
    itemsSeen: v.number(),
    clustersCreated: v.number(),
    clustersUpdated: v.number(),
    duplicatesSkipped: v.number(),
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    // Find the run by runId (not a Convex ID — it's our own string)
    const runs = await ctx.db
      .query("ingestionRuns")
      .withIndex("by_startedAt", (q) => q)
      .filter((q) => q.eq(q.field("runId"), args.runId))
      .take(1);

    if (runs.length === 0) {
      throw new Error(`Ingestion run not found: ${args.runId}`);
    }

    const run = runs[0];
    const latencyMs = Date.now() - run.startedAt;

    await ctx.db.patch(run._id, {
      status: args.status,
      finishedAt: Date.now(),
      latencyMs,
      feedsSucceeded: args.feedsSucceeded,
      feedsFailed: args.feedsFailed,
      itemsSeen: args.itemsSeen,
      clustersCreated: args.clustersCreated,
      clustersUpdated: args.clustersUpdated,
      duplicatesSkipped: args.duplicatesSkipped,
      errorSummary: args.errorSummary,
    });
  },
});

// ---------------------------------------------------------------------------
// ingestClusters — application-level upsert + receipt insertion
// Convex compound indexes are NOT unique, so we query first, then
// insert or update.
// ---------------------------------------------------------------------------
export const ingestClusters = mutation({
  args: {
    secret: v.string(),
    runId: v.string(),
    clusters: v.array(
      v.object({
        // Cluster fields
        titleHash: v.string(),
        leadTitle: v.string(),
        normalizedTitle: v.string(),
        alternateHeadlines: v.array(v.string()),
        outletNames: v.array(v.string()),
        outletCount: v.number(),
        beat: v.string(),
        language: v.string(),
        country: v.string(),
        publishedAt: v.optional(v.number()),
        // Receipt fields (embedded)
        feedUrl: v.string(),
        googleNewsUrl: v.string(),
        rssGuid: v.optional(v.string()),
        rssPublishedAt: v.optional(v.number()),
        rssTitle: v.string(),
        rssDescriptionText: v.optional(v.string()),
        retrievedAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();
    const results: Array<"created" | "updated"> = [];

    // Process sequentially inside the mutation. This preserves one receipt per
    // sighting and prevents same-batch duplicate title hashes from racing each
    // other into duplicate storyCluster rows.
    for (const c of args.clusters) {
      const existing = await ctx.db
        .query("storyClusters")
        .withIndex("by_titleHash_language", (q) =>
          q.eq("titleHash", c.titleHash).eq("language", c.language)
        )
        .take(1);

      let clusterId: Id<"storyClusters">;
      let result: "created" | "updated";

      if (existing.length > 0) {
        const doc = existing[0];

        const mergedOutlets = Array.from(
          new Set([...doc.outletNames, ...c.outletNames])
        );
        const mergedHeadlines = Array.from(
          new Set([...doc.alternateHeadlines, ...c.alternateHeadlines])
        );
        const mergedBeats = Array.from(new Set([...doc.beats, c.beat]));

        await ctx.db.patch(doc._id, {
          lastSeenAt: now,
          outletNames: mergedOutlets,
          outletCount: mergedOutlets.length,
          alternateHeadlines: mergedHeadlines,
          beats: mergedBeats,
          updatedAt: now,
        });

        clusterId = doc._id;
        result = "updated";
      } else {
        clusterId = await ctx.db.insert("storyClusters", {
          titleHash: c.titleHash,
          leadTitle: c.leadTitle,
          normalizedTitle: c.normalizedTitle,
          alternateHeadlines: c.alternateHeadlines,
          outletNames: c.outletNames,
          outletCount: c.outletCount,
          beats: [c.beat],
          language: c.language,
          country: c.country,
          publishedAt: c.publishedAt,
          firstSeenAt: now,
          lastSeenAt: now,
          status: "discovered",
          summaryStatus: "pending",
          createdAt: now,
          updatedAt: now,
        });
        result = "created";
      }

      await ctx.db.insert("clusterReceipts", {
        clusterId,
        runId: args.runId,
        feedUrl: c.feedUrl,
        beat: c.beat,
        googleNewsUrl: c.googleNewsUrl,
        rssGuid: c.rssGuid,
        rssPublishedAt: c.rssPublishedAt,
        rssTitle: c.rssTitle,
        rssDescriptionText: c.rssDescriptionText,
        outletNames: c.outletNames,
        retrievedAt: c.retrievedAt,
      });

      results.push(result);
    }

    const created = results.filter((result) => result === "created").length;
    const updated = results.filter((result) => result === "updated").length;
    const duplicates = 0;

    return { created, updated, duplicates };
  },
});

// ---------------------------------------------------------------------------
// logEvent — standalone event insertion
// ---------------------------------------------------------------------------
export const logIngestionEvent = mutation({
  args: {
    secret: v.string(),
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
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    await ctx.db.insert("events", {
      eventId: args.eventId,
      runId: args.runId,
      clusterId: args.clusterId,
      hermesCallId: args.hermesCallId,
      family: args.family,
      type: args.type,
      severity: args.severity,
      message: args.message,
      dataRedacted: args.dataRedacted,
      createdAt: args.createdAt,
    });
  },
});

// For health endpoint — internal query
export const getHealthSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const lastRun = await ctx.db
      .query("ingestionRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first();

    return {
      schemaVersion: "1.0.0",
      lastRunId: lastRun?.runId ?? null,
      lastRunStatus: lastRun?.status ?? null,
    };
  },
});
