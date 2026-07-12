import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Secret check — mutations need the INGESTION_API_SECRET.
// Queries are public (no authentication) — the public page reads them.
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ---------------------------------------------------------------------------
// upsertEdition
//
// Idempotent: same editionKey → update existing. Different key → create new.
// Deletes old stories first, then inserts the current set.
// ---------------------------------------------------------------------------
export const upsertEdition = mutation({
  args: {
    secret: v.string(),
    editionKey: v.string(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    publishedAt: v.optional(v.number()),
    stories: v.array(
      v.object({
        storyKey: v.string(),
        clusterId: v.optional(v.id("storyClusters")),
        title: v.string(),
        summary: v.string(),
        summaryBullets: v.optional(v.array(v.string())),
        canonicalPublisherName: v.optional(v.string()),
        canonicalPublisherUrl: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        sourceName: v.optional(v.string()),
        receiptUrl: v.optional(v.string()),
        badges: v.optional(
          v.array(
            v.union(
              v.literal("new"),
              v.literal("developing"),
              v.literal("follow-up"),
              v.literal("breaking"),
              v.literal("correction"),
            ),
          ),
        ),
        sortOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Upsert edition by editionKey
    const existing = await ctx.db
      .query("editions")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    let editionId: Id<"editions">;

    if (existing.length > 0) {
      editionId = existing[0]._id;
      await ctx.db.patch(editionId, {
        title: args.title,
        subtitle: args.subtitle,
        status: args.status,
        publishedAt: args.publishedAt ?? existing[0].publishedAt,
        updatedAt: now,
      });

      // Delete old stories for this edition (re-insert below)
      const oldStories = await ctx.db
        .query("editionStories")
        .withIndex("by_editionId_sortOrder", (q) =>
          q.eq("editionId", editionId),
        )
        .collect();

      await Promise.all(oldStories.map((s) => ctx.db.delete(s._id)));
    } else {
      editionId = await ctx.db.insert("editions", {
        editionKey: args.editionKey,
        title: args.title,
        subtitle: args.subtitle,
        status: args.status,
        publishedAt: args.publishedAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert new stories
    for (const story of args.stories) {
      await ctx.db.insert("editionStories", {
        editionId,
        clusterId: story.clusterId,
        storyKey: story.storyKey,
        title: story.title,
        summary: story.summary,
        summaryBullets: story.summaryBullets,
        canonicalPublisherName: story.canonicalPublisherName,
        canonicalPublisherUrl: story.canonicalPublisherUrl,
        sourceUrl: story.sourceUrl,
        sourceName: story.sourceName,
        receiptUrl: story.receiptUrl,
        badges: story.badges,
        sortOrder: story.sortOrder,
        createdAt: now,
      });
    }

    return { editionId: editionId.toString(), editionKey: args.editionKey };
  },
});

// ---------------------------------------------------------------------------
// addPublicationReceipt
// ---------------------------------------------------------------------------
export const addPublicationReceipt = mutation({
  args: {
    secret: v.string(),
    editionKey: v.string(),
    receiptType: v.union(
      v.literal("deploy"),
      v.literal("publish"),
      v.literal("media"),
    ),
    receiptUrl: v.optional(v.string()),
    status: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const editions = await ctx.db
      .query("editions")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (editions.length === 0) {
      throw new Error(`Edition not found: ${args.editionKey}`);
    }

    const now = Date.now();

    // Idempotent: upsert by editionKey + receiptType
    const existing = await ctx.db
      .query("publicationReceipts")
      .withIndex("by_editionKey_receiptType", (q) =>
        q.eq("editionKey", args.editionKey).eq("receiptType", args.receiptType),
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        receiptUrl: args.receiptUrl,
        status: args.status,
        metadata: args.metadata,
      });
    } else {
      await ctx.db.insert("publicationReceipts", {
        editionId: editions[0]._id,
        editionKey: args.editionKey,
        receiptType: args.receiptType,
        receiptUrl: args.receiptUrl,
        status: args.status,
        metadata: args.metadata,
        createdAt: now,
      });
    }

    return { status: "ok" };
  },
});

// ══════════════════════════════════════════════════════════════
// Shared helper — build enriched story list with audio + evidence
// ══════════════════════════════════════════════════════════════

interface EnrichedStory {
  storyKey: string;
  title: string;
  summary: string;
  summaryBullets?: string[] | null;
  badges?: string[] | null;
  canonicalPublisherName?: string | null;
  canonicalPublisherUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  receiptUrl?: string | null;
  sortOrder: number;
  createdAt: number;
  // Audio
  audioSegment?: {
    segmentId: string;
    offsetMs: number;
    durationMs: number;
    clipUrl: string;
    anchor: string;
  } | null;
  // Evidence
  claims: Array<{
    claimId: string;
    claim: string;
    sourceLines: string[];
  }>;
  verdicts: Array<{
    claimId: string;
    verdict: string;
    reason: string;
    receiptsCorroborated: boolean;
    linkupCorroborated: boolean;
    confidence: number;
  }>;
}

async function enrichStories(
  ctx: any,
  editionStories: any[],
  editionKey: string,
): Promise<EnrichedStory[]> {
  // Fetch audio segments for edition
  const audioSegments = await ctx.db
    .query("audioSegments")
    .withIndex("by_editionKey_turnIndex", (q: any) =>
      q.eq("editionKey", editionKey),
    )
    .order("asc")
    .collect();

  // Fetch claims for edition
  const claims = await ctx.db
    .query("claims")
    .withIndex("by_editionKey", (q: any) => q.eq("editionKey", editionKey))
    .collect();

  // Fetch verdicts for edition
  const verdicts = await ctx.db
    .query("verdicts")
    .withIndex("by_editionKey", (q: any) => q.eq("editionKey", editionKey))
    .collect();

  // Map claims → verdicts
  const verdictMap = new Map(verdicts.map((v: any) => [v.claimId, v]));

  // Compute cumulative audio offset for each segment
  let cumulativeMs = 0;
  const segmentOffsetMap = new Map<string, number>();
  for (const seg of audioSegments) {
    segmentOffsetMap.set(seg.segmentId, cumulativeMs);
    cumulativeMs += seg.durationMs;
  }

  return editionStories.map((s: any, idx: number) => {
    // Match audio segment by storyKey match in the segment text or by turnIndex
    const matchSegment = audioSegments.find(
      (seg: any) => seg.turnIndex === idx,
    );

    // Match claims by storyKey
    const storyClaims = claims.filter((c: any) => c.storyKey === s.storyKey);
    const storyVerdicts = storyClaims
      .map((c: any) => verdictMap.get(c.claimId))
      .filter(Boolean);

    return {
      storyKey: s.storyKey,
      title: s.title,
      summary: s.summary,
      summaryBullets: s.summaryBullets,
      badges: s.badges,
      canonicalPublisherName: s.canonicalPublisherName,
      canonicalPublisherUrl: s.canonicalPublisherUrl,
      sourceUrl: s.sourceUrl,
      sourceName: s.sourceName,
      receiptUrl: s.receiptUrl,
      sortOrder: s.sortOrder,
      createdAt: s.createdAt,
      audioSegment: matchSegment
        ? {
            segmentId: matchSegment.segmentId,
            offsetMs: segmentOffsetMap.get(matchSegment.segmentId) ?? 0,
            durationMs: matchSegment.durationMs,
            clipUrl: matchSegment.clipUrl,
            anchor: matchSegment.anchor,
          }
        : null,
      claims: storyClaims.map((c: any) => ({
        claimId: c.claimId,
        claim: c.claim,
        sourceLines: c.sourceLines,
      })),
      verdicts: storyVerdicts.map((v: any) => ({
        claimId: v.claimId,
        verdict: v.verdict,
        reason: v.reason,
        receiptsCorroborated: v.receiptsCorroborated,
        linkupCorroborated: v.linkupCorroborated,
        confidence: v.confidence,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// latestEdition — public query, no authentication
// ---------------------------------------------------------------------------
export const latestEdition = query({
  args: {},
  handler: async (ctx) => {
    const edition = await ctx.db
      .query("editions")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .first();

    if (!edition) return null;

    const stories = await ctx.db
      .query("editionStories")
      .withIndex("by_editionId_sortOrder", (q) =>
        q.eq("editionId", edition._id),
      )
      .order("asc")
      .collect();

    const receipts = await ctx.db
      .query("publicationReceipts")
      .withIndex("by_editionId", (q) => q.eq("editionId", edition._id))
      .collect();

    // Fetch edition audio
    const editionAudios = await ctx.db
      .query("editionAudio")
      .withIndex("by_editionKey", (q) =>
        q.eq("editionKey", edition.editionKey),
      )
      .take(1);

    // Enrich stories with audio segments, claims, and verdicts
    const enrichedStories = await enrichStories(
      ctx,
      stories,
      edition.editionKey,
    );

    // Newsroom health
    const health = await computeHealth(ctx);

    return {
      edition: {
        editionKey: edition.editionKey,
        title: edition.title,
        subtitle: edition.subtitle,
        status: edition.status,
        publishedAt: edition.publishedAt,
        updatedAt: edition.updatedAt,
      },
      stories: enrichedStories,
      receipts: receipts.map((r) => ({
        receiptType: r.receiptType,
        receiptUrl: r.receiptUrl,
        status: r.status,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      editionAudio:
        editionAudios.length > 0
          ? {
              fullAudioUrl: editionAudios[0].fullAudioUrl,
              totalDurationMs: editionAudios[0].totalDurationMs,
              chapterCount: editionAudios[0].segmentIds.length,
            }
          : null,
      health,
    };
  },
});

// ---------------------------------------------------------------------------
// getEditionByKey — public query, no authentication.
// Only returns published editions; draft/archived are invisible publicly.
// ---------------------------------------------------------------------------
export const getEditionByKey = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const editions = await ctx.db
      .query("editions")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (editions.length === 0) return null;

    const edition = editions[0];

    // Only expose published editions on the public page
    if (edition.status !== "published") return null;

    const stories = await ctx.db
      .query("editionStories")
      .withIndex("by_editionId_sortOrder", (q) =>
        q.eq("editionId", edition._id),
      )
      .order("asc")
      .collect();

    const receipts = await ctx.db
      .query("publicationReceipts")
      .withIndex("by_editionId", (q) => q.eq("editionId", edition._id))
      .collect();

    // Fetch edition audio
    const editionAudios = await ctx.db
      .query("editionAudio")
      .withIndex("by_editionKey", (q) =>
        q.eq("editionKey", edition.editionKey),
      )
      .take(1);

    // Enrich stories
    const enrichedStories = await enrichStories(
      ctx,
      stories,
      edition.editionKey,
    );

    // Newsroom health
    const health = await computeHealth(ctx);

    return {
      edition: {
        editionKey: edition.editionKey,
        title: edition.title,
        subtitle: edition.subtitle,
        status: edition.status,
        publishedAt: edition.publishedAt,
        updatedAt: edition.updatedAt,
      },
      stories: enrichedStories,
      receipts: receipts.map((r) => ({
        receiptType: r.receiptType,
        receiptUrl: r.receiptUrl,
        status: r.status,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      editionAudio:
        editionAudios.length > 0
          ? {
              fullAudioUrl: editionAudios[0].fullAudioUrl,
              totalDurationMs: editionAudios[0].totalDurationMs,
              chapterCount: editionAudios[0].segmentIds.length,
            }
          : null,
      health,
    };
  },
});

// ---------------------------------------------------------------------------
// getNewsroomHealth — public query, no authentication
// ---------------------------------------------------------------------------
export const getNewsroomHealth = query({
  args: {},
  handler: async (ctx) => {
    return await computeHealth(ctx);
  },
});

// ══════════════════════════════════════════════════════════════
// Internal — compute newsroom health from recent runs + events
// ══════════════════════════════════════════════════════════════

async function computeHealth(ctx: any) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Latest ingestion run
  const latestRun = await ctx.db
    .query("ingestionRuns")
    .withIndex("by_startedAt")
    .order("desc")
    .first();

  // Recent error events (last hour)
  const recentErrors = await ctx.db
    .query("events")
    .withIndex("by_severity_createdAt", (q: any) =>
      q.eq("severity", "error"),
    )
    .order("desc")
    .take(10);

  const recentHourErrors = recentErrors.filter(
    (e: any) => e.createdAt >= oneHourAgo,
  );

  // Latest published edition
  const latestEdition = await ctx.db
    .query("editions")
    .withIndex("by_status_publishedAt", (q: any) =>
      q.eq("status", "published"),
    )
    .order("desc")
    .first();

  // Latest edition audio
  let audioHealthy = true;
  if (latestEdition) {
    const audios = await ctx.db
      .query("editionAudio")
      .withIndex("by_editionKey", (q: any) =>
        q.eq("editionKey", latestEdition.editionKey),
      )
      .take(1);
    audioHealthy = audios.length > 0;
  }

  const ingestionHealthy =
    latestRun !== null &&
    latestRun.status !== "failed" &&
    now - latestRun.startedAt < 45 * 60 * 1000; // within 45 min

  const status: "healthy" | "degraded" | "unhealthy" =
    !ingestionHealthy || recentHourErrors.length > 3
      ? "unhealthy"
      : recentHourErrors.length > 0
        ? "degraded"
        : "healthy";

  return {
    status,
    lastIngestionAt: latestRun?.startedAt ?? null,
    lastIngestionStatus: latestRun?.status ?? null,
    lastPublishAt: latestEdition?.publishedAt ?? null,
    lastEditionKey: latestEdition?.editionKey ?? null,
    recentErrorCount: recentHourErrors.length,
    audioAvailable: audioHealthy,
    updatedAt: now,
  };
}
