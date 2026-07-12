// ---------------------------------------------------------------------------
// Convex Judge + Audio mutations and queries (ONR-005, ONR-006)
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ---------------------------------------------------------------------------
// Judge: upsertClaim
// ---------------------------------------------------------------------------
export const upsertClaim = mutation({
  args: {
    secret: v.string(),
    claimId: v.string(),
    editionKey: v.string(),
    claim: v.string(),
    storyKey: v.string(),
    roleId: v.string(),
    sourceLines: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const now = Date.now();

    const existing = await ctx.db
      .query("claims")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .filter((q) => q.eq(q.field("claimId"), args.claimId))
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        claim: args.claim,
        sourceLines: args.sourceLines,
      });
      return { claimId: args.claimId, status: "updated" };
    }

    await ctx.db.insert("claims", {
      claimId: args.claimId,
      editionKey: args.editionKey,
      claim: args.claim,
      storyKey: args.storyKey,
      roleId: args.roleId,
      sourceLines: args.sourceLines,
      createdAt: now,
    });
    return { claimId: args.claimId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// Judge: recordVerdict
// ---------------------------------------------------------------------------
export const recordVerdict = mutation({
  args: {
    secret: v.string(),
    claimId: v.string(),
    editionKey: v.string(),
    verdict: v.union(
      v.literal("approved"),
      v.literal("revise"),
      v.literal("block"),
      v.literal("escalate"),
    ),
    reason: v.string(),
    evidenceJson: v.string(),
    receiptsCorroborated: v.boolean(),
    linkupCorroborated: v.boolean(),
    conflictDetail: v.optional(v.string()),
    confidence: v.number(),
    tokensUsed: v.number(),
    estimatedCostCents: v.number(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const now = Date.now();

    await ctx.db.insert("verdicts", {
      claimId: args.claimId,
      editionKey: args.editionKey,
      verdict: args.verdict,
      reason: args.reason,
      evidenceJson: args.evidenceJson,
      receiptsCorroborated: args.receiptsCorroborated,
      linkupCorroborated: args.linkupCorroborated,
      conflictDetail: args.conflictDetail,
      confidence: args.confidence,
      tokensUsed: args.tokensUsed,
      estimatedCostCents: args.estimatedCostCents,
      latencyMs: args.latencyMs,
      createdAt: now,
    });
    return { claimId: args.claimId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// Judge: getJudgeTrail — public query, no auth
// ---------------------------------------------------------------------------
export const getJudgeTrail = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const verdicts = await ctx.db
      .query("verdicts")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .collect();

    // Public view: evidence URLs and names only, no raw provider output
    return verdicts.map((v) => ({
      claimId: v.claimId,
      verdict: v.verdict,
      reason: v.reason,
      confidence: v.confidence,
      evidence: (() => {
        try {
          return JSON.parse(v.evidenceJson);
        } catch {
          return [];
        }
      })(),
      contentious: v.verdict === "escalate" ? v.conflictDetail : undefined,
    }));
  },
});

/** Get blocked claims for manager feedback. */
export const getBlockedClaims = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verdicts")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .filter((q) =>
        q.or(
          q.eq(q.field("verdict"), "block"),
          q.eq(q.field("verdict"), "escalate"),
        ),
      )
      .collect()
      .then((vs) =>
        vs.map((v) => ({
          claimId: v.claimId,
          verdict: v.verdict,
          reason: v.reason,
          confidence: v.confidence,
        })),
      );
  },
});

// ---------------------------------------------------------------------------
// Audio: upsertAudioSegment
// ---------------------------------------------------------------------------
export const upsertAudioSegment = mutation({
  args: {
    secret: v.string(),
    segmentId: v.string(),
    editionKey: v.string(),
    anchor: v.union(v.literal("A"), v.literal("B")),
    turnIndex: v.number(),
    text: v.string(),
    voiceId: v.string(),
    durationMs: v.number(),
    clipUrl: v.string(),
    costCents: v.number(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const now = Date.now();

    const existing = await ctx.db
      .query("audioSegments")
      .withIndex("by_editionKey_turnIndex", (q) =>
        q.eq("editionKey", args.editionKey).eq("turnIndex", args.turnIndex),
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        clipUrl: args.clipUrl,
        durationMs: args.durationMs,
        costCents: args.costCents,
        latencyMs: args.latencyMs,
      });
      return { segmentId: args.segmentId, status: "updated" };
    }

    await ctx.db.insert("audioSegments", {
      segmentId: args.segmentId,
      editionKey: args.editionKey,
      anchor: args.anchor,
      turnIndex: args.turnIndex,
      text: args.text,
      voiceId: args.voiceId,
      durationMs: args.durationMs,
      clipUrl: args.clipUrl,
      costCents: args.costCents,
      latencyMs: args.latencyMs,
      createdAt: now,
    });
    return { segmentId: args.segmentId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// Audio: upsertEditionAudio
// ---------------------------------------------------------------------------
export const upsertEditionAudio = mutation({
  args: {
    secret: v.string(),
    editionKey: v.string(),
    totalDurationMs: v.number(),
    fullAudioUrl: v.string(),
    chaptersJson: v.string(),
    segmentIds: v.array(v.string()),
    totalCostCents: v.number(),
    totalLatencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const now = Date.now();

    const existing = await ctx.db
      .query("editionAudio")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        totalDurationMs: args.totalDurationMs,
        fullAudioUrl: args.fullAudioUrl,
        chaptersJson: args.chaptersJson,
        segmentIds: args.segmentIds,
        totalCostCents: args.totalCostCents,
        totalLatencyMs: args.totalLatencyMs,
      });
      return { editionKey: args.editionKey, status: "updated" };
    }

    await ctx.db.insert("editionAudio", {
      editionKey: args.editionKey,
      totalDurationMs: args.totalDurationMs,
      fullAudioUrl: args.fullAudioUrl,
      chaptersJson: args.chaptersJson,
      segmentIds: args.segmentIds,
      totalCostCents: args.totalCostCents,
      totalLatencyMs: args.totalLatencyMs,
      createdAt: now,
    });
    return { editionKey: args.editionKey, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// Audio: getEditionAudio — public query, no auth
// ---------------------------------------------------------------------------
export const getEditionAudio = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const audio = await ctx.db
      .query("editionAudio")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (audio.length === 0) return null;

    const segments = await ctx.db
      .query("audioSegments")
      .withIndex("by_editionKey_turnIndex", (q) =>
        q.eq("editionKey", args.editionKey),
      )
      .order("asc")
      .collect();

    return {
      editionKey: audio[0].editionKey,
      totalDurationMs: audio[0].totalDurationMs,
      fullAudioUrl: audio[0].fullAudioUrl,
      chapters: JSON.parse(audio[0].chaptersJson),
      segments: segments.map((s) => ({
        turnIndex: s.turnIndex,
        anchor: s.anchor,
        text: s.text,
        durationMs: s.durationMs,
        clipUrl: s.clipUrl,
      })),
    };
  },
});
