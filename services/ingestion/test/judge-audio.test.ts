// ---------------------------------------------------------------------------
// Judge + Audio pipeline evals (ONR-005, ONR-006)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  decomposeLineIntoClaims,
  decomposeScriptIntoClaims,
  checkClaimAgainstReceipts,
  gateScript,
  publicEvidenceView,
  judgeEdition,
  type JudgeSession,
} from "../src/judge.js";
import {
  assembleScript,
  addPronunciationHints,
  validateGatedInput,
} from "../../audio/src/pipeline.js";
import type {
  WorkerResult,
  JudgeClaim,
  JudgeResult,
  ClaimVerdictResult,
  AudioScript,
} from "../src/types.js";

// ---------------------------------------------------------------------------
// Worker result factories
// ---------------------------------------------------------------------------

function mkWorker(
  roleId: string,
  title: string,
  bullets: string[],
  summary: string,
  sources: Array<{ url: string; name: string; accessed: boolean }>,
  confidence = 0.8
): WorkerResult {
  return {
    roleId,
    resultId: randomUUID(),
    editionKey: "test-edition",
    story: { title, summary, summaryBullets: bullets, beat: "business", confidence, sources },
    selfAssessment: { meetsCriteria: true, reasoning: "ok" },
    rawResponse: "{}",
    validationStatus: "valid",
    validationErrors: [],
    repairAttempted: false,
    tokensUsed: 100,
    estimatedCostCents: 1,
    latencyMs: 50,
  };
}

const SUPPORTED_WORKER = mkWorker(
  "economy-tracker",
  "Fed holds rates steady at 5.25%",
  [
    "Federal Reserve kept interest rates unchanged at 5.25-5.50%",
    "Inflation remains above the 2% target",
    "Markets rallied following the decision",
  ],
  "The Fed held rates steady. Markets responded positively.",
  [{ url: "https://federalreserve.gov/press", name: "Federal Reserve", accessed: true }],
  0.85,
);

const FABRICATED_WORKER = mkWorker(
  "world-desk",
  "UN votes to ban all carbon emissions",
  [
    "UN General Assembly voted unanimously to ban carbon emissions globally by 2027",
    "All 193 member states signed the binding treaty",
    "Fossil fuel companies ordered to cease operations",
  ],
  "The UN has voted to ban carbon emissions. This is a fabricated claim for testing.",
  [{ url: "https://un.org/fake", name: "Unknown Source", accessed: false }],
  0.2,
);

const MIXED_WORKER = mkWorker(
  "politics-desk",
  "Supreme Court to hear antitrust case",
  [
    "Supreme Court agreed to hear a major tech antitrust case",
    "The case centers on app store competition",
    "CEO personally called each justice to lobby for dismissal",
  ],
  "SCOTUS will hear a tech antitrust case. The CEO allegedly lobbied justices.",
  [
    { url: "https://supremecourt.gov/docket", name: "SCOTUS", accessed: true },
    { url: "https://reuters.com/tech", name: "Reuters", accessed: false },
  ],
  0.65,
);

// ---------------------------------------------------------------------------
// S1: Claim decomposition
// ---------------------------------------------------------------------------

describe("S1: Claim decomposition", () => {
  it("splits a sentence into atomic claims", () => {
    const claims = decomposeLineIntoClaims(
      "Fed raised rates by 25bps. Markets fell 2%.",
      "story-1",
      "role-1",
      "edition-1",
    );
    expect(claims.length).toBe(2);
    expect(claims[0].claim).toContain("Fed");
    expect(claims[1].claim).toContain("Markets");
  });

  it("splits on semicolons within a sentence", () => {
    const claims = decomposeLineIntoClaims(
      "Inflation rose to 4.2%; unemployment fell to 3.5%; GDP grew 1.8%.",
      "story-1",
      "role-1",
      "edition-1",
    );
    expect(claims.length).toBeGreaterThanOrEqual(2);
  });

  it("skips sentences shorter than 10 characters", () => {
    const claims = decomposeLineIntoClaims(
      "OK. Fed raised rates by 25 basis points today.",
      "story-1",
      "role-1",
      "edition-1",
    );
    expect(claims.length).toBe(1);
    expect(claims[0].claim).toContain("Fed");
  });

  it("decomposes worker results into claims from bullets and summary", () => {
    const claims = decomposeScriptIntoClaims([SUPPORTED_WORKER], "edition-1");
    expect(claims.length).toBeGreaterThanOrEqual(3); // 3 bullets + summary
  });

  it("skips invalid workers", () => {
    const invalid = { ...SUPPORTED_WORKER, validationStatus: "invalid" as const };
    const claims = decomposeScriptIntoClaims([invalid], "edition-1");
    expect(claims.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S2: Receipt check
// ---------------------------------------------------------------------------

describe("S2: Receipt check", () => {
  it("corroborates a claim backed by accessed sources", () => {
    const { corroborated, evidence } = checkClaimAgainstReceipts(
      "Federal Reserve kept interest rates unchanged at 5.25%",
      SUPPORTED_WORKER,
    );
    expect(corroborated).toBe(true);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].url).toContain("federalreserve.gov");
  });

  it("does not corroborate a claim with no accessed sources", () => {
    const { corroborated } = checkClaimAgainstReceipts(
      "UN bans all carbon emissions by 2027",
      FABRICATED_WORKER,
    );
    expect(corroborated).toBe(false);
  });

  it("partially corroborates when source accessed but has no matching URL", () => {
    // Source was not accessed and has a fake URL
    const { corroborated } = checkClaimAgainstReceipts(
      "CEO called each justice",
      MIXED_WORKER,
    );
    // Reuters was not accessed, SCOTUS was accessed but doesn't contain CEO call info
    expect(corroborated).toBe(true); // At least one source was accessed
  });
});

// ---------------------------------------------------------------------------
// S3: Gate script
// ---------------------------------------------------------------------------

describe("S3: Gate script", () => {
  it("passes through approved claims", () => {
    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: [
        { claimId: "c1", verdict: "approved", reason: "Corroborated", evidence: [], receiptsCorroborated: true, linkupCorroborated: false, confidence: 0.9, tokensUsed: 10, estimatedCostCents: 1, latencyMs: 5 },
        { claimId: "c2", verdict: "approved", reason: "Corroborated", evidence: [], receiptsCorroborated: true, linkupCorroborated: false, confidence: 0.85, tokensUsed: 10, estimatedCostCents: 1, latencyMs: 5 },
      ],
      approved: 2, blocked: 0, revised: 0, escalated: 0,
      totalTokensUsed: 20, totalCostCents: 2, totalLatencyMs: 10,
    };

    const { gatedResults, blockedClaims } = gateScript(
      [SUPPORTED_WORKER],
      judgeResult,
    );
    expect(blockedClaims.length).toBe(0);
    expect(gatedResults.length).toBe(1);
  });

  it("produces blocked claims for blocked verdicts", () => {
    // Decompose the script first to get claim IDs
    const claims = decomposeScriptIntoClaims([FABRICATED_WORKER], "edition-1");
    const blockedVerdicts: ClaimVerdictResult[] = claims.map((c) => ({
      claimId: c.claimId,
      verdict: "block" as const,
      reason: "Fabricated — no supporting evidence",
      evidence: [],
      receiptsCorroborated: false,
      linkupCorroborated: false,
      confidence: 0.1,
      tokensUsed: 5,
      estimatedCostCents: 0,
      latencyMs: 2,
    }));

    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: blockedVerdicts,
      approved: 0, blocked: blockedVerdicts.length, revised: 0, escalated: 0,
      totalTokensUsed: 10, totalCostCents: 1, totalLatencyMs: 5,
    };

    const { blockedClaims } = gateScript([FABRICATED_WORKER], judgeResult, claims);
    expect(blockedClaims.length).toBeGreaterThanOrEqual(1);
    expect(blockedClaims[0].roleId).toBe("world-desk");
  });

  it("reduces confidence for workers with blocked claims", () => {
    const claims = decomposeScriptIntoClaims([MIXED_WORKER], "edition-1");
    const mixedVerdicts: ClaimVerdictResult[] = claims.map((c, i) => ({
      claimId: c.claimId,
      verdict: i === claims.length - 1 ? "block" as const : "approved" as const,
      reason: i === claims.length - 1 ? "Fabricated claim about CEO" : "Corroborated",
      evidence: [],
      receiptsCorroborated: i !== claims.length - 1,
      linkupCorroborated: false,
      confidence: i === claims.length - 1 ? 0.1 : 0.8,
      tokensUsed: 5,
      estimatedCostCents: 0,
      latencyMs: 2,
    }));

    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: mixedVerdicts,
      approved: mixedVerdicts.length - 1, blocked: 1, revised: 0, escalated: 0,
      totalTokensUsed: 10, totalCostCents: 1, totalLatencyMs: 5,
    };

    const { gatedResults, blockedClaims } = gateScript([MIXED_WORKER], judgeResult, claims);
    expect(blockedClaims.length).toBe(1);
    // Worker confidence should be reduced
    expect(gatedResults[0].story.confidence).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// S4: Public evidence view
// ---------------------------------------------------------------------------

describe("S4: Public evidence view", () => {
  it("shows only approved claims with evidence URLs", () => {
    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: [
        {
          claimId: "Fed held rates at 5.25-5.50%",
          verdict: "approved",
          reason: "Corroborated by Federal Reserve press release",
          evidence: [{ url: "https://federalreserve.gov/press", name: "Federal Reserve", accessed: true, linkupUsed: false }],
          receiptsCorroborated: true,
          linkupCorroborated: false,
          confidence: 0.95,
          tokensUsed: 10, estimatedCostCents: 1, latencyMs: 5,
        },
        {
          claimId: "UN bans all emissions",
          verdict: "block",
          reason: "Fabricated — no supporting evidence",
          evidence: [{ url: "", name: "Unknown", accessed: false, linkupUsed: false }],
          receiptsCorroborated: false,
          linkupCorroborated: false,
          confidence: 0.05,
          tokensUsed: 10, estimatedCostCents: 1, latencyMs: 5,
        },
      ],
      approved: 1, blocked: 1, revised: 0, escalated: 0,
      totalTokensUsed: 20, totalCostCents: 2, totalLatencyMs: 10,
    };

    const view = publicEvidenceView(judgeResult);
    expect(view.length).toBe(1); // only approved claims
    expect(view[0].claim).toContain("Fed");
    expect(view[0].evidenceUrls).toContain("https://federalreserve.gov/press");
  });
});

// ---------------------------------------------------------------------------
// S5: Judge edition pipeline (with mock judge session)
// ---------------------------------------------------------------------------

describe("S5: Judge edition pipeline", () => {
  it("judgeEdition with mock judge session returns verdicts", async () => {
    const judgeSession: JudgeSession = vi.fn().mockResolvedValue({
      rawContent: JSON.stringify({
        claims: [
          { claimId: "mock-c1", verdict: "approved", reason: "Test approved", evidence: [], receiptsCorroborated: true, linkupCorroborated: false, confidence: 0.9 },
        ],
      }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latencyMs: 100,
      ok: true,
    });

    const result = await judgeEdition(
      [SUPPORTED_WORKER],
      "edition-1",
      judgeSession,
    );

    expect(result.verdicts.length).toBeGreaterThanOrEqual(1);
    expect(result.approved).toBeGreaterThanOrEqual(1);
  });

  it("falls back to deterministic verdict when judge parse fails", async () => {
    const judgeSession: JudgeSession = vi.fn().mockResolvedValue({
      rawContent: "not json at all",
      usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      latencyMs: 50,
      ok: true,
    });

    const result = await judgeEdition(
      [SUPPORTED_WORKER],
      "edition-1",
      judgeSession,
    );

    // Should still produce verdicts via fallback
    expect(result.verdicts.length).toBeGreaterThanOrEqual(1);
    // Supported worker has accessed sources, so claims should be approved
    expect(result.approved).toBeGreaterThanOrEqual(1);
    expect(result.blocked).toBe(0);
  });

  it("fabricated worker without receipts gets blocked in fallback mode", async () => {
    const judgeSession: JudgeSession = vi.fn().mockResolvedValue({
      rawContent: "broken",
      usage: {},
      latencyMs: 10,
      ok: true,
    });

    const result = await judgeEdition(
      [FABRICATED_WORKER],
      "edition-1",
      judgeSession,
    );

    // Fabricated worker has no accessed sources — should be blocked
    expect(result.blocked).toBeGreaterThanOrEqual(1);
    expect(result.approved).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S6: Audio script assembly
// ---------------------------------------------------------------------------

describe("S6: Audio script assembly", () => {
  it("assembleScript produces alternating A/B anchor turns", () => {
    const script = assembleScript([SUPPORTED_WORKER], "edition-1");

    expect(script.language).toBe("en");
    expect(script.turns.length).toBeGreaterThanOrEqual(5); // intro A + intro B + headline + 3 bullets + sign-off

    // First turn is anchor A, second is anchor B
    expect(script.turns[0].anchor).toBe("A");
    expect(script.turns[1].anchor).toBe("B");

    // Headline turn is a chapter start
    const chapterTurns = script.turns.filter((t) => t.isChapterStart);
    expect(chapterTurns.length).toBe(1);
    expect(chapterTurns[0].storyKey).toContain("economy-tracker");
  });

  it("chapterMap maps story keys to turn indices", () => {
    const script = assembleScript([SUPPORTED_WORKER, MIXED_WORKER], "edition-1");
    expect(Object.keys(script.chapterMap).length).toBe(2);

    for (const [key, idx] of Object.entries(script.chapterMap)) {
      expect(script.turns[idx].isChapterStart).toBe(true);
      expect(script.turns[idx].storyKey).toBe(key);
    }
  });

  it("word count is approximately under 300", () => {
    const script = assembleScript([SUPPORTED_WORKER, MIXED_WORKER], "edition-1");
    expect(script.wordCount).toBeLessThanOrEqual(320);
    expect(script.wordCount).toBeGreaterThan(10);
  });

  it("adds pronunciation hints for known terms", () => {
    const script = assembleScript([SUPPORTED_WORKER], "edition-1");
    const hinted = addPronunciationHints(script);

    const hasHints = hinted.turns.some((t) => t.pronunciation !== undefined);
    expect(hasHints).toBe(true);
  });

  it("skips invalid workers in script assembly", () => {
    const invalid = { ...SUPPORTED_WORKER, validationStatus: "invalid" as const };
    const script = assembleScript([invalid], "edition-1");
    // Only intro/sign-off turns, no story content
    expect(script.turns.length).toBe(3); // intro A, intro B, sign-off
    expect(Object.keys(script.chapterMap).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S7: Gated input validation
// ---------------------------------------------------------------------------

describe("S7: Gated input validation", () => {
  it("rejects input with blocked claims", () => {
    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: [
        { claimId: "c1", verdict: "block", reason: "Fabricated", evidence: [], receiptsCorroborated: false, linkupCorroborated: false, confidence: 0.1, tokensUsed: 5, estimatedCostCents: 0, latencyMs: 2 },
      ],
      approved: 0, blocked: 1, revised: 0, escalated: 0,
      totalTokensUsed: 5, totalCostCents: 0, totalLatencyMs: 2,
    };

    const { valid, blocked } = validateGatedInput([SUPPORTED_WORKER], judgeResult);
    expect(valid).toBe(false);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects input with escalated claims", () => {
    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: [
        { claimId: "c1", verdict: "escalate", reason: "Conflicting sources", evidence: [], receiptsCorroborated: true, linkupCorroborated: true, conflictDetail: "Two outlets, different numbers", confidence: 0.4, tokensUsed: 10, estimatedCostCents: 1, latencyMs: 5 },
      ],
      approved: 0, blocked: 0, revised: 0, escalated: 1,
      totalTokensUsed: 10, totalCostCents: 1, totalLatencyMs: 5,
    };

    const { valid, blocked } = validateGatedInput([SUPPORTED_WORKER], judgeResult);
    expect(valid).toBe(false);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts clean verdict with all approved claims", () => {
    const judgeResult: JudgeResult = {
      editionKey: "edition-1",
      verdicts: [
        { claimId: "c1", verdict: "approved", reason: "Corroborated", evidence: [], receiptsCorroborated: true, linkupCorroborated: false, confidence: 0.9, tokensUsed: 5, estimatedCostCents: 0, latencyMs: 2 },
      ],
      approved: 1, blocked: 0, revised: 0, escalated: 0,
      totalTokensUsed: 5, totalCostCents: 0, totalLatencyMs: 2,
    };

    const { valid, blocked } = validateGatedInput([SUPPORTED_WORKER], judgeResult);
    expect(valid).toBe(true);
    expect(blocked.length).toBe(0);
  });
});
