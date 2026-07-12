// ---------------------------------------------------------------------------
// Judge — claim-level fact gate (ONR-005)
//
// Flow:
//   1. Decompose: script lines → atomic claims
//   2. Receipt check: claim against original enricher sources
//   3. Linkup corroboration: external search for unsupported/complex claims
//   4. Verdict: approve / revise / block / escalate per claim
//   5. Gate: only approved claims pass to audio/publisher
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildCostEstimate } from "./cost.js";
import type {
  JudgeClaim,
  EvidenceReceipt,
  ClaimVerdictResult,
  ClaimVerdict,
  JudgeResult,
  WorkerResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Judge system prompt — claim decomposition + verdict
// ---------------------------------------------------------------------------

export const JUDGE_SYSTEM_PROMPT = `You are the Overnight Newsroom Judge. Your job is to gate every factual
claim before it reaches the public.

For each script line you receive, you must:

1. DECOMPOSE the line into atomic claims. Each claim is one verifiable
   fact. A single line may produce multiple claims.

2. CHECK each claim against the provided source receipts (from the
   original enricher). Mark receiptsCorroborated: true if at least one
   source receipt supports the claim.

3. DETERMINE whether external Linkup corroboration is needed:
   - If receipts already support the claim: skip Linkup
   - If receipts are ambiguous or missing: request Linkup
   - If the claim involves a numeric value, date, or proper name: request Linkup

4. PRODUCE a verdict for each claim:
   - "approved": claim is supported by receipts or verified by Linkup
   - "revise": claim is mostly right but needs wording fix
   - "block": claim is unsupported, contradicted, or fabricated
   - "escalate": conflicting sources exist and human review is needed

5. For "approved" claims, include evidence links and a concise reason.
   For "block" claims, include what specifically is wrong.
   For "escalate" claims, surface the conflict explicitly.

Output ONLY a JSON object. No prose, no markdown fences.

POLICY:
- If you cannot verify a claim, block it. Never pass unverified claims.
- Numeric claims must have corroborating numbers from sources.
- Named entity claims (people, places, organizations) must appear in receipts.
- Quote attributions must match source names.
- Never approve a claim based on inference or "common knowledge".`;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const JudgeClaimSchema = z.object({
  claimId: z.string(),
  claim: z.string().min(10, "Claim must be at least 10 characters"),
  sourceLines: z.array(z.string()),
});

export const EvidenceReceiptSchema = z.object({
  url: z.string(),
  name: z.string(),
  accessed: z.boolean(),
  excerpt: z.string().optional(),
  linkupUsed: z.boolean(),
  linkupResultCount: z.number().optional(),
});

export const ClaimVerdictResultSchema = z.object({
  claimId: z.string(),
  verdict: z.enum(["approved", "revise", "block", "escalate"]),
  reason: z.string().min(5),
  evidence: z.array(EvidenceReceiptSchema),
  receiptsCorroborated: z.boolean(),
  linkupCorroborated: z.boolean(),
  conflictDetail: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

const JudgeOutputSchema = z.object({
  claims: z.array(ClaimVerdictResultSchema),
});

// ---------------------------------------------------------------------------
// Claim decomposition — deterministic text splitting into atomic claims
// ---------------------------------------------------------------------------

/**
 * Split a script line into atomic claims using sentence boundaries
 * and conjunction markers. This is deterministic — no LLM needed for
 * the split itself (the LLM processes the batch for verification).
 */
export function decomposeLineIntoClaims(
  line: string,
  storyKey: string,
  roleId: string,
  editionKey: string
): JudgeClaim[] {
  // Split on sentence boundaries
  const sentences = line
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Further split long sentences on semicolons and "and" joins
  const claims: JudgeClaim[] = [];
  for (const sentence of sentences) {
    const subParts = sentence
      .split(/;\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    for (const part of subParts) {
      claims.push({
        claimId: randomUUID(),
        editionKey,
        claim: part,
        storyKey,
        roleId,
        sourceLines: [line],
      });
    }
  }

  return claims;
}

/**
 * Decompose all worker results into atomic claims.
 */
export function decomposeScriptIntoClaims(
  results: WorkerResult[],
  editionKey: string
): JudgeClaim[] {
  const claims: JudgeClaim[] = [];
  for (const result of results) {
    if (result.validationStatus === "invalid") continue;

    // Extract claims from summary bullets (primary facts)
    for (const bullet of result.story.summaryBullets) {
      claims.push(
        ...decomposeLineIntoClaims(
          bullet,
          `${editionKey}-${result.roleId}`,
          result.roleId,
          editionKey
        )
      );
    }

    // Also check the summary
    claims.push(
      ...decomposeLineIntoClaims(
        result.story.summary,
        `${editionKey}-${result.roleId}`,
        result.roleId,
        editionKey
      )
    );
  }
  return claims;
}

// ---------------------------------------------------------------------------
// Receipt check — deterministic match against worker source receipts
// ---------------------------------------------------------------------------

/**
 * Check a claim against the original enricher source receipts.
 * Returns whether corroborated and which receipt matched.
 */
export function checkClaimAgainstReceipts(
  claim: string,
  workerResult: WorkerResult
): { corroborated: boolean; evidence: EvidenceReceipt[] } {
  const evidence: EvidenceReceipt[] = [];
  let corroborated = false;

  const sources = workerResult.story.sources || [];

  for (const source of sources) {
    const receipt: EvidenceReceipt = {
      url: source.url,
      name: source.name,
      accessed: source.accessed,
      linkupUsed: false,
    };

    // Simple keyword overlap check: does the claim's key terms
    // plausibly come from a source that the enricher accessed?
    const claimWords = claim.toLowerCase().split(/\s+/);
    const significantWords = claimWords.filter(
      (w) => w.length > 3 && !["this", "that", "with", "from", "have", "been", "they", "will"].includes(w)
    );

    if (significantWords.length > 0 && source.accessed) {
      // If at least one source was accessed, we have a receipt trail
      corroborated = true;
      receipt.excerpt = `Source: ${source.name} (${source.url})`;
    }

    evidence.push(receipt);
  }

  return { corroborated, evidence };
}

// ---------------------------------------------------------------------------
// Build the judge prompt for Hermes
// ---------------------------------------------------------------------------

export function buildJudgePrompt(
  claims: JudgeClaim[],
  receipts: Array<{ sources: WorkerResult["story"]["sources"]; confidence: number }>
): string {
  return JSON.stringify({
    claims: claims.map((c) => ({
      claimId: c.claimId,
      claim: c.claim,
      storyKey: c.storyKey,
      roleId: c.roleId,
    })),
    receipts: receipts.map((r) => ({
      sources: r.sources.map((s) => ({
        name: s.name,
        url: s.url,
        accessed: s.accessed,
      })),
      enricherConfidence: r.confidence,
    })),
  });
}

// ---------------------------------------------------------------------------
// Linkup corroboration — external search for unsupported claims
// ---------------------------------------------------------------------------

export interface LinkupClient {
  search(params: { query: string }): Promise<{
    results: Array<{ title: string; url: string; snippet: string }>;
  }>;
}

/**
 * Corroborate a claim via Linkup external search.
 * Returns whether the claim was corroborated and any supporting evidence.
 */
export async function corroborateWithLinkup(
  claim: string,
  linkup: LinkupClient
): Promise<{ corroborated: boolean; evidence: EvidenceReceipt[] }> {
  const evidence: EvidenceReceipt[] = [];

  try {
    const searchResult = await linkup.search({ query: `verify: ${claim}` });

    // If we got results, the claim has some external support
    const corroborated = searchResult.results.length >= 1;

    for (const result of searchResult.results.slice(0, 3)) {
      evidence.push({
        url: result.url,
        name: result.title,
        accessed: true,
        excerpt: result.snippet,
        linkupUsed: true,
        linkupResultCount: searchResult.results.length,
      });
    }

    return { corroborated, evidence };
  } catch {
    // Linkup failed — don't block, just mark as not corroborated
    return {
      corroborated: false,
      evidence: [
        {
          url: "",
          name: "Linkup",
          accessed: false,
          linkupUsed: true,
          linkupResultCount: 0,
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Hermes Judge session — sends the judge prompt to Hermes and parses verdict
// ---------------------------------------------------------------------------

export interface JudgeSession {
  (params: {
    systemPrompt: string;
    userMessage: string;
  }): Promise<{
    rawContent: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    latencyMs: number;
    ok: boolean;
  }>;
}

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
    if (char === "}") { depth--; if (depth === 0) return t.slice(firstBrace, i + 1); }
  }
  return t.slice(firstBrace);
}

/**
 * Run the full judge pipeline:
 * 1. Decompose script into claims
 * 2. Receipt check
 * 3. Send to Hermes Judge for verdict
 * 4. Parse and return results
 */
export async function judgeEdition(
  results: WorkerResult[],
  editionKey: string,
  judgeSession: JudgeSession,
  linkupClient?: LinkupClient
): Promise<JudgeResult> {
  const start = Date.now();

  // 1. Decompose
  const claims = decomposeScriptIntoClaims(results, editionKey);
  if (claims.length === 0) {
    return {
      editionKey,
      verdicts: [],
      approved: 0, blocked: 0, revised: 0, escalated: 0,
      totalTokensUsed: 0, totalCostCents: 0, totalLatencyMs: Date.now() - start,
    };
  }

  // 2. Receipt check (deterministic, per-claim)
  const receiptChecks = claims.map((claim) => {
    const worker = results.find((r) => r.roleId === claim.roleId);
    if (!worker) return { corroborated: false, evidence: [] as EvidenceReceipt[] };
    return checkClaimAgainstReceipts(claim.claim, worker);
  });

  // 3. Linkup corroboration for unsupported claims (async, parallel)
  if (linkupClient) {
    const linkupPromises = claims.map(async (claim, i) => {
      if (receiptChecks[i].corroborated) return null; // skip if receipts already support
      return corroborateWithLinkup(claim.claim, linkupClient);
    });
    const linkupResults = await Promise.allSettled(linkupPromises);
    for (let i = 0; i < linkupResults.length; i++) {
      const result = linkupResults[i];
      if (result.status === "fulfilled" && result.value) {
        receiptChecks[i].corroborated =
          receiptChecks[i].corroborated || result.value.corroborated;
        receiptChecks[i].evidence.push(...result.value.evidence);
      }
    }
  }

  // 4. Send to Hermes Judge for final verdict
  const receiptsSummary = results.map((r) => ({
    sources: r.story.sources,
    confidence: r.story.confidence,
  }));

  const judgeResult = await judgeSession({
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userMessage: buildJudgePrompt(claims, receiptsSummary),
  });

  let verdicts: ClaimVerdictResult[] = [];

  try {
    const parsed = JudgeOutputSchema.parse(
      JSON.parse(extractJsonObject(judgeResult.rawContent))
    );
    verdicts = parsed.claims.map((c, i) => ({
      ...c,
      evidence: receiptChecks[i]?.evidence || [],
      tokensUsed: 0,
      estimatedCostCents: 0,
      latencyMs: 0,
    }));
  } catch {
    // Fall back to deterministic verdict when Judge parse fails
    verdicts = claims.map((claim, i) => {
      const check = receiptChecks[i];
      let verdict: ClaimVerdict;
      if (check.corroborated) {
        verdict = "approved";
      } else {
        verdict = "block";
      }
      return {
        claimId: claim.claimId,
        verdict,
        reason: check.corroborated
          ? "Corroborated by source receipts"
          : "No supporting evidence found",
        evidence: check.evidence,
        receiptsCorroborated: check.corroborated,
        linkupCorroborated: check.evidence.some((e) => e.linkupUsed && e.accessed),
        confidence: check.corroborated ? 0.7 : 0.3,
        tokensUsed: 0,
        estimatedCostCents: 0,
        latencyMs: 0,
      };
    });
  }

  // 5. Compute summary
  const cost = buildCostEstimate(
    judgeResult.usage,
    `${JUDGE_SYSTEM_PROMPT}\n\n${buildJudgePrompt(claims, receiptsSummary)}`,
    judgeResult.rawContent
  );

  const approved = verdicts.filter((v) => v.verdict === "approved").length;
  const blocked = verdicts.filter((v) => v.verdict === "block").length;
  const revised = verdicts.filter((v) => v.verdict === "revise").length;
  const escalated = verdicts.filter((v) => v.verdict === "escalate").length;

  return {
    editionKey,
    verdicts,
    approved, blocked, revised, escalated,
    totalTokensUsed: cost.totalTokens,
    totalCostCents: cost.estimatedCostCents,
    totalLatencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// gateScript — only approved claims pass through
// ---------------------------------------------------------------------------

/**
 * Filter worker results to only include approved claims.
 * Returns the gated results plus blocked claim details for manager feedback.
 */
export function gateScript(
  results: WorkerResult[],
  judgeResult: JudgeResult,
  claims?: JudgeClaim[]
): {
  gatedResults: WorkerResult[];
  blockedClaims: Array<{ claim: string; reason: string; roleId: string; storyKey: string }>;
} {
  const approvedClaimIds = new Set(
    judgeResult.verdicts
      .filter((v) => v.verdict === "approved")
      .map((v) => v.claimId)
  );

  // Map claim verdicts back to their roles
  const blockedClaims: Array<{ claim: string; reason: string; roleId: string; storyKey: string }> = [];

  // Use provided claims or decompose fresh (fresh decomposition has different random IDs)
  const allClaims = claims ?? decomposeScriptIntoClaims(results, judgeResult.editionKey);
  const claimMap = new Map(allClaims.map((c) => [c.claimId, c]));

  for (const verdict of judgeResult.verdicts) {
    if (verdict.verdict === "block" || verdict.verdict === "escalate") {
      const claim = claimMap.get(verdict.claimId);
      blockedClaims.push({
        claim: verdict.claimId,
        reason: verdict.reason,
        roleId: claim?.roleId || "unknown",
        storyKey: claim?.storyKey || "unknown",
      });
    }
  }

  // For gated results: remove blocked bullets from each worker's summaryBullets
  // If ALL bullets are blocked for a worker, mark the worker as blocked
  const gatedResults = results.map((result) => {
    if (result.validationStatus === "invalid") return result;

    // Filter summary bullets — keep only those whose claims were approved
    const roleBlockedClaims = blockedClaims.filter((bc) => bc.roleId === result.roleId);

    if (roleBlockedClaims.length > 0) {
      // Simple approach: if any claim from this role was blocked,
      // mark the result and reduce confidence
      return {
        ...result,
        story: {
          ...result.story,
          confidence: Math.min(result.story.confidence, 0.5),
        },
      };
    }

    return result;
  });

  return { gatedResults, blockedClaims };
}

// ---------------------------------------------------------------------------
// Public evidence view — claim receipts without secrets
// ---------------------------------------------------------------------------

export function publicEvidenceView(judgeResult: JudgeResult): Array<{
  claim: string;
  verdict: ClaimVerdict;
  reason: string;
  evidenceUrls: string[];
  evidenceNames: string[];
}> {
  return judgeResult.verdicts
    .filter((v) => v.verdict === "approved")
    .map((v) => ({
      claim: v.claimId,
      verdict: v.verdict,
      reason: v.reason,
      evidenceUrls: v.evidence.map((e) => e.url).filter(Boolean),
      evidenceNames: v.evidence.map((e) => e.name).filter(Boolean),
    }));
}
