// ---------------------------------------------------------------------------
// Convex Mission Control — live dashboard queries and trace mutations.
// ONR-011
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Secret check
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
  if (secret !== process.env.INGESTION_API_SECRET) {
    throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
  }
}

// ===========================================================================
// Mutations (internal — called by Hermes / ingestion service)
// ===========================================================================

/** Record a structured trace node for every agent session and tool step. */
export const recordTraceNode = mutation({
  args: {
    secret: v.string(),
    editionKey: v.string(),
    nodeId: v.string(),
    parentNodeId: v.optional(v.string()),
    roleId: v.optional(v.string()),
    roleName: v.optional(v.string()),
    beat: v.optional(v.string()),
    assignment: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rejected"),
      v.literal("revised"),
    ),
    kind: v.union(
      v.literal("agent_session"),
      v.literal("tool_step"),
      v.literal("manager_decision"),
      v.literal("judge_block"),
    ),
    tokensUsed: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    evidence: v.optional(v.string()),
    artifacts: v.optional(v.array(v.string())),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    checkSecret(args.secret);

    // Upsert by editionKey + nodeId
    const existing = await ctx.db
      .query("traceNodes")
      .withIndex("by_editionKey_nodeId", (q) =>
        q.eq("editionKey", args.editionKey).eq("nodeId", args.nodeId),
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        parentNodeId: args.parentNodeId,
        roleId: args.roleId,
        roleName: args.roleName,
        beat: args.beat,
        assignment: args.assignment,
        status: args.status,
        kind: args.kind,
        tokensUsed: args.tokensUsed,
        estimatedCostCents: args.estimatedCostCents,
        latencyMs: args.latencyMs,
        inputSummary: args.inputSummary,
        outputSummary: args.outputSummary,
        evidence: args.evidence,
        artifacts: args.artifacts,
        errorMessage: args.errorMessage,
      });
      if (args.finishedAt !== undefined) {
        await ctx.db.patch(existing[0]._id, { finishedAt: args.finishedAt });
      }
      return { nodeId: args.nodeId, status: "updated" };
    }

    await ctx.db.insert("traceNodes", {
      editionKey: args.editionKey,
      nodeId: args.nodeId,
      parentNodeId: args.parentNodeId,
      roleId: args.roleId,
      roleName: args.roleName,
      beat: args.beat,
      assignment: args.assignment,
      status: args.status,
      kind: args.kind,
      tokensUsed: args.tokensUsed,
      estimatedCostCents: args.estimatedCostCents,
      latencyMs: args.latencyMs,
      inputSummary: args.inputSummary,
      outputSummary: args.outputSummary,
      evidence: args.evidence,
      artifacts: args.artifacts,
      errorMessage: args.errorMessage,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
    });

    return { nodeId: args.nodeId, status: "created" };
  },
});

// ===========================================================================
// Queries (public — read from Mission Control dashboard)
// ===========================================================================

/** Typed event for the activity feed. */
const eventSchema = v.object({
  id: v.string(),
  type: v.string(),
  roleId: v.optional(v.string()),
  roleName: v.optional(v.string()),
  message: v.string(),
  severity: v.union(
    v.literal("debug"),
    v.literal("info"),
    v.literal("warning"),
    v.literal("error"),
  ),
  createdAt: v.number(),
  evidence: v.optional(v.string()),
});

/** Typed agent row for the left pane. */
const agentSchema = v.object({
  roleId: v.string(),
  roleName: v.string(),
  beat: v.optional(v.string()),
  assignment: v.optional(v.string()),
  status: v.string(),
  isEditorInChief: v.boolean(),
  latencyMs: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  totalCostCents: v.optional(v.number()),
  traceNodeCount: v.number(),
});

/** Typed story card for the kanban center pane. */
const storyCardSchema = v.object({
  storyId: v.string(),
  title: v.string(),
  stage: v.union(
    v.literal("discovered"),
    v.literal("planned"),
    v.literal("reporting"),
    v.literal("drafting"),
    v.literal("fact_check"),
    v.literal("voice"),
    v.literal("publish"),
    v.literal("done"),
  ),
  roleId: v.optional(v.string()),
  roleName: v.optional(v.string()),
  beat: v.optional(v.string()),
  confidence: v.optional(v.number()),
  clusterId: v.optional(v.string()),
});

/** Return type annotations for type safety. */
export type MissionControlPayload = {
  edition: {
    editionKey: string;
    title: string;
    status: string;
    publishedAt?: number;
    updatedAt: number;
    createdAt: number;
  } | null;
  plan: {
    planId: string;
    editorialDirection: string;
    sectionNames: string[];
    roleIds: string[];
    totalTokenBudget: number;
    concurrencyLimit: number;
    costCents: number;
    createdAt: number;
  } | null;
  agents: Array<{
    roleId: string;
    roleName: string;
    beat?: string;
    assignment?: string;
    status: string;
    isEditorInChief: boolean;
    latencyMs?: number;
    totalTokens?: number;
    totalCostCents?: number;
    traceNodeCount: number;
  }>;
  storyBoard: Record<string, Array<{
    storyId: string;
    title: string;
    stage: string;
    roleId?: string;
    roleName?: string;
    beat?: string;
    confidence?: number;
    clusterId?: string;
  }>>;
  events: Array<{
    id: string;
    type: string;
    roleId?: string;
    roleName?: string;
    message: string;
    severity: string;
    createdAt: number;
    evidence?: string;
  }>;
  editionsToday: number;
  editionsList: Array<{ editionKey: string; title: string; status: string; createdAt: number }>;
};

/**
 * Aggregated mission control view for a selected edition.
 * Pulls together the editorial plan, role specs, worker results,
 * revision loops, trace nodes, story clusters, and system events.
 */
export const getMissionControl = query({
  args: { editionKey: v.string() },
  handler: async (ctx, args) => {
    const editionKey = args.editionKey;

    // ── Edition ────────────────────────────────────────────────
    const editions = await ctx.db
      .query("editions")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", editionKey))
      .take(1);

    const edition =
      editions.length > 0
        ? {
            editionKey: editions[0].editionKey,
            title: editions[0].title,
            status: editions[0].status,
            publishedAt: editions[0].publishedAt,
            updatedAt: editions[0].updatedAt,
            createdAt: editions[0].createdAt,
          }
        : null;

    // ── Editorial Plan ────────────────────────────────────────
    const plans = await ctx.db
      .query("editorialPlans")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", editionKey))
      .take(1);

    const plan =
      plans.length > 0
        ? {
            planId: plans[0].planId,
            editorialDirection: plans[0].editorialDirection,
            sectionNames: plans[0].sectionNames,
            roleIds: plans[0].roleIds,
            totalTokenBudget: plans[0].totalTokenBudget,
            concurrencyLimit: plans[0].concurrencyLimit,
            costCents: plans[0].costCents,
            createdAt: plans[0].createdAt,
          }
        : null;

    // ── Role Specs — deserialize assignedClusterIds to actual cluster titles ──
    let roleSpecs: Array<{
      roleId: string;
      name: string;
      rationale: string;
      assignedClusterIds: string[];
      mission: string;
      allowedTools: string[];
      guardrails: string[];
      successCriteria: string[];
      parentTrace: string;
      tokenBudget: number;
      timeBudgetMs: number;
      createdAt: number;
    }> = [];

    if (plan) {
      const rawSpecs = await ctx.db
        .query("roleSpecs")
        .withIndex("by_planId", (q) => q.eq("planId", plan.planId))
        .collect();

      roleSpecs = rawSpecs.map((rs) => ({
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
        createdAt: rs.createdAt,
      }));

      // Older orchestrator runs persisted the plan but forgot roleSpecs.
      // Reconstruct enough role spec data from rawHermesResponse so Planned /
      // Reporting can still be observed for existing editions.
      if (roleSpecs.length === 0 && plans[0].rawHermesResponse) {
        try {
          const parsed = JSON.parse(plans[0].rawHermesResponse);
          const rawRoles = Array.isArray(parsed.roles) ? parsed.roles : [];
          roleSpecs = rawRoles.map((r: any, i: number) => ({
            roleId: String(r.roleId || r.name || `role-${i + 1}`),
            name: String(r.name || r.roleId || `Role ${i + 1}`),
            rationale: String(r.rationale || "Reconstructed from saved plan"),
            assignedClusterIds: Array.isArray(r.assignedClusterIds)
              ? r.assignedClusterIds.map(String)
              : [],
            mission: String(r.mission || "Newsroom assignment"),
            allowedTools: Array.isArray(r.allowedTools) ? r.allowedTools.map(String) : [],
            guardrails: Array.isArray(r.guardrails) ? r.guardrails.map(String) : [],
            successCriteria: Array.isArray(r.successCriteria)
              ? r.successCriteria.map(String)
              : [],
            parentTrace: "editor-in-chief",
            tokenBudget: Number(r.tokenBudget || 500),
            timeBudgetMs: Number(r.timeBudgetMs || 300000),
            createdAt: plans[0].createdAt,
          }));
        } catch {
          // Keep empty — dashboard will show discovered/worker fallback state.
        }
      }
    }

    // ── Worker Results ────────────────────────────────────────
    const workerResults = await ctx.db
      .query("workerResults")
      .withIndex("by_editionKey_roleId", (q) =>
        q.eq("editionKey", editionKey),
      )
      .collect();

    const workerResultMap = new Map(
      workerResults.map((wr) => [wr.roleId, wr]),
    );

    // ── Revision Loops ────────────────────────────────────────
    const revisionLoops = await ctx.db
      .query("revisionLoops")
      .withIndex("by_editionKey", (q) => q.eq("editionKey", editionKey))
      .collect();

    // ── Trace Nodes ───────────────────────────────────────────
    const traceNodes = await ctx.db
      .query("traceNodes")
      .withIndex("by_editionKey_startedAt", (q) =>
        q.eq("editionKey", editionKey),
      )
      .order("desc")
      .collect();

    // ── System Events ─────────────────────────────────────────
    const systemEvents = await ctx.db
      .query("events")
      .order("desc")
      .take(100);

    // ── Editions today count ──────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEditions = await ctx.db
      .query("editions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50); // rough; filter client-side

    const editionsToday = todayEditions.filter(
      (e) => e.createdAt >= todayStart.getTime(),
    ).length;

    // ── All editions list ─────────────────────────────────────
    const allEditions = await ctx.db
      .query("editions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(20);

    const editionsList = allEditions.map((e) => ({
      editionKey: e.editionKey,
      title: e.title,
      status: e.status,
      createdAt: e.createdAt,
    }));

    // ══════════════════════════════════════════════════════════
    // Build agents list (left pane)
    // ══════════════════════════════════════════════════════════

    const agents: MissionControlPayload["agents"] = [];

    // Editor-in-Chief (virtual — derived from the plan)
    if (plan) {
      const eicTraces = traceNodes.filter(
        (tn) => tn.kind === "manager_decision",
      );
      const eicTotalTokens = eicTraces.reduce(
        (sum, tn) => sum + (tn.tokensUsed ?? 0),
        0,
      );
      const eicTotalCost = eicTraces.reduce(
        (sum, tn) => sum + (tn.estimatedCostCents ?? 0),
        0,
      );

      const eicRunningTrace = traceNodes.find(
        (tn) =>
          tn.kind === "agent_session" &&
          tn.roleId === "editor-in-chief" &&
          tn.status === "running",
      );

      agents.push({
        roleId: "editor-in-chief",
        roleName: "Editor-in-Chief",
        beat: "all",
        assignment: plan.editorialDirection.slice(0, 80),
        status: eicRunningTrace ? "running" : plan ? "completed" : "idle",
        isEditorInChief: true,
        latencyMs: eicRunningTrace?.latencyMs,
        totalTokens: eicTotalTokens,
        totalCostCents: eicTotalCost,
        traceNodeCount: eicTraces.length,
      });
    }

    // Specialists (from role specs)
    for (const spec of roleSpecs) {
      const wr = workerResultMap.get(spec.roleId);
      const roleTraces = traceNodes.filter(
        (tn) => tn.roleId === spec.roleId,
      );
      const totalTokens = roleTraces.reduce(
        (sum, tn) => sum + (tn.tokensUsed ?? 0),
        0,
      );
      const totalCost = roleTraces.reduce(
        (sum, tn) => sum + (tn.estimatedCostCents ?? 0),
        0,
      );

      // Determine agent status from trace nodes and worker results
      let agentStatus = "pending";
      const runningTrace = roleTraces.find((tn) => tn.status === "running");
      const failedTrace = roleTraces.find((tn) => tn.status === "failed");

      if (runningTrace) {
        agentStatus = "running";
      } else if (failedTrace && !wr) {
        agentStatus = "failed";
      } else if (wr) {
        if (wr.validationStatus === "valid") {
          // Check for revision loops
          const roleRevisions = revisionLoops.filter(
            (rl) => rl.roleId === spec.roleId,
          );
          const rejected = roleRevisions.some(
            (rl) => rl.disposition === "rejected",
          );
          agentStatus = rejected ? "rejected" : "completed";
        } else if (wr.validationStatus === "repaired") {
          agentStatus = "completed";
        } else {
          agentStatus = "failed";
        }
      }

      agents.push({
        roleId: spec.roleId,
        roleName: spec.name,
        beat: wr?.beat,
        assignment: spec.mission.slice(0, 80),
        status: agentStatus,
        isEditorInChief: false,
        latencyMs: wr?.latencyMs,
        totalTokens,
        totalCostCents: totalCost,
        traceNodeCount: roleTraces.length,
      });
    }

    // Fallback: worker results without matching role specs
    // (e.g., when there's no editorial plan yet, or plan uses different roleIds)
    const specRoleIds = new Set(roleSpecs.map((rs) => rs.roleId));
    for (const wr of workerResults) {
      if (specRoleIds.has(wr.roleId)) continue;

      const roleTraces = traceNodes.filter(
        (tn) => tn.roleId === wr.roleId,
      );
      const totalTokens =
        wr.tokensUsed +
        roleTraces.reduce((sum, tn) => sum + (tn.tokensUsed ?? 0), 0);
      const totalCost =
        wr.estimatedCostCents +
        roleTraces.reduce(
          (sum, tn) => sum + (tn.estimatedCostCents ?? 0),
          0,
        );

      let agentStatus = "completed";
      if (wr.validationStatus === "invalid") {
        agentStatus = "failed";
      } else if (wr.validationStatus === "repaired") {
        agentStatus = "completed";
      }

      agents.push({
        roleId: wr.roleId,
        roleName: wr.roleId, // fallback name — roleId is descriptive enough
        beat: wr.beat,
        assignment: wr.title.slice(0, 80),
        status: agentStatus,
        isEditorInChief: false,
        latencyMs: wr.latencyMs,
        totalTokens,
        totalCostCents: totalCost,
        traceNodeCount: roleTraces.length,
      });
    }

    // ══════════════════════════════════════════════════════════
    // Build story board (center pane — kanban columns)
    // ══════════════════════════════════════════════════════════

    const storyBoard: Record<string, MissionControlPayload["storyBoard"][string]> = {
      discovered: [],
      planned: [],
      reporting: [],
      drafting: [],
      fact_check: [],
      voice: [],
      publish: [],
      done: [],
    };

    // Fetch audio, published stories, claims, and verdicts. The board is an
    // observability phase board: each column is populated by the artifact that
    // proves that phase happened, rather than only by the story's latest state.
    const audioSegments = await ctx.db
      .query("audioSegments")
      .withIndex("by_editionKey_turnIndex", (q: any) =>
        q.eq("editionKey", editionKey),
      )
      .order("asc")
      .collect();

    const claims = await ctx.db
      .query("claims")
      .withIndex("by_editionKey", (q: any) => q.eq("editionKey", editionKey))
      .collect();

    const verdicts = await ctx.db
      .query("verdicts")
      .withIndex("by_editionKey", (q: any) => q.eq("editionKey", editionKey))
      .collect();

    const claimById = new Map(claims.map((c: any) => [c.claimId, c]));
    const verdictByClaimId = new Map(verdicts.map((v: any) => [v.claimId, v]));
    const workerByRoleId = new Map(workerResults.map((wr: any) => [wr.roleId, wr]));
    const roleSpecByRoleId = new Map(roleSpecs.map((rs) => [rs.roleId, rs]));

    let editionStoryMap = new Map<string, any>();
    if (editions.length > 0) {
      const eStories = await ctx.db
        .query("editionStories")
        .withIndex("by_editionId_sortOrder", (q) =>
          q.eq("editionId", editions[0]._id),
        )
        .order("asc")
        .collect();
      for (const es of eStories) editionStoryMap.set(es.storyKey, es);
    }

    const isEditionDone =
      edition?.status === "published" || edition?.status === "archived";

    // ── Planned: role specs / assignments ─────────────────────
    for (const spec of roleSpecs) {
      const assigned = spec.assignedClusterIds.length > 0
        ? spec.assignedClusterIds
        : [`${spec.roleId}-assignment`];
      for (const cid of assigned) {
        storyBoard["planned"].push({
          storyId: `planned:${spec.roleId}:${cid}`,
          title: `${spec.name}: ${spec.mission.slice(0, 90)}`,
          stage: "planned",
          roleId: spec.roleId,
          roleName: spec.name,
          beat: undefined,
          confidence: undefined,
          clusterId: cid === `${spec.roleId}-assignment` ? undefined : cid,
        });
      }
    }

    // ── Reporting: agent session traces ───────────────────────
    for (const tn of traceNodes.filter((t: any) => t.kind === "agent_session" && t.roleId)) {
      const spec = roleSpecByRoleId.get(tn.roleId!);
      storyBoard["reporting"].push({
        storyId: `reporting:${tn.nodeId}`,
        title: tn.assignment || spec?.mission || tn.roleName || tn.roleId!,
        stage: "reporting",
        roleId: tn.roleId,
        roleName: tn.roleName || spec?.name,
        beat: tn.beat,
        confidence: undefined,
        clusterId: undefined,
      });
    }

    // If no traces exist yet, show role specs that are not drafted as pending reporting.
    const rolesWithDrafts = new Set(workerResults.map((wr: any) => wr.roleId));
    for (const spec of roleSpecs) {
      if (rolesWithDrafts.has(spec.roleId)) continue;
      storyBoard["reporting"].push({
        storyId: `reporting-pending:${spec.roleId}`,
        title: spec.mission || spec.name,
        stage: "reporting",
        roleId: spec.roleId,
        roleName: spec.name,
        beat: undefined,
        confidence: undefined,
        clusterId: spec.assignedClusterIds[0],
      });
    }

    // ── Drafting: worker results / generated drafts ───────────
    for (const wr of workerResults) {
      const spec = roleSpecByRoleId.get(wr.roleId);
      storyBoard["drafting"].push({
        storyId: `draft:${wr.resultId}`,
        title: wr.title,
        stage: "drafting",
        roleId: wr.roleId,
        roleName: spec?.name || wr.roleId,
        beat: wr.beat,
        confidence: wr.confidence,
        clusterId: spec?.assignedClusterIds[0],
      });
    }

    // ── Fact Check: claims + verdicts ─────────────────────────
    for (const claim of claims) {
      const verdict = verdictByClaimId.get(claim.claimId);
      const spec = roleSpecByRoleId.get(claim.roleId);
      storyBoard["fact_check"].push({
        storyId: `fact:${claim.claimId}`,
        title: `${verdict?.verdict ?? "pending"}: ${claim.claim}`,
        stage: "fact_check",
        roleId: claim.roleId,
        roleName: spec?.name || claim.roleId,
        beat: workerByRoleId.get(claim.roleId)?.beat,
        confidence: verdict?.confidence,
        clusterId: undefined,
      });
    }

    // Verdicts without a claim (legacy/best-effort writes) still surface.
    for (const verdict of verdicts) {
      if (claimById.has(verdict.claimId)) continue;
      storyBoard["fact_check"].push({
        storyId: `fact-verdict:${verdict.claimId}`,
        title: `${verdict.verdict}: ${verdict.reason}`,
        stage: "fact_check",
        roleId: undefined,
        roleName: undefined,
        beat: undefined,
        confidence: verdict.confidence,
        clusterId: undefined,
      });
    }

    // ── Voice: audio render artifacts ─────────────────────────
    for (const segment of audioSegments) {
      const wr = workerResults[segment.turnIndex];
      const spec = wr ? roleSpecByRoleId.get(wr.roleId) : undefined;
      storyBoard["voice"].push({
        storyId: `voice:${segment.segmentId}`,
        title: segment.text.slice(0, 100),
        stage: "voice",
        roleId: wr?.roleId,
        roleName: spec?.name || wr?.roleId,
        beat: wr?.beat,
        confidence: undefined,
        clusterId: spec?.assignedClusterIds[0],
      });
    }

    // ── Publish/Done: edition story artifacts ─────────────────
    for (const [storyKey, es] of editionStoryMap) {
      const stage = isEditionDone ? "done" : "publish";
      storyBoard[stage].push({
        storyId: `${stage}:${storyKey}`,
        title: es.title,
        stage,
        roleId: undefined,
        roleName: es.canonicalPublisherName ?? undefined,
        beat: undefined,
        confidence: undefined,
        clusterId: es.clusterId?.toString(),
      });
    }

    // ── Discovered: unassigned ingestion clusters ─────────────
    const usedClusterIds = new Set<string>();
    for (const stage of Object.keys(storyBoard)) {
      for (const card of storyBoard[stage]) {
        if (card.clusterId) usedClusterIds.add(card.clusterId);
      }
    }
    for (const spec of roleSpecs) {
      for (const cid of spec.assignedClusterIds) usedClusterIds.add(cid);
    }

    const discoveredClusters = await ctx.db
      .query("storyClusters")
      .withIndex("by_status_lastSeenAt", (q: any) =>
        q.eq("status", "discovered"),
      )
      .order("desc")
      .take(30);

    const summarizedClusters = await ctx.db
      .query("storyClusters")
      .withIndex("by_summaryStatus_lastSeenAt", (q: any) =>
        q.eq("summaryStatus", "summarized"),
      )
      .order("desc")
      .take(30);

    const seenClusterIds = new Set<string>();
    for (const cluster of [...discoveredClusters, ...summarizedClusters]) {
      const cid = cluster._id.toString();
      if (usedClusterIds.has(cid) || seenClusterIds.has(cid)) continue;
      seenClusterIds.add(cid);
      storyBoard["discovered"].push({
        storyId: `discovered:${cid}`,
        title: cluster.leadTitle,
        stage: "discovered",
        roleId: undefined,
        roleName: undefined,
        beat: cluster.beats[0],
        confidence: cluster.summaryConfidence,
        clusterId: cid,
      });
    }

    // ── Deduplicate kanban cards by storyId ──
    for (const stage of Object.keys(storyBoard)) {
      const seen = new Set<string>();
      storyBoard[stage] = storyBoard[stage].filter((s) => {
        if (seen.has(s.storyId)) return false;
        seen.add(s.storyId);
        return true;
      });
    }

    // ══════════════════════════════════════════════════════════
    // Build activity feed (right pane)
    // ══════════════════════════════════════════════════════════

    const events: MissionControlPayload["events"] = [];

    // 1. Trace node events → activity feed entries
    for (const tn of traceNodes) {
      let type: string;
      let message: string;
      const roleName = tn.roleName ?? "Unknown";

      switch (tn.kind) {
        case "agent_session":
          if (tn.status === "running") {
            type = "role_spawned";
            message = `🆕 ${roleName} spawned — ${tn.assignment ?? "starting work"}`;
          } else if (tn.status === "completed") {
            type = "role_completed";
            message = `✅ ${roleName} completed — ${tn.assignment ?? "finished"}`;
          } else if (tn.status === "failed") {
            type = "exception_raised";
            message = `❌ ${roleName} failed — ${tn.errorMessage ?? "unknown error"}`;
          } else {
            type = "status_change";
            message = `📌 ${roleName} → ${tn.status}`;
          }
          break;
        case "tool_step":
          type = "tool_execution";
          message = `🔧 ${roleName} — ${tn.assignment ?? "tool step"}`;
          break;
        case "manager_decision":
          if (tn.status === "rejected") {
            type = "draft_rejected";
            message = `↩️ Editor rejected ${roleName}'s draft`;
          } else if (tn.status === "revised") {
            type = "revision_accepted";
            message = `✏️ Editor accepted revision from ${roleName}`;
          } else if (
            tn.outputSummary?.includes("handoff") ||
            tn.assignment?.includes("handoff")
          ) {
            type = "handoff";
            message = `🤝 Handoff — ${tn.assignment ?? tn.outputSummary ?? roleName}`;
          } else {
            type = "manager_action";
            message = `👔 Editor — ${tn.assignment ?? tn.outputSummary ?? "decision"}`;
          }
          break;
        case "judge_block":
          type = "claim_blocked";
          message = `⚖️ Judge blocked — ${tn.assignment ?? tn.outputSummary ?? "claim issue"}`;
          break;
        default:
          type = "info";
          message = `${tn.kind}: ${tn.assignment ?? ""}`;
      }

      events.push({
        id: tn.nodeId,
        type,
        roleId: tn.roleId,
        roleName: tn.roleName,
        message,
        severity: tn.status === "failed" ? "error" : "info",
        createdAt: tn.startedAt,
        evidence: tn.evidence,
      });
    }

    // 2. Revision loop events
    for (const rl of revisionLoops) {
      const spec = roleSpecs.find((rs) => rs.roleId === rl.roleId);
      events.push({
        id: rl.loopId,
        type:
          rl.disposition === "rejected"
            ? "draft_rejected"
            : rl.disposition === "accepted"
              ? "revision_accepted"
              : "handoff",
        roleId: rl.roleId,
        roleName: spec?.name,
        message:
          rl.disposition === "rejected"
            ? `↩️ Draft rejected — round ${rl.round}: ${rl.concerns.join("; ")}`
            : rl.disposition === "accepted"
              ? `✅ Revision accepted — round ${rl.round}`
              : `📝 Revision requested — round ${rl.round}`,
        severity: rl.severity === "required" ? "warning" : "info",
        createdAt: rl.createdAt,
        evidence: undefined,
      });
    }

    // 3. System events
    for (const se of systemEvents) {
      events.push({
        id: se.eventId,
        type: se.type,
        roleId: undefined,
        roleName: undefined,
        message: se.message,
        severity: se.severity,
        createdAt: se.createdAt,
        evidence: se.dataRedacted,
      });
    }

    // 4. Worker result events
    for (const wr of workerResults) {
      const spec = roleSpecs.find((rs) => rs.roleId === wr.roleId);
      if (wr.meetsCriteria) {
        events.push({
          id: `wr-${wr.resultId}`,
          type: "publish_succeeded",
          roleId: wr.roleId,
          roleName: spec?.name,
          message: `📰 ${spec?.name ?? wr.roleId} published "${wr.title}" (confidence: ${wr.confidence}%)`,
          severity: "info",
          createdAt: wr.createdAt,
          evidence: undefined,
        });
      }

      if (wr.validationStatus === "repaired") {
        events.push({
          id: `wr-repair-${wr.resultId}`,
          type: "revision_accepted",
          roleId: wr.roleId,
          roleName: spec?.name,
          message: `🔧 Schema repaired for ${spec?.name ?? wr.roleId}: ${wr.validationErrors.join("; ")}`,
          severity: "warning",
          createdAt: wr.createdAt,
          evidence: undefined,
        });
      }
    }

    // Sort events by createdAt descending
    events.sort((a, b) => b.createdAt - a.createdAt);

    // Deduplicate events by id
    const seenEventIds = new Set<string>();
    const dedupedEvents = events.filter((e) => {
      if (seenEventIds.has(e.id)) return false;
      seenEventIds.add(e.id);
      return true;
    });

    // ── Aggregate stats ───────────────────────────────────────

    const totalCostCents =
      (plan?.costCents ?? 0) +
      agents.reduce((sum, a) => sum + (a.totalCostCents ?? 0), 0);

    const totalTokens =
      agents.reduce((sum, a) => sum + (a.totalTokens ?? 0), 0);

    // ── Editions today count (accurate) ───────────────────────
    let editionsTodayAccurate = 0;
    for (const e of todayEditions) {
      if (e.createdAt >= todayStart.getTime()) {
        editionsTodayAccurate++;
      }
    }

    return {
      edition,
      plan,
      agents,
      storyBoard,
      events: dedupedEvents.slice(0, 200), // limit to avoid overloading the client
      stats: {
        totalAgents: agents.length,
        activeAgents: agents.filter((a) => a.status === "running").length,
        totalCostCents,
        totalTokens,
        averageLatencyMs: agents.length > 0
          ? agents.reduce((sum, a) => sum + (a.latencyMs ?? 0), 0) / agents.filter(a => a.latencyMs).length
          : 0,
      },
      editionsToday: editionsTodayAccurate,
      editionsList,
    };
  },
});

/** Get the trace tree for a specific role (for the detail drawer). */
export const getRoleTrace = query({
  args: { editionKey: v.string(), roleId: v.string() },
  handler: async (ctx, args) => {
    const traces = await ctx.db
      .query("traceNodes")
      .withIndex("by_editionKey_startedAt", (q) =>
        q.eq("editionKey", args.editionKey),
      )
      .order("asc")
      .collect();

    // Filter for this role and its tool steps
    const roleTraces = traces.filter(
      (tn) => tn.roleId === args.roleId || tn.parentNodeId === args.roleId,
    );

    return roleTraces.map((tn) => ({
      nodeId: tn.nodeId,
      parentNodeId: tn.parentNodeId,
      roleId: tn.roleId,
      roleName: tn.roleName,
      beat: tn.beat,
      assignment: tn.assignment,
      status: tn.status,
      kind: tn.kind,
      tokensUsed: tn.tokensUsed,
      estimatedCostCents: tn.estimatedCostCents,
      latencyMs: tn.latencyMs,
      inputSummary: tn.inputSummary,
      outputSummary: tn.outputSummary,
      evidence: tn.evidence,
      artifacts: tn.artifacts,
      errorMessage: tn.errorMessage,
      startedAt: tn.startedAt,
      finishedAt: tn.finishedAt,
    }));
  },
});

/** Get all editions for the selector dropdown. */
export const getEditionsForSelector = query({
  args: {},
  handler: async (ctx) => {
    const editions = await ctx.db
      .query("editions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);

    return editions.map((e) => ({
      editionKey: e.editionKey,
      title: e.title,
      status: e.status,
      createdAt: e.createdAt,
      publishedAt: e.publishedAt,
    }));
  },
});
