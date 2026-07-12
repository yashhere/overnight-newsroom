// ---------------------------------------------------------------------------
// Editorial engine — orchestrates the full newsroom cycle
// ONR-004: Dynamic editor and ephemeral desks
//
// Flow:
//   planEdition    → Hermes derives roles from candidates
//   runWorkers     → Launch ephemeral child sessions per role
//   validateOutput → Schema validation, at most 1 repair attempt
//   reviewOutput   → Manager reviews each draft
//   reviseWorkers  → Send revision notes, at most 1 loop
//   assembleEdition → Build final edition from accepted stories
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  EDITOR_IN_CHIEF_PROMPT,
  buildRoleDerivationMessage,
  parseEditorialPlanJson,
  parseWorkerResultJson,
  validateWorkerResult,
  buildWorkerSystemPrompt,
  buildWorkerRevisionPrompt,
  MANAGER_REVIEW_PROMPT,
  buildManagerReviewMessage,
  WORKER_REPAIR_PROMPT,
  RevisionNoteSchema,
  WorkerResultInputSchema,
} from "./manager.js";
import { buildCostEstimate, computeCostCents } from "./cost.js";
import type {
  EditorialPlan,
  RoleSpec,
  WorkerResult,
  RevisionNote,
  RevisionLoop,
  NewsroomMemory,
} from "./types.js";
import type { RoleDerivationInput } from "./manager.js";

// ---------------------------------------------------------------------------
// Types for the orchestration results
// ---------------------------------------------------------------------------

export interface OrchestrationResult {
  editionKey: string;
  plan: EditorialPlan;
  workerResults: WorkerResult[];
  revisionLoops: RevisionLoop[];
  memories: NewsroomMemory[];
  totalTokensUsed: number;
  totalCostCents: number;
  totalLatencyMs: number;
  status: "complete" | "partial" | "failed";
  errors: string[];
}

export interface EditionAssembly {
  editionKey: string;
  title: string;
  subtitle?: string;
  stories: Array<{
    storyKey: string;
    title: string;
    summary: string;
    summaryBullets: string[];
    beat: string;
    roleId: string;
    sourceUrl?: string;
    sourceName?: string;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Hermes call generator interface
//
// The caller provides a function that sends a system prompt + user message
// to Hermes and returns the raw response text + usage + latency. This
// keeps the editorial engine decoupled from the specific Hermes HTTP client.
// ---------------------------------------------------------------------------

export interface HermesSession {
  (params: {
    systemPrompt: string;
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }): Promise<{
    rawContent: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    latencyMs: number;
    ok: boolean;
    httpStatus: number;
  }>;
}

// ---------------------------------------------------------------------------
// Default Hermes client — OpenAI-compatible (same pattern as hermes.ts)
// ---------------------------------------------------------------------------

function getHermesConfig() {
  return {
    baseUrl: process.env.HERMES_BASE_URL || "http://localhost:8642/v1",
    apiKey: process.env.HERMES_API_KEY || "",
    model: process.env.HERMES_MODEL || "hermes-agent",
  };
}

export async function defaultHermesSession(
  params: Parameters<HermesSession>[0]
): ReturnType<HermesSession> {
  const config = getHermesConfig();
  const timeoutMs = Number(process.env.HERMES_TIMEOUT_MS || "45000");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 1000));
  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: config.model,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? 800,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userMessage },
      ],
    };

    if (params.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const rawContent =
      json.choices?.[0]?.message?.content || JSON.stringify(json);
    const usage = json.usage;

    const failed =
      !res.ok ||
      json?.hermes?.failed === true ||
      json?.choices?.[0]?.finish_reason === "error";

    return { rawContent, usage, latencyMs, ok: !failed, httpStatus: res.status };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      rawContent: "",
      usage: undefined,
      latencyMs: Date.now() - start,
      ok: false,
      httpStatus: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// planEdition — call Hermes (Editor-in-Chief) to derive roles
// ---------------------------------------------------------------------------

export async function planEdition(
  input: RoleDerivationInput,
  hermes: HermesSession = defaultHermesSession
): Promise<{ plan: EditorialPlan; costCents: number; latencyMs: number }> {
  const userMessage = buildRoleDerivationMessage(input);

  const result = await hermes({
    systemPrompt: EDITOR_IN_CHIEF_PROMPT,
    userMessage,
    temperature: 0.3,
    maxTokens: 1200,
    jsonMode: true,
  });

  if (!result.ok) {
    throw new Error(
      `Editor-in-Chief call failed (HTTP ${result.httpStatus}): ${result.rawContent.slice(0, 300)}`
    );
  }

  const plan = parseEditorialPlanJson(result.rawContent);
  plan.planId = randomUUID();
  plan.editionKey = input.editionKey;
  plan.inputDigest = JSON.stringify({
    candidateCount: input.candidates.length,
    candidateBeats: [
      ...new Set(input.candidates.map((c: { suggestedBeat: string }) => c.suggestedBeat)),
    ],
  });
  plan.createdAt = Date.now();

  // Fill in parent tracks
  for (const role of plan.roles) {
    role.parentTrace = plan.planId;
  }

  const cost = buildCostEstimate(
    result.usage,
    `${EDITOR_IN_CHIEF_PROMPT}\n\n${userMessage}`,
    result.rawContent
  );

  return { plan, costCents: cost.estimatedCostCents, latencyMs: result.latencyMs };
}

// ---------------------------------------------------------------------------
// runWorker — launch one ephemeral worker session
// ---------------------------------------------------------------------------

export async function runWorker(
  role: RoleSpec,
  editionKey: string,
  candidates: RoleDerivationInput["candidates"],
  hermes: HermesSession = defaultHermesSession
): Promise<WorkerResult> {
  const resultId = randomUUID();
  const assignedStories = candidates.filter((c: { clusterId: string }) =>
    role.assignedClusterIds.includes(c.clusterId)
  );

  const systemPrompt = buildWorkerSystemPrompt(role);
  const userMessage = JSON.stringify({
    role: { roleId: role.roleId, name: role.name, mission: role.mission },
    assignedStories,
    guardrails: role.guardrails,
    successCriteria: role.successCriteria,
  });

  const start = Date.now();
  const callResult = await hermes({
    systemPrompt,
    userMessage,
    temperature: 0.3,
    maxTokens: Math.min(role.tokenBudget, 800),
    jsonMode: true,
  });

  const latencyMs = callResult.latencyMs;
  const rawContent = callResult.rawContent;

  const cost = buildCostEstimate(
    callResult.usage,
    `${systemPrompt}\n\n${userMessage}`,
    rawContent
  );

  // Validate output
  const validation = validateWorkerResult(rawContent);
  let worker: WorkerResult;

  if (validation.valid) {
    worker = parseWorkerResultJson(rawContent, role.roleId, editionKey);
    worker.resultId = resultId;
    worker.validationStatus = "valid";
    worker.tokensUsed = cost.totalTokens;
    worker.estimatedCostCents = cost.estimatedCostCents;
    worker.latencyMs = latencyMs;
  } else {
    // Attempt repair (at most 1)
    const repairResult = await attemptRepair(
      rawContent,
      validation.errors,
      hermes
    );

    if (repairResult.valid) {
      worker = parseWorkerResultJson(
        repairResult.rawContent,
        role.roleId,
        editionKey
      );
      worker.resultId = resultId;
      worker.validationStatus = "repaired";
      worker.repairAttempted = true;
      worker.repairDetail = `Fixed: ${validation.errors.join("; ")}`;
      worker.tokensUsed = cost.totalTokens + repairResult.tokensUsed;
      worker.estimatedCostCents =
        cost.estimatedCostCents + repairResult.costCents;
      worker.latencyMs = latencyMs + repairResult.latencyMs;
    } else {
      // Failed validation after repair
      worker = {
        roleId: role.roleId,
        resultId,
        editionKey,
        story: {
          title: `[FAILED] ${role.name} — could not produce valid output`,
          summary: `Worker ${role.roleId} failed schema validation after repair. Errors: ${validation.errors.join("; ")}`,
          summaryBullets: [],
          beat: "error",
          confidence: 0,
          sources: [],
        },
        selfAssessment: { meetsCriteria: false, reasoning: "Validation failed" },
        rawResponse: rawContent,
        validationStatus: "invalid",
        validationErrors: validation.errors,
        repairAttempted: true,
        repairDetail: repairResult.valid
          ? "Repair succeeded"
          : `Repair failed: ${repairResult.errors.join("; ")}`,
        tokensUsed: cost.totalTokens + repairResult.tokensUsed,
        estimatedCostCents:
          cost.estimatedCostCents + repairResult.costCents,
        latencyMs: latencyMs + repairResult.latencyMs,
      };
    }
  }

  return worker;
}

// ---------------------------------------------------------------------------
// attemptRepair — one bounded repair attempt
// ---------------------------------------------------------------------------

async function attemptRepair(
  rawContent: string,
  errors: string[],
  hermes: HermesSession
): Promise<{
  rawContent: string;
  valid: boolean;
  errors: string[];
  tokensUsed: number;
  costCents: number;
  latencyMs: number;
}> {
  const repairPrompt = WORKER_REPAIR_PROMPT.replace("{errors}", errors.join("\n"));

  const start = Date.now();
  const result = await hermes({
    systemPrompt: repairPrompt,
    userMessage: `Your invalid output:\n\n${rawContent.slice(0, 1500)}`,
    temperature: 0.1,
    maxTokens: 400,
    jsonMode: true,
  });

  const validation = validateWorkerResult(result.rawContent);
  const cost = buildCostEstimate(
    result.usage,
    `${repairPrompt}\n\n${rawContent.slice(0, 1500)}`,
    result.rawContent
  );

  return {
    rawContent: result.rawContent,
    valid: validation.valid,
    errors: validation.errors,
    tokensUsed: cost.totalTokens,
    costCents: cost.estimatedCostCents,
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// reviewWorkerOutput — manager reviews a worker's draft
// ---------------------------------------------------------------------------

export async function reviewWorkerOutput(
  role: RoleSpec,
  workerResult: WorkerResult,
  hermes: HermesSession = defaultHermesSession
): Promise<{
  decision: "accept" | "reject";
  revisionNote?: RevisionNote;
  commentary: string;
}> {
  const userMessage = buildManagerReviewMessage(role, workerResult, workerResult.rawResponse);

  const result = await hermes({
    systemPrompt: MANAGER_REVIEW_PROMPT,
    userMessage,
    temperature: 0.2,
    maxTokens: 300,
    jsonMode: true,
  });

  try {
    const json = JSON.parse(result.rawContent);
    if (json.decision === "reject" && json.revisionNote) {
      const note = RevisionNoteSchema.parse(json.revisionNote);
      return {
        decision: "reject",
        revisionNote: {
          roleId: role.roleId,
          concerns: note.concerns,
          suggestions: note.suggestions,
          severity: note.severity,
        },
        commentary: json.commentary || "",
      };
    }
    return {
      decision: "accept",
      commentary: json.commentary || "Accepted.",
    };
  } catch {
    // If parsing fails, default to accept (don't block on review parse errors)
    return { decision: "accept", commentary: "Review parse failed — auto-accepted." };
  }
}

// ---------------------------------------------------------------------------
// runWorkersWithReview — launch workers, review, and optionally revise
// ---------------------------------------------------------------------------

export async function runWorkersWithReview(
  plan: EditorialPlan,
  candidates: RoleDerivationInput["candidates"],
  hermes: HermesSession = defaultHermesSession
): Promise<{
  results: WorkerResult[];
  loops: RevisionLoop[];
  memories: NewsroomMemory[];
}> {
  const results: WorkerResult[] = [];
  const loops: RevisionLoop[] = [];
  const memories: NewsroomMemory[] = [];
  const concurrency = plan.concurrencyLimit ?? 3;

  // Phase 1: Run all workers concurrently (up to concurrency limit)
  for (let i = 0; i < plan.roles.length; i += concurrency) {
    const batch = plan.roles.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((role) =>
        runWorker(role, plan.editionKey, candidates, hermes)
      )
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        // Worker crashed — create a failure entry
        results.push({
          roleId: "unknown",
          resultId: randomUUID(),
          editionKey: plan.editionKey,
          story: {
            title: "[CRASHED] Worker unexpected failure",
            summary: r.reason?.message || "Unknown error",
            summaryBullets: [],
            beat: "error",
            confidence: 0,
            sources: [],
          },
          selfAssessment: { meetsCriteria: false, reasoning: "Crashed" },
          rawResponse: "",
          validationStatus: "invalid",
          validationErrors: [r.reason?.message || "Unknown crash"],
          repairAttempted: false,
          tokensUsed: 0,
          estimatedCostCents: 0,
          latencyMs: 0,
        });
        memories.push({
          memoryId: randomUUID(),
          kind: "lesson",
          content: `Worker crash in role: ${r.reason?.message || "unknown"}. Consider reducing concurrency or per-role budget.`,
          tags: ["crash", "resilience"],
          provenance: `edition-${plan.editionKey}`,
          confidence: 0.8,
          createdAt: Date.now(),
        });
      }
    }
  }

  // Phase 2: Review each worker's output
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const role = plan.roles.find((r) => r.roleId === result.roleId);
    if (!role) continue;
    if (result.validationStatus === "invalid") {
      // Already failed validation — skip review
      continue;
    }

    const review = await reviewWorkerOutput(role, result, hermes);

    if (review.decision === "reject" && review.revisionNote) {
      // Phase 2b: Attempt one revision
      const loop: RevisionLoop = {
        loopId: randomUUID(),
        editionKey: plan.editionKey,
        roleId: role.roleId,
        originalResultId: result.resultId,
        revisionNote: review.revisionNote,
        round: 1,
        createdAt: Date.now(),
        disposition: "pending",
      };

      // Send revision note to worker
      const revisionPrompt = buildWorkerRevisionPrompt(
        review.revisionNote,
        result.rawResponse
      );

      const revisionResult = await hermes({
        systemPrompt: buildWorkerSystemPrompt(role),
        userMessage: revisionPrompt,
        temperature: 0.3,
        maxTokens: Math.min(role.tokenBudget, 800),
        jsonMode: true,
      });

      const revValidation = validateWorkerResult(revisionResult.rawContent);

      if (revValidation.valid) {
        const revised = parseWorkerResultJson(
          revisionResult.rawContent,
          role.roleId,
          plan.editionKey
        );
        revised.resultId = randomUUID();
        revised.tokensUsed = buildCostEstimate(
          revisionResult.usage,
          `${buildWorkerSystemPrompt(role)}\n\n${revisionPrompt}`,
          revisionResult.rawContent
        ).totalTokens;
        revised.latencyMs = revisionResult.latencyMs;

        // Replace the result with the revised version
        results[i] = revised;
        loop.revisedResultId = revised.resultId;
        loop.disposition = "accepted";

        // Record the successful revision as a memory
        memories.push({
          memoryId: randomUUID(),
          kind: "role_pattern",
          content: `Role ${role.roleId} succeeded after revision. Concerns: ${review.revisionNote.concerns.join("; ")}. Suggestions applied: ${review.revisionNote.suggestions.join("; ")}`,
          tags: ["revision", role.roleId, "success"],
          provenance: `edition-${plan.editionKey}`,
          confidence: 0.7,
          createdAt: Date.now(),
        });
      } else {
        loop.disposition = "rejected";
        result.validationStatus = "invalid";
        result.validationErrors = revValidation.errors;

        memories.push({
          memoryId: randomUUID(),
          kind: "lesson",
          content: `Role ${role.roleId} failed revision. Original concerns: ${review.revisionNote.concerns.join("; ")}`,
          tags: ["revision", role.roleId, "failure"],
          provenance: `edition-${plan.editionKey}`,
          confidence: 0.6,
          createdAt: Date.now(),
        });
      }

      loops.push(loop);
    } else {
      // Accepted on first try
      memories.push({
        memoryId: randomUUID(),
        kind: "role_pattern",
        content: `Role ${role.roleId} accepted on first draft. Pattern: ${role.guardrails.slice(0, 2).join("; ")}`,
        tags: ["accepted", role.roleId],
        provenance: `edition-${plan.editionKey}`,
        confidence: 0.9,
        createdAt: Date.now(),
      });
    }
  }

  return { results, loops, memories };
}

// ---------------------------------------------------------------------------
// assembleEdition — build the final edition from accepted worker results
// ---------------------------------------------------------------------------

export function assembleEdition(
  plan: EditorialPlan,
  results: WorkerResult[]
): EditionAssembly {
  const accepted = results.filter(
    (r) => r.validationStatus === "valid" || r.validationStatus === "repaired"
  );

  const stories = accepted
    .filter((r) => r.story.summaryBullets.length > 0)
    .map((r, i) => ({
      storyKey: `${plan.editionKey}-${r.roleId}-${i}`,
      title: r.story.title,
      summary: r.story.summary,
      summaryBullets: r.story.summaryBullets,
      beat: r.story.beat,
      roleId: r.roleId,
      sourceUrl: r.story.sources[0]?.url,
      sourceName: r.story.sources[0]?.name,
      confidence: r.story.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    editionKey: plan.editionKey,
    title: `Overnight Newsroom — ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    subtitle: plan.editorialDirection,
    stories,
  };
}

// ---------------------------------------------------------------------------
// orchestrateEdition — full pipeline
// ---------------------------------------------------------------------------

export async function orchestrateEdition(
  input: RoleDerivationInput,
  hermes: HermesSession = defaultHermesSession
): Promise<OrchestrationResult> {
  const start = Date.now();
  const errors: string[] = [];
  let totalTokensUsed = 0;
  let totalCostCents = 0;
  let planLatency = 0;

  // 1. Derive editorial plan and roles
  let plan: EditorialPlan;
  try {
    const planResult = await planEdition(input, hermes);
    plan = planResult.plan;
    totalTokensUsed += buildCostEstimate(
      undefined,
      "",
      JSON.stringify(plan)
    ).totalTokens;
    totalCostCents += planResult.costCents;
    planLatency = planResult.latencyMs;
  } catch (err: any) {
    return {
      editionKey: input.editionKey,
      plan: {
        planId: randomUUID(),
        editionKey: input.editionKey,
        editorialDirection: "Failed to derive",
        sections: [],
        roles: [],
        dormantBeats: [],
        dormantRationale: "",
        totalTokenBudget: 0,
        concurrencyLimit: 0,
        createdAt: Date.now(),
        inputDigest: "",
      },
      workerResults: [],
      revisionLoops: [],
      memories: [],
      totalTokensUsed: 0,
      totalCostCents: 0,
      totalLatencyMs: Date.now() - start,
      status: "failed",
      errors: [err?.message || "planEdition failed"],
    };
  }

  // 2. Run workers, review, and revise
  const { results, loops, memories } = await runWorkersWithReview(
    plan,
    input.candidates,
    hermes
  );

  for (const r of results) {
    totalTokensUsed += r.tokensUsed;
    totalCostCents += r.estimatedCostCents;
  }

  // 3. Classify overall status
  const validCount = results.filter(
    (r) => r.validationStatus === "valid" || r.validationStatus === "repaired"
  ).length;

  let status: OrchestrationResult["status"];
  if (validCount === 0 && plan.roles.length > 0) {
    status = "failed";
    errors.push("All workers produced invalid output");
  } else if (validCount < plan.roles.length) {
    status = "partial";
    errors.push(
      `${plan.roles.length - validCount} of ${plan.roles.length} roles produced invalid output`
    );
  } else {
    status = "complete";
  }

  // Auto-memory: record what roles were spawned this edition
  const roleNames = plan.roles.map((r) => r.roleId).join(", ");
  const dormantList = plan.dormantBeats.join(", ");
  memories.push({
    memoryId: randomUUID(),
    kind: "editorial_rule",
    content: `Edition ${plan.editionKey}: spawned roles [${roleNames}], dormant beats [${dormantList}]. Input had ${input.candidates.length} candidates across ${new Set(input.candidates.map((c: { suggestedBeat: string }) => c.suggestedBeat)).size} beats.`,
    tags: ["edition_record", plan.editionKey],
    provenance: `edition-${plan.editionKey}`,
    confidence: 1.0,
    createdAt: Date.now(),
  });

  return {
    editionKey: input.editionKey,
    plan,
    workerResults: results,
    revisionLoops: loops,
    memories,
    totalTokensUsed,
    totalCostCents,
    totalLatencyMs: Date.now() - start,
    status,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Utility: extract a role derivation diff for testing/verification
// ---------------------------------------------------------------------------

export function diffRoleGraphs(
  planA: EditorialPlan,
  planB: EditorialPlan
): {
  onlyInA: string[];
  onlyInB: string[];
  common: string[];
  aHasNamed: number;
  aHasNovel: number;
  bHasNamed: number;
  bHasNovel: number;
} {
  const rolesA = new Set(planA.roles.map((r) => r.roleId));
  const rolesB = new Set(planB.roles.map((r) => r.roleId));

  return {
    onlyInA: [...rolesA].filter((r) => !rolesB.has(r)),
    onlyInB: [...rolesB].filter((r) => !rolesA.has(r)),
    common: [...rolesA].filter((r) => rolesB.has(r)),
    aHasNamed: planA.roles.filter((r) => r.wasNamed).length,
    aHasNovel: planA.roles.filter((r) => !r.wasNamed).length,
    bHasNamed: planB.roles.filter((r) => r.wasNamed).length,
    bHasNovel: planB.roles.filter((r) => !r.wasNamed).length,
  };
}
