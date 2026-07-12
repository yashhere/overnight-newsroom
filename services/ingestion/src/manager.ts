// ---------------------------------------------------------------------------
// Hermes Editor-in-Chief manager — system prompt and role-derivation contract
// ONR-004: Dynamic editor and ephemeral desks
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { EditorialPlan, RoleSpec, RevisionNote, WorkerResult } from "./types.js";

// ---------------------------------------------------------------------------
// Editor-in-Chief system prompt
//
// This is NOT a static worker list. It defines the policy and contract
// that causes Hermes to DERIVE specialist roles from the candidates and
// context it receives. Every run produces a different role graph.
// ---------------------------------------------------------------------------

export const EDITOR_IN_CHIEF_PROMPT = `You are the Editor-in-Chief of Overnight Newsroom, an autonomous news
organisation that publishes a single edition every cycle. Your job:

1. REVIEW the provided story candidates: each has a title, summary bullets,
   suggested beat, confidence score, outlet count, and missing context.

2. DERIVE the editorial plan. Decide:
   - What sections should this edition have? (e.g. "Markets", "Technology",
     "World Affairs", "Climate", "Culture")
   - What is the unifying editorial direction?

3. DERIVE only the specialist roles you actually need. DO NOT use a static
   list of roles. Instead:
   - Group stories by beat, theme, and required expertise.
   - Create one role per group. Give each role a descriptive id like
     "markets-reporter", "eu-policy-analyst", "tech-investigator".
   - If a beat has no relevant stories this cycle, DO NOT spawn a role for it.
   - If the stories demand a specialist skill not in any preset list, CREATE
     a new role for it. Some roles may be brand-new and not match any
     conventional beat name.

4. For EACH role output:
   - rationale: why this role exists NOW (cite specific stories)
   - assignedClusterIds: which story clusters this role covers
   - mission: what to produce
   - allowedTools: what capabilities the worker should use
   - guardrails: explicit constraints
   - successCriteria: measurable outcomes
   - tokenBudget (soft limit) and timeBudgetMs

5. IDENTIFY beats that are dormant this cycle. List them and explain why
   no role was spawned for them.

6. Output ONLY a JSON object matching the editorial plan schema. No prose,
   no markdown fences.

CONTEXT YOU HAVE: prior edition plans, newsroom memory (lessons and
successful role patterns from past cycles), and the current candidate pool.

POLICY:
- Prefer quality over quantity. 3-8 roles per edition is typical.
- Every role must have a clear mission derived from actual stories.
- Token budgets must sum to no more than the total allocation.
- Roles that would require overlapping or duplicate work should be merged.
- A role with fewer than 2 assigned stories should be folded into a broader
  role unless the stories are extremely specialised.
- Guardian/editorial oversight roles (e.g. "copy-editor", "fact-checker")
  are only spawned when the complexity of the edition warrants it.`;

// ---------------------------------------------------------------------------
// Role derivation contract — this is what gets sent as the user message
// ---------------------------------------------------------------------------

export interface RoleDerivationInput {
  /** Summary of this cycle's candidate pool */
  candidates: Array<{
    clusterId: string;
    title: string;
    summaryBullets: string[];
    suggestedBeat: string;
    confidence: number;
    outletCount: number;
    missingContext: string[];
  }>;
  /** Prior editorial plans for context (most recent first, up to 3) */
  priorPlans: string[];
  /** Newsroom memory entries (lessons and patterns) */
  memoryEntries: string[];
  /** Token budget for the entire edition */
  totalTokenBudget: number;
  /** Max concurrent workers */
  concurrencyLimit: number;
  /** Edition key */
  editionKey: string;
  /** Beats from feed config (not a static role list — just context) */
  availableBeats: string[];
}

export function buildRoleDerivationMessage(input: RoleDerivationInput): string {
  return JSON.stringify({
    editionKey: input.editionKey,
    totalTokenBudget: input.totalTokenBudget,
    concurrencyLimit: input.concurrencyLimit,
    availableBeats: input.availableBeats,
    candidates: input.candidates,
    priorPlans: input.priorPlans,
    newsroomMemory: input.memoryEntries,
  });
}

// ---------------------------------------------------------------------------
// Zod schema for the editorial plan
// ---------------------------------------------------------------------------

const RoleSpecSchema = z.object({
  roleId: z.string(),
  name: z.string(),
  rationale: z.string(),
  assignedClusterIds: z.array(z.string()),
  mission: z.string(),
  allowedTools: z.array(z.string()),
  guardrails: z.array(z.string()),
  successCriteria: z.array(z.string()),
  tokenBudget: z.number().positive(),
  timeBudgetMs: z.number().positive(),
});

const SectionSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.number(),
});

const EditorialPlanInputSchema = z.object({
  editorialDirection: z.string(),
  sections: z.array(SectionSchema),
  roles: z.array(
    RoleSpecSchema.extend({
      parentTrace: z.string().optional(),
      wasNamed: z.boolean().optional(),
    })
  ),
  dormantBeats: z.array(z.string()).default([]),
  dormantRationale: z.string().default(""),
  concurrencyLimit: z.number().optional(),
});

export const EditorialPlanSchema = EditorialPlanInputSchema.transform(
  (plan): EditorialPlan => ({
    planId: "",
    editionKey: "",
    editorialDirection: plan.editorialDirection,
    sections: plan.sections,
    roles: plan.roles.map((r) => ({
      ...r,
      parentTrace: r.parentTrace ?? "",
      wasNamed: r.wasNamed ?? false,
      timeBudgetMs: r.timeBudgetMs,
    })),
    dormantBeats: plan.dormantBeats,
    dormantRationale: plan.dormantRationale,
    totalTokenBudget: plan.roles.reduce((sum, r) => sum + r.tokenBudget, 0),
    concurrencyLimit: plan.concurrencyLimit ?? 3,
    createdAt: Date.now(),
    inputDigest: "",
  })
);

// ---------------------------------------------------------------------------
// Worker output schema — what every worker must return
// ---------------------------------------------------------------------------

const WorkerSourceSchema = z.object({
  url: z.string(),
  name: z.string(),
  accessed: z.boolean(),
});

const WorkerStorySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  summary: z.string().min(20, "Summary must be at least 20 characters"),
  summaryBullets: z
    .array(z.string())
    .min(1, "At least one summary bullet required"),
  beat: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(WorkerSourceSchema).min(1, "At least one source required"),
});

const WorkerSelfAssessmentSchema = z.object({
  meetsCriteria: z.boolean(),
  reasoning: z.string(),
});

export const WorkerResultInputSchema = z.object({
  story: WorkerStorySchema,
  selfAssessment: WorkerSelfAssessmentSchema,
});

// ---------------------------------------------------------------------------
// Revision note schema — what the manager sends back to a worker
// ---------------------------------------------------------------------------

export const RevisionNoteSchema = z.object({
  concerns: z.array(z.string()).min(1, "At least one concern required"),
  suggestions: z.array(z.string()),
  severity: z.enum(["required", "optional"]),
});

// ---------------------------------------------------------------------------
// Manager review prompt — the Editor-in-Chief reviews worker output
// ---------------------------------------------------------------------------

export const MANAGER_REVIEW_PROMPT = `You are the Editor-in-Chief reviewing a reporter's draft. You must decide:

1. Does this story meet the role's success criteria?
2. Is the writing clear, factual, and well-sourced?
3. Is the confidence reasonable given the sources?

If the story is ACCEPTABLE:
  Output: { "decision": "accept", "commentary": "brief praise" }

If the story needs REVISION:
  Output: { "decision": "reject", "revisionNote": { "concerns": [...], "suggestions": [...], "severity": "required"|"optional" } }

Be concise. Only reject if there are concrete, fixable issues.`;

// ---------------------------------------------------------------------------
// Worker system prompt — what each ephemeral worker receives
// ---------------------------------------------------------------------------

export function buildWorkerSystemPrompt(role: RoleSpec): string {
  return `You are a specialist news reporter for the Overnight Newsroom.

YOUR ROLE: ${role.name}
MISSION: ${role.mission}

GUARDRAILS:
${role.guardrails.map((g) => `- ${g}`).join("\n")}

SUCCESS CRITERIA:
${role.successCriteria.map((s) => `- ${s}`).join("\n")}

You MUST produce a structured JSON result containing:
- story: { title, summary, summaryBullets, beat, confidence, sources[] }
- selfAssessment: { meetsCriteria: boolean, reasoning: string }

Every story fact must be verifiable from your assigned source material.
If you cannot verify a claim, lower your confidence.

Output ONLY a JSON object. No prose, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Worker repair prompt — sent when the worker produces invalid output
// ---------------------------------------------------------------------------

export const WORKER_REPAIR_PROMPT = `Your previous output failed schema validation. The errors were:

{errors}

Please fix your output and return ONLY a valid JSON object matching the
required schema. Do NOT include any explanation or markdown.

Required schema:
{ "story": { "title": "...", "summary": "...", "summaryBullets": [...], "beat": "...", "confidence": 0.0-1.0, "sources": [{"url":"...","name":"...","accessed":true/false}] }, "selfAssessment": { "meetsCriteria": true/false, "reasoning": "..." } }`;

// ---------------------------------------------------------------------------
// Worker revision prompt — sent when the manager rejects a draft
// ---------------------------------------------------------------------------

export function buildWorkerRevisionPrompt(
  note: RevisionNote,
  previousOutput: string
): string {
  return `Your editor rejected your draft with these notes:

CONCERNS:
${note.concerns.map((c) => `- ${c}`).join("\n")}

SUGGESTIONS:
${note.suggestions.map((s) => `- ${s}`).join("\n")}

SEVERITY: ${note.severity}

YOUR PREVIOUS DRAFT:
${previousOutput}

Please revise your story addressing the concerns above. Output ONLY a JSON
object with the same schema as before. No prose, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Worker call helper
// ---------------------------------------------------------------------------

export interface WorkerCallResult {
  /** The raw text output from Hermes */
  rawContent: string;
  /** Parsed and validated result, if successful */
  parsed?: WorkerResult;
  /** Whether the output was valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Whether this was a repair attempt */
  wasRepair: boolean;
  /** Token usage if available */
  tokensUsed: number;
  /** Latency in ms */
  latencyMs: number;
  /** Estimated cost in cents */
  estimatedCostCents: number;
}

// ---------------------------------------------------------------------------
// Manager review call helper
// ---------------------------------------------------------------------------

export function buildManagerReviewMessage(
  role: RoleSpec,
  result: WorkerResult,
  workerRawContent: string
): string {
  return JSON.stringify({
    role: {
      roleId: role.roleId,
      name: role.name,
      mission: role.mission,
      successCriteria: role.successCriteria,
      guardrails: role.guardrails,
    },
    story: result.story,
    selfAssessment: result.selfAssessment,
    rawOutput: workerRawContent.slice(0, 2000),
  });
}

// ---------------------------------------------------------------------------
// Parse helpers (mirrors hermes.ts)
// ---------------------------------------------------------------------------

function extractJsonObject(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, "");
  t = t.replace(/\n?```\s*$/, "");
  const firstBrace = t.indexOf("{");
  if (firstBrace < 0) return t;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < t.length; i++) {
    const char = t[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return t.slice(firstBrace, i + 1);
    }
  }
  return t.slice(firstBrace);
}

export function parseEditorialPlanJson(rawContent: string): EditorialPlan {
  const json = JSON.parse(extractJsonObject(rawContent));
  return EditorialPlanSchema.parse(json);
}

export function parseWorkerResultJson(
  rawContent: string,
  roleId: string,
  editionKey: string
): WorkerResult {
  const json = JSON.parse(extractJsonObject(rawContent));
  const parsed = WorkerResultInputSchema.parse(json);
  return {
    roleId,
    resultId: "",
    editionKey,
    story: { ...parsed.story },
    selfAssessment: { ...parsed.selfAssessment },
    rawResponse: rawContent,
    validationStatus: "valid",
    validationErrors: [],
    repairAttempted: false,
    tokensUsed: 0,
    estimatedCostCents: 0,
    latencyMs: 0,
  };
}

export function validateWorkerResult(
  rawContent: string
): { valid: boolean; errors: string[] } {
  try {
    const json = JSON.parse(extractJsonObject(rawContent));
    WorkerResultInputSchema.parse(json);
    return { valid: true, errors: [] };
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.errors.map(
          (e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`
        ),
      };
    }
    return { valid: false, errors: [err?.message || "Unknown parse error"] };
  }
}
