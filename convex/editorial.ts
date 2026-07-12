// ---------------------------------------------------------------------------
// Convex editorial mutations — persist editorial plans, role specs,
// worker results, revision loops, and newsroom memory.
// ONR-004
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Secret check
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ---------------------------------------------------------------------------
// upsertEditorialPlan
// ---------------------------------------------------------------------------
export const upsertEditorialPlan = mutation({
  args: {
    secret: v.string(),
    planId: v.string(),
    editionKey: v.string(),
    editorialDirection: v.string(),
    sectionNames: v.array(v.string()),
    sectionDescriptions: v.array(v.string()),
    roleIds: v.array(v.string()),
    dormantBeats: v.array(v.string()),
    dormantRationale: v.string(),
    totalTokenBudget: v.number(),
    concurrencyLimit: v.number(),
    inputDigest: v.string(),
    rawHermesResponse: v.string(),
    costCents: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Upsert by planId
    const existing = await ctx.db
      .query("editorialPlans")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        editorialDirection: args.editorialDirection,
        sectionNames: args.sectionNames,
        sectionDescriptions: args.sectionDescriptions,
        roleIds: args.roleIds,
        dormantBeats: args.dormantBeats,
        dormantRationale: args.dormantRationale,
        totalTokenBudget: args.totalTokenBudget,
        concurrencyLimit: args.concurrencyLimit,
        inputDigest: args.inputDigest,
        rawHermesResponse: args.rawHermesResponse,
        costCents: args.costCents,
      });
      return { planId: existing[0].planId, status: "updated" };
    }

    await ctx.db.insert("editorialPlans", {
      planId: args.planId,
      editionKey: args.editionKey,
      editorialDirection: args.editorialDirection,
      sectionNames: args.sectionNames,
      sectionDescriptions: args.sectionDescriptions,
      roleIds: args.roleIds,
      dormantBeats: args.dormantBeats,
      dormantRationale: args.dormantRationale,
      totalTokenBudget: args.totalTokenBudget,
      concurrencyLimit: args.concurrencyLimit,
      inputDigest: args.inputDigest,
      rawHermesResponse: args.rawHermesResponse,
      costCents: args.costCents,
      createdAt: now,
    });

    return { planId: args.planId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// upsertRoleSpec
// ---------------------------------------------------------------------------
export const upsertRoleSpec = mutation({
  args: {
    secret: v.string(),
    planId: v.string(),
    editionKey: v.string(),
    roleId: v.string(),
    name: v.string(),
    rationale: v.string(),
    assignedClusterIds: v.array(v.string()),
    mission: v.string(),
    allowedTools: v.array(v.string()),
    guardrails: v.array(v.string()),
    successCriteria: v.array(v.string()),
    parentTrace: v.string(),
    tokenBudget: v.number(),
    timeBudgetMs: v.number(),
    wasNamed: v.boolean(),
    rawHermesResponse: v.string(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Upsert by editionKey + roleId
    const existing = await ctx.db
      .query("roleSpecs")
      .withIndex("by_editionKey_roleId", (q) =>
        q.eq("editionKey", args.editionKey).eq("roleId", args.roleId)
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        name: args.name,
        rationale: args.rationale,
        assignedClusterIds: args.assignedClusterIds,
        mission: args.mission,
        allowedTools: args.allowedTools,
        guardrails: args.guardrails,
        successCriteria: args.successCriteria,
        tokenBudget: args.tokenBudget,
        timeBudgetMs: args.timeBudgetMs,
        wasNamed: args.wasNamed,
        rawHermesResponse: args.rawHermesResponse,
      });
      return { roleId: args.roleId, status: "updated" };
    }

    await ctx.db.insert("roleSpecs", {
      planId: args.planId,
      editionKey: args.editionKey,
      roleId: args.roleId,
      name: args.name,
      rationale: args.rationale,
      assignedClusterIds: args.assignedClusterIds,
      mission: args.mission,
      allowedTools: args.allowedTools,
      guardrails: args.guardrails,
      successCriteria: args.successCriteria,
      parentTrace: args.parentTrace,
      tokenBudget: args.tokenBudget,
      timeBudgetMs: args.timeBudgetMs,
      wasNamed: args.wasNamed,
      rawHermesResponse: args.rawHermesResponse,
      createdAt: now,
    });

    return { roleId: args.roleId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// upsertWorkerResult
// ---------------------------------------------------------------------------
export const upsertWorkerResult = mutation({
  args: {
    secret: v.string(),
    editionKey: v.string(),
    resultId: v.string(),
    roleId: v.string(),
    title: v.string(),
    summary: v.string(),
    summaryBullets: v.array(v.string()),
    beat: v.string(),
    confidence: v.number(),
    sourceUrls: v.array(v.string()),
    sourceNames: v.array(v.string()),
    meetsCriteria: v.boolean(),
    selfAssessmentReasoning: v.string(),
    validationStatus: v.union(
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("repaired")
    ),
    validationErrors: v.array(v.string()),
    repairAttempted: v.boolean(),
    repairDetail: v.optional(v.string()),
    rawResponse: v.string(),
    tokensUsed: v.number(),
    estimatedCostCents: v.number(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();

    // Upsert by editionKey + roleId (each role produces one result per edition)
    const existing = await ctx.db
      .query("workerResults")
      .withIndex("by_editionKey_roleId", (q) =>
        q.eq("editionKey", args.editionKey).eq("roleId", args.roleId)
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        resultId: args.resultId,
        title: args.title,
        summary: args.summary,
        summaryBullets: args.summaryBullets,
        beat: args.beat,
        confidence: args.confidence,
        sourceUrls: args.sourceUrls,
        sourceNames: args.sourceNames,
        meetsCriteria: args.meetsCriteria,
        selfAssessmentReasoning: args.selfAssessmentReasoning,
        validationStatus: args.validationStatus,
        validationErrors: args.validationErrors,
        repairAttempted: args.repairAttempted,
        repairDetail: args.repairDetail,
        rawResponse: args.rawResponse,
        tokensUsed: args.tokensUsed,
        estimatedCostCents: args.estimatedCostCents,
        latencyMs: args.latencyMs,
      });
      return { resultId: args.resultId, status: "updated" };
    }

    await ctx.db.insert("workerResults", {
      editionKey: args.editionKey,
      resultId: args.resultId,
      roleId: args.roleId,
      title: args.title,
      summary: args.summary,
      summaryBullets: args.summaryBullets,
      beat: args.beat,
      confidence: args.confidence,
      sourceUrls: args.sourceUrls,
      sourceNames: args.sourceNames,
      meetsCriteria: args.meetsCriteria,
      selfAssessmentReasoning: args.selfAssessmentReasoning,
      validationStatus: args.validationStatus,
      validationErrors: args.validationErrors,
      repairAttempted: args.repairAttempted,
      repairDetail: args.repairDetail,
      rawResponse: args.rawResponse,
      tokensUsed: args.tokensUsed,
      estimatedCostCents: args.estimatedCostCents,
      latencyMs: args.latencyMs,
      createdAt: now,
    });

    return { resultId: args.resultId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// recordRevision
// ---------------------------------------------------------------------------
export const recordRevision = mutation({
  args: {
    secret: v.string(),
    loopId: v.string(),
    editionKey: v.string(),
    roleId: v.string(),
    originalResultId: v.string(),
    revisedResultId: v.optional(v.string()),
    concerns: v.array(v.string()),
    suggestions: v.array(v.string()),
    severity: v.union(v.literal("required"), v.literal("optional")),
    disposition: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    round: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    await ctx.db.insert("revisionLoops", {
      loopId: args.loopId,
      editionKey: args.editionKey,
      roleId: args.roleId,
      originalResultId: args.originalResultId,
      revisedResultId: args.revisedResultId,
      concerns: args.concerns,
      suggestions: args.suggestions,
      severity: args.severity,
      disposition: args.disposition,
      round: args.round,
      createdAt: args.createdAt,
    });

    return { loopId: args.loopId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// saveMemory
// ---------------------------------------------------------------------------
export const saveMemory = mutation({
  args: {
    secret: v.string(),
    memoryId: v.string(),
    kind: v.union(
      v.literal("lesson"),
      v.literal("role_pattern"),
      v.literal("editorial_rule"),
      v.literal("guardrail")
    ),
    content: v.string(),
    tags: v.array(v.string()),
    provenance: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    await ctx.db.insert("newsroomMemory", {
      memoryId: args.memoryId,
      kind: args.kind,
      content: args.content,
      tags: args.tags,
      provenance: args.provenance,
      confidence: args.confidence,
      createdAt: args.createdAt,
    });

    return { memoryId: args.memoryId, status: "created" };
  },
});

// ---------------------------------------------------------------------------
// Queries (public — read from Mission Control)
// ---------------------------------------------------------------------------

/** Get the latest editorial plan for an edition (redacted — no raw Hermes output). */
export const getLatestPlan = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("editorialPlans")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .take(1);

    if (plans.length === 0) return null;
    const p = plans[0];
    // Strip raw provider output from public surface
    return {
      planId: p.planId,
      editionKey: p.editionKey,
      editorialDirection: p.editorialDirection,
      sectionNames: p.sectionNames,
      roleIds: p.roleIds,
      dormantBeats: p.dormantBeats,
      dormantRationale: p.dormantRationale,
      totalTokenBudget: p.totalTokenBudget,
      concurrencyLimit: p.concurrencyLimit,
      inputDigest: p.inputDigest,
      costCents: p.costCents,
      createdAt: p.createdAt,
    };
  },
});

/** Get all role specs for a plan (redacted — no raw Hermes output). */
export const getRoleSpecs = query({
  args: { planId: v.string() },
  handler: async (ctx, args) => {
    const specs = await ctx.db
      .query("roleSpecs")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .collect();
    // Strip raw provider output
    return specs.map((rs) => ({
      planId: rs.planId,
      editionKey: rs.editionKey,
      roleId: rs.roleId,
      name: rs.name,
      rationale: rs.rationale,
      assignedClusterIds: rs.assignedClusterIds,
      mission: rs.mission,
      allowedTools: rs.allowedTools,
      guardrails: rs.guardrails,
      successCriteria: rs.successCriteria,
      parentTrace: rs.parentTrace,
      tokenBudget: rs.tokenBudget,
      timeBudgetMs: rs.timeBudgetMs,
      wasNamed: rs.wasNamed,
      createdAt: rs.createdAt,
    }));
  },
});

/** Get the worker results for an edition (redacted — no raw provider output). */
export const getWorkerResults = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("workerResults")
      .withIndex("by_editionKey_roleId", (q) =>
        q.eq("editionKey", args.editionKey)
      )
      .collect();
    return results.map((wr) => ({
      editionKey: wr.editionKey,
      resultId: wr.resultId,
      roleId: wr.roleId,
      title: wr.title,
      summary: wr.summary,
      summaryBullets: wr.summaryBullets,
      beat: wr.beat,
      confidence: wr.confidence,
      sourceUrls: wr.sourceUrls,
      sourceNames: wr.sourceNames,
      meetsCriteria: wr.meetsCriteria,
      selfAssessmentReasoning: wr.selfAssessmentReasoning,
      validationStatus: wr.validationStatus,
      validationErrors: wr.validationErrors,
      repairAttempted: wr.repairAttempted,
      repairDetail: wr.repairDetail,
      tokensUsed: wr.tokensUsed,
      estimatedCostCents: wr.estimatedCostCents,
      latencyMs: wr.latencyMs,
      createdAt: wr.createdAt,
    }));
  },
});

/** Get revision loops for an edition. */
export const getRevisionLoops = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("revisionLoops")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
      .collect();
  },
});

/** Get recent newsroom memories. */
export const getRecentMemories = query({
  args: { kind: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = args.limit ?? 20;
    if (args.kind) {
      return await ctx.db
        .query("newsroomMemory")
        .withIndex("by_kind_createdAt", (q) => q.eq("kind", args.kind as "lesson" | "role_pattern" | "editorial_rule" | "guardrail"))
        .order("desc")
        .take(max);
    }
    return await ctx.db
      .query("newsroomMemory")
      .withIndex("by_createdAt")
      .order("desc")
      .take(max);
  },
});

/** Get the worker results for the previous edition to feed into the next plan. */
export const getPriorEditionDigest = query({
  args: { excludeEditionKey: v.string(), maxResults: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = args.maxResults ?? 3;
    const plans = await ctx.db
      .query("editorialPlans")
      .withIndex("by_createdAt")
      .order("desc")
      .take(max + 10); // over-fetch to filter

    return plans
      .filter((p) => p.editionKey !== args.excludeEditionKey)
      .slice(0, max)
      .map((p) => ({
        editionKey: p.editionKey,
        editorialDirection: p.editorialDirection,
        roleIds: p.roleIds,
        dormantBeats: p.dormantBeats,
      }));
  },
});

// ---------------------------------------------------------------------------
// Eval mutations (auto-capture + eval runs)
// ---------------------------------------------------------------------------

/** Upsert an eval case — auto-captured from live runs or seeded manually. */
export const upsertEvalCase = mutation({
  args: {
    secret: v.string(),
    evalId: v.string(),
    category: v.string(),
    description: v.string(),
    inputDigest: v.string(),
    expectedBehavior: v.string(),
    promptVersionAtCapture: v.string(),
    source: v.union(v.literal("seeded"), v.literal("captured")),
    provenanceEdition: v.optional(v.string()),
    provenanceRoleId: v.optional(v.string()),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    // Deduplicate by evalId
    const existing = await ctx.db
      .query("evalCases")
      .withIndex("by_category", (q) => q.eq("category", args.category as any))
      .filter((q) => q.eq(q.field("evalId"), args.evalId))
      .take(1);

    if (existing.length > 0) return { evalId: args.evalId, status: "duplicate" };

    const now = Date.now();
    await ctx.db.insert("evalCases", {
      evalId: args.evalId,
      category: args.category as any,
      description: args.description,
      inputDigest: args.inputDigest,
      expectedBehavior: args.expectedBehavior,
      promptVersionAtCapture: args.promptVersionAtCapture,
      source: args.source,
      provenanceEdition: args.provenanceEdition,
      provenanceRoleId: args.provenanceRoleId,
      notes: args.notes,
      createdAt: now,
    });

    return { evalId: args.evalId, status: "created" };
  },
});

/** Record an eval run result. */
export const recordEvalRun = mutation({
  args: {
    secret: v.string(),
    runId: v.string(),
    evalSet: v.string(),
    total: v.number(),
    passed: v.number(),
    failed: v.number(),
    passRate: v.number(),
    byCategoryJson: v.string(),
    promptVersion: v.string(),
    source: v.union(v.literal("manual"), v.literal("ci"), v.literal("pre-commit")),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    const now = Date.now();
    await ctx.db.insert("evalRuns", {
      runId: args.runId,
      evalSet: args.evalSet,
      total: args.total,
      passed: args.passed,
      failed: args.failed,
      passRate: args.passRate,
      byCategoryJson: args.byCategoryJson,
      promptVersion: args.promptVersion,
      source: args.source,
      createdAt: now,
    });

    return { runId: args.runId, status: "created" };
  },
});

/** Get the last N eval runs for a given eval set. */
export const getEvalRuns = query({
  args: { evalSet: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evalRuns")
      .withIndex("by_evalSet_createdAt", (q) => q.eq("evalSet", args.evalSet))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

/** Get recent eval cases (table scan ordered by creation). */
export const getEvalCases = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("evalCases").collect();
    return all
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 20);
  },
});
