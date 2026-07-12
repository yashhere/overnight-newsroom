// ---------------------------------------------------------------------------
// Convex HTTP client wrapper for the ingestion service
// ---------------------------------------------------------------------------

import { ConvexHttpClient } from "convex/browser";

/**
 * We use string-based mutation names rather than generated API types
 * because this package runs outside the Convex monorepo workspace and
 * the _generated/ types may not be available at build time.
 *
 * In production, after `npx convex dev --once` generates the API types,
 * you can switch to typed calls by importing from convex/_generated/api.
 */

const client = new ConvexHttpClient(process.env.CONVEX_URL || "");

// Use string-based mutation names (pragmatic for build-time before codegen).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callMutation(name: string, args: Record<string, unknown>): Promise<any> {
  return (client as any).mutation(name, args);
}

function secret(): string {
  const s = process.env.INGESTION_API_SECRET;
  if (!s) {
    throw new Error(
      "INGESTION_API_SECRET environment variable is required"
    );
  }
  return s;
}

// ---------------------------------------------------------------------------
// Ingestion mutations
// ---------------------------------------------------------------------------

export async function startIngestionRun(args: {
  runId: string;
  trigger: "scheduled" | "manual";
  serviceVersion?: string;
  feedCount: number;
  startedAt: number;
}) {
  return callMutation("ingestion:startIngestionRun", {
    secret: secret(),
    ...args,
  });
}

export async function finishIngestionRun(args: {
  runId: string;
  status: "success" | "partial" | "failed";
  feedsSucceeded: number;
  feedsFailed: number;
  itemsSeen: number;
  clustersCreated: number;
  clustersUpdated: number;
  duplicatesSkipped: number;
  errorSummary?: string;
}) {
  return callMutation("ingestion:finishIngestionRun", {
    secret: secret(),
    ...args,
  });
}

export async function ingestClusters(args: {
  runId: string;
  clusters: Array<{
    titleHash: string;
    leadTitle: string;
    normalizedTitle: string;
    alternateHeadlines: string[];
    outletNames: string[];
    outletCount: number;
    beat: string;
    language: string;
    country: string;
    publishedAt?: number;
    feedUrl: string;
    googleNewsUrl: string;
    rssGuid?: string;
    rssPublishedAt?: number;
    rssTitle: string;
    rssDescriptionText?: string;
    retrievedAt: number;
  }>;
}) {
  return callMutation("ingestion:ingestClusters", {
    secret: secret(),
    ...args,
  });
}

export async function logIngestionEvent(args: {
  eventId: string;
  runId?: string;
  clusterId?: string;
  hermesCallId?: string;
  family: "ingestion" | "enrichment" | "source" | "cost" | "health" | "exception";
  type: string;
  severity: "debug" | "info" | "warning" | "error";
  message: string;
  dataRedacted?: string;
  createdAt: number;
}) {
  return callMutation("ingestion:logIngestionEvent", {
    secret: secret(),
    ...args,
  });
}

// ---------------------------------------------------------------------------
// Enrichment mutations
// ---------------------------------------------------------------------------

export async function claimPending(args: {
  max: number;
  now: number;
}) {
  return callMutation("enrichment:claimPending", {
    secret: secret(),
    ...args,
  });
}

export async function saveEnrichment(args: {
  clusterId: string;
  callId: string;
  runId?: string;
  summaryBullets: string[];
  whyItMatters: string;
  suggestedBeat: string;
  confidence: number;
  missingContext: string[];
  canonicalPublisherUrl?: string;
  extractionConfidence?: number;
  summaryPromptVersion: string;
  hermesCallStartedAt: number;
  hermesCallFinishedAt: number;
  hermesCallLatencyMs: number;
  hermesCallHttpStatus: number;
  hermesCallModel: string;
  hermesCallPromptVersion: string;
  hermesCallBaseUrlHost: string;
  hermesCallInputTokens?: number;
  hermesCallOutputTokens?: number;
  hermesCallTotalTokens?: number;
  hermesCallUsageSource: "provider" | "estimated" | "none";
  hermesCallEstimatedCostCents?: number;
  hermesCallRequestSummary: string;
  hermesCallResponseSummary: string;
}) {
  return callMutation("enrichment:saveEnrichment", {
    secret: secret(),
    ...args,
  });
}

export async function markDuplicate(args: {
  clusterId: string;
  callId: string;
  runId?: string;
  duplicateOf?: string;
  duplicateReason: string;
  hermesCallStartedAt: number;
  hermesCallFinishedAt: number;
  hermesCallLatencyMs: number;
  hermesCallHttpStatus?: number;
  hermesCallModel: string;
  hermesCallPromptVersion: string;
  hermesCallBaseUrlHost: string;
  hermesCallInputTokens?: number;
  hermesCallOutputTokens?: number;
  hermesCallTotalTokens?: number;
  hermesCallUsageSource: "provider" | "estimated" | "none";
  hermesCallEstimatedCostCents?: number;
  hermesCallRequestSummary: string;
  hermesCallResponseSummary: string;
}) {
  return callMutation("enrichment:markDuplicate", {
    secret: secret(),
    ...args,
  });
}

export async function markThin(args: {
  clusterId: string;
  callId: string;
  runId?: string;
  reason: string;
  hermesCallStatus: "failed" | "timeout" | "parse_error";
  hermesCallStartedAt: number;
  hermesCallFinishedAt?: number;
  hermesCallLatencyMs?: number;
  hermesCallHttpStatus?: number;
  hermesCallModel: string;
  hermesCallPromptVersion: string;
  hermesCallBaseUrlHost: string;
  hermesCallInputTokens?: number;
  hermesCallOutputTokens?: number;
  hermesCallTotalTokens?: number;
  hermesCallUsageSource: "provider" | "estimated" | "none";
  hermesCallEstimatedCostCents?: number;
  hermesCallRequestSummary: string;
  hermesCallResponseSummary?: string;
  hermesCallErrorClass?: string;
  hermesCallErrorMessage?: string;
}) {
  return callMutation("enrichment:markThin", {
    secret: secret(),
    ...args,
  });
}

// ---------------------------------------------------------------------------
// Editorial mutations (ONR-004)
// ---------------------------------------------------------------------------

export async function upsertEditorialPlan(args: {
  planId: string;
  editionKey: string;
  editorialDirection: string;
  sectionNames: string[];
  sectionDescriptions: string[];
  roleIds: string[];
  dormantBeats: string[];
  dormantRationale: string;
  totalTokenBudget: number;
  concurrencyLimit: number;
  inputDigest: string;
  rawHermesResponse: string;
  costCents: number;
}) {
  return callMutation("editorial:upsertEditorialPlan", {
    secret: secret(),
    ...args,
  });
}

export async function upsertRoleSpec(args: {
  planId: string;
  editionKey: string;
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
  wasNamed: boolean;
  rawHermesResponse: string;
}) {
  return callMutation("editorial:upsertRoleSpec", {
    secret: secret(),
    ...args,
  });
}

export async function upsertWorkerResult(args: {
  editionKey: string;
  resultId: string;
  roleId: string;
  title: string;
  summary: string;
  summaryBullets: string[];
  beat: string;
  confidence: number;
  sourceUrls: string[];
  sourceNames: string[];
  meetsCriteria: boolean;
  selfAssessmentReasoning: string;
  validationStatus: "valid" | "invalid" | "repaired";
  validationErrors: string[];
  repairAttempted: boolean;
  repairDetail?: string;
  rawResponse: string;
  tokensUsed: number;
  estimatedCostCents: number;
  latencyMs: number;
}) {
  return callMutation("editorial:upsertWorkerResult", {
    secret: secret(),
    ...args,
  });
}

export async function recordRevision(args: {
  loopId: string;
  editionKey: string;
  roleId: string;
  originalResultId: string;
  revisedResultId?: string;
  concerns: string[];
  suggestions: string[];
  severity: "required" | "optional";
  disposition: "pending" | "accepted" | "rejected";
  round: number;
  createdAt: number;
}) {
  return callMutation("editorial:recordRevision", {
    secret: secret(),
    ...args,
  });
}

export async function saveMemory(args: {
  memoryId: string;
  kind: "lesson" | "role_pattern" | "editorial_rule" | "guardrail";
  content: string;
  tags: string[];
  provenance: string;
  confidence: number;
  createdAt: number;
}) {
  return callMutation("editorial:saveMemory", {
    secret: secret(),
    ...args,
  });
}

// ---------------------------------------------------------------------------
// Eval mutations (ONR-004/005)
// ---------------------------------------------------------------------------

export async function upsertEvalCase(args: {
  evalId: string;
  category: string;
  description: string;
  inputDigest: string;
  expectedBehavior: string;
  promptVersionAtCapture: string;
  source: "seeded" | "captured";
  provenanceEdition?: string;
  provenanceRoleId?: string;
  notes: string;
}) {
  return callMutation("editorial:upsertEvalCase", {
    secret: secret(),
    ...args,
  });
}

export async function recordEvalRun(args: {
  runId: string;
  evalSet: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byCategoryJson: string;
  promptVersion: string;
  source: "manual" | "ci" | "pre-commit";
}) {
  return callMutation("editorial:recordEvalRun", {
    secret: secret(),
    ...args,
  });
}
