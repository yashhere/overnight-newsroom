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
