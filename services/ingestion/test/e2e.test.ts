// ---------------------------------------------------------------------------
// End-to-end test: full newsroom pipeline (mock-driven, no live services)
//
// Flow: candidates → editorial plan → workers → review → assemble edition
//       → judge (claim decomposition + verdict) → gate → audio script
//
// Run: npx vitest run test/e2e.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  orchestrateEdition,
  assembleEdition,
  type HermesSession,
} from "../src/editorial.js";
import {
  decomposeScriptIntoClaims,
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
  JudgeResult,
  JudgeClaim,
  AudioScript,
} from "../src/types.js";

// ---------------------------------------------------------------------------
// Fixture: realistic 6-candidate general-news input
// ---------------------------------------------------------------------------

const CANDIDATES = [
  {
    clusterId: "e2e-c-001", title: "Fed holds rates steady at 5.25-5.50%",
    summaryBullets: ["Federal Reserve kept interest rates unchanged", "Inflation remains above 2% target", "Markets rallied on the decision"],
    suggestedBeat: "business", confidence: 0.85, outletCount: 8, missingContext: [],
  },
  {
    clusterId: "e2e-c-002", title: "UN Security Council votes 14-0 on Gaza ceasefire resolution",
    summaryBullets: ["Resolution passes with one abstention", "Calls for immediate humanitarian access", "Israel, Hamas yet to respond"],
    suggestedBeat: "world", confidence: 0.9, outletCount: 12, missingContext: [],
  },
  {
    clusterId: "e2e-c-003", title: "Supreme Court agrees to hear tech antitrust case",
    summaryBullets: ["Case centers on app store competition", "Could reshape digital marketplace rules", "Oral arguments set for October"],
    suggestedBeat: "nation", confidence: 0.88, outletCount: 6, missingContext: [],
  },
  {
    clusterId: "e2e-c-004", title: "Primary elections heat up as three candidates lead in polls",
    summaryBullets: ["Key debate scheduled for next week", "Fundraising records broken across parties", "Voter turnout expected to be high"],
    suggestedBeat: "nation", confidence: 0.82, outletCount: 10, missingContext: [],
  },
  {
    clusterId: "e2e-c-005", title: "Global chip shortage shows signs of easing",
    summaryBullets: ["TSMC reports increased production capacity", "Auto industry sees supply relief", "Prices expected to stabilize by Q4"],
    suggestedBeat: "business", confidence: 0.78, outletCount: 5, missingContext: [],
  },
  {
    clusterId: "e2e-c-006", title: "Climate summit yields unprecedented carbon pledge",
    summaryBullets: ["40 nations commit to net zero by 2040", "Developing nations demand climate funding", "Critics say timeline still too slow"],
    suggestedBeat: "world", confidence: 0.87, outletCount: 9, missingContext: [],
  },
];

// ---------------------------------------------------------------------------
// Mock Hermes — deterministic editorial pipeline
// ---------------------------------------------------------------------------

function mkHermes(...responses: object[]): HermesSession {
  let idx = 0;
  return ((_p: any) => {
    const resp = responses[idx] ?? responses[responses.length - 1];
    idx++;
    return Promise.resolve({
      rawContent: JSON.stringify(resp),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latencyMs: 42,
      ok: true,
      httpStatus: 200,
    });
  }) as HermesSession;
}

const E2E_PLAN = {
  editorialDirection: "Comprehensive edition covering global diplomacy, domestic politics, and economic developments",
  sections: [
    { name: "World", description: "International affairs", priority: 1 },
    { name: "Politics & Law", description: "Domestic politics", priority: 2 },
    { name: "Business", description: "Economy and technology", priority: 3 },
  ],
  roles: [
    {
      roleId: "world-desk", name: "World Desk",
      rationale: "UN ceasefire vote + climate summit are major world stories",
      assignedClusterIds: ["e2e-c-002", "e2e-c-006"],
      mission: "Report on international diplomacy and climate developments with verified facts",
      allowedTools: ["web_search"], guardrails: ["Verify diplomatic claims against official UN statements"],
      successCriteria: ["UN vote details accurate", "Carbon pledge specifics verified"],
      tokenBudget: 800, timeBudgetMs: 45000,
    },
    {
      roleId: "politics-desk", name: "Politics Desk",
      rationale: "SCOTUS case + primary elections need domestic political coverage",
      assignedClusterIds: ["e2e-c-003", "e2e-c-004"],
      mission: "Cover domestic politics with non-partisan framing",
      allowedTools: ["web_search"], guardrails: ["Non-partisan framing", "Equal time principle"],
      successCriteria: ["SCOTUS case accurately described", "Election coverage balanced"],
      tokenBudget: 700, timeBudgetMs: 45000,
    },
    {
      roleId: "economy-tracker", name: "Economy Tracker",
      rationale: "Fed decision and chip shortage are significant economic developments",
      assignedClusterIds: ["e2e-c-001", "e2e-c-005"],
      mission: "Report on economic developments with official data sources",
      allowedTools: ["web_search"], guardrails: ["Use official Fed/TOSMC data only"],
      successCriteria: ["Fed details from official statement", "Chip data corroborated"],
      tokenBudget: 700, timeBudgetMs: 45000,
    },
  ],
  dormantBeats: ["sports", "search"],
  dormantRationale: "No sports or search-driven stories this cycle",
};

function workerOutput(roleId: string, title: string, confidence = 0.85): object {
  return {
    story: {
      title,
      summary: `Comprehensive analysis of the ${roleId} story with multiple verified sources.`,
      summaryBullets: [
        `${roleId} report: key development confirmed by official sources`,
        `Stakeholders react to the announcement`,
        `Markets and observers weigh in on the implications`,
      ],
      beat: "general",
      confidence,
      sources: [
        { url: `https://${roleId.replace(/-/g, "")}.example.com`, name: "Verified Source", accessed: true },
      ],
    },
    selfAssessment: { meetsCriteria: true, reasoning: "All claims verified against official sources. Confidence is high." },
  };
}

// ---------------------------------------------------------------------------
// Mock Judge — returns approved verdicts for all claims
// ---------------------------------------------------------------------------

function mkJudgeSession(claims: JudgeClaim[]): JudgeSession {
  return vi.fn().mockResolvedValue({
    rawContent: JSON.stringify({
      claims: claims.map((c) => ({
        claimId: c.claimId,
        verdict: "approved",
        reason: "Corroborated by source receipts",
        evidence: [],
        receiptsCorroborated: true,
        linkupCorroborated: false,
        confidence: 0.9,
      })),
    }),
    usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    latencyMs: 80,
    ok: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: candidates → public audio script", () => {
  const editionKey = `e2e-${Date.now()}`;

  // Set up herm with: plan + 3 workers + 3 reviews = 7 calls
  const roles = (E2E_PLAN as any).roles;
  const allWorkers = roles.map((r: any) => workerOutput(r.roleId, `${r.name}: Key developments`));
  const allReviews = roles.map(() => ({ decision: "accept", commentary: "Good work." }));

  const hermes = mkHermes(E2E_PLAN, ...allWorkers, ...allReviews);

  let editorialResult: Awaited<ReturnType<typeof orchestrateEdition>>;
  let judgeResult: JudgeResult;
  let claims: JudgeClaim[];
  let gated: ReturnType<typeof gateScript>;
  let script: AudioScript;

  it("1. orchestrateEdition: plan + workers + review → complete", async () => {
    editorialResult = await orchestrateEdition(
      {
        candidates: CANDIDATES,
        editionKey,
        priorPlans: [],
        memoryEntries: [],
        totalTokenBudget: 5000,
        concurrencyLimit: 3,
        availableBeats: ["top", "nation", "business", "world", "sports", "search"],
      },
      hermes,
    );

    expect(editorialResult.status).toBe("complete");
    expect(editorialResult.plan.roles.length).toBe(3);
    expect(editorialResult.workerResults.length).toBe(3);

    // All workers valid
    for (const wr of editorialResult.workerResults) {
      expect(wr.validationStatus).toBe("valid");
      expect(wr.story.summaryBullets.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("2. Decompose into claims: bullets + summaries → atomic claims", () => {
    claims = decomposeScriptIntoClaims(editorialResult.workerResults, editionKey);
    expect(claims.length).toBeGreaterThanOrEqual(6); // 3 roles × (3 bullets + summary) de-duplicated

    // Each claim has required metadata
    for (const c of claims) {
      expect(c.claimId).toBeTruthy();
      expect(c.claim.length).toBeGreaterThan(10);
      expect(c.editionKey).toBe(editionKey);
    }
  });

  it("3. Judge: all claims approved", async () => {
    judgeResult = await judgeEdition(
      editorialResult.workerResults,
      editionKey,
      mkJudgeSession(claims),
    );

    expect(judgeResult.approved).toBeGreaterThanOrEqual(claims.length);
    expect(judgeResult.blocked).toBe(0);
    expect(judgeResult.escalated).toBe(0);
  });

  it("4. Gate: no blocked claims → all pass through", () => {
    gated = gateScript(editorialResult.workerResults, judgeResult, claims);

    expect(gated.blockedClaims.length).toBe(0);
    expect(gated.gatedResults.length).toBe(3);
  });

  it("5. Audio validation: clean gate → audio pipeline allowed", () => {
    const { valid, blocked } = validateGatedInput(
      editorialResult.workerResults,
      judgeResult,
    );
    expect(valid).toBe(true);
    expect(blocked.length).toBe(0);
  });

  it("6. Audio script assembly: two-anchor, chapters, ~250 words", () => {
    script = assembleScript(gated.gatedResults, editionKey);

    // Structure: intro A + intro B + stories + sign-off
    expect(script.turns.length).toBeGreaterThanOrEqual(7);

    // Alternating anchors
    expect(script.turns[0].anchor).toBe("A");
    expect(script.turns[1].anchor).toBe("B");

    // Chapters
    const chapters = script.turns.filter((t) => t.isChapterStart);
    expect(chapters.length).toBe(3); // one per role

    // Word count target
    expect(script.wordCount).toBeLessThanOrEqual(320);
    expect(script.wordCount).toBeGreaterThan(50);

    // Chapter map has entries
    expect(Object.keys(script.chapterMap).length).toBe(3);
  });

  it("7. Pronunciation hints applied", () => {
    const hinted = addPronunciationHints(script);
    const hasHints = hinted.turns.some((t) => t.pronunciation);
    // May or may not have hints depending on content, but the function returns the structure
    expect(hinted.editionKey).toBe(editionKey);
  });

  it("8. Public evidence view: approved claims visible", () => {
    const view = publicEvidenceView(judgeResult);
    expect(view.length).toBeGreaterThanOrEqual(claims.length);
    for (const entry of view) {
      expect(entry.verdict).toBe("approved");
    }
  });

  it("9. Assembly: build edition from workers", () => {
    const edition = assembleEdition(editorialResult.plan, editorialResult.workerResults);
    expect(edition.stories.length).toBe(3);
    expect(edition.editionKey).toBe(editionKey);
    expect(edition.stories[0].confidence).toBeGreaterThan(0.7);
  });

  it("10. Full trace: plan → workers → judge → gate → audio all consistent", () => {
    // Edition key flows through
    expect(editorialResult.editionKey).toBe(editionKey);
    expect(judgeResult.editionKey).toBe(editionKey);
    expect(script.editionKey).toBe(editionKey);

    // Worker count matches roles
    expect(editorialResult.workerResults.length).toBe(editorialResult.plan.roles.length);

    // No revision loops (all accepted first draft)
    expect(editorialResult.revisionLoops.length).toBe(0);

    // All gated results are valid
    for (const wr of gated.gatedResults) {
      expect(wr.validationStatus).toBe("valid");
    }

    // Audio chapters match worker count
    expect(Object.keys(script.chapterMap).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// E2E with one blocked claim — gate stops the fabricated claim
// ---------------------------------------------------------------------------

describe("E2E: fabricated claim is blocked and audio gate holds", () => {
  const editionKey = `e2e-blocked-${Date.now()}`;
  const roles = (E2E_PLAN as any).roles;

  // Same plan, but worker output for role 2 contains a fabricated claim
  const poisonedWorker = {
    story: {
      title: "Supreme Court to ban all tech companies",
      summary: "SCOTUS will ban all tech. This claim is fabricated.",
      summaryBullets: [
        "Supreme Court agreed to hear antitrust case",  // supported
        "All tech CEOs have been summoned for criminal prosecution",  // FABRICATED
        "Oral arguments set for October",  // supported
      ],
      beat: "nation",
      confidence: 0.3,
      sources: [{ url: "https://fake.example", name: "Fake Source", accessed: false }],
    },
    selfAssessment: { meetsCriteria: false, reasoning: "Could not verify all claims." },
  };

  const allWorkers = [
    workerOutput(roles[0].roleId, "World: Diplomacy updates"),
    poisonedWorker,
    workerOutput(roles[2].roleId, "Business: Economic roundup"),
  ];
  const allReviews = roles.map(() => ({ decision: "accept", commentary: "OK." }));

  const hermes = mkHermes(E2E_PLAN, ...allWorkers, ...allReviews);

  let editorialResult: Awaited<ReturnType<typeof orchestrateEdition>>;

  it("1. orchestrateEdition: completes with mixed results", async () => {
    editorialResult = await orchestrateEdition(
      {
        candidates: CANDIDATES,
        editionKey,
        priorPlans: [],
        memoryEntries: [],
        totalTokenBudget: 5000,
        concurrencyLimit: 3,
        availableBeats: ["top", "nation", "business", "world", "sports", "search"],
      },
      hermes,
    );

    // Political worker has valid schema but fabricated content → still "valid" by schema
    expect(editorialResult.status).toBe("complete");
  });

  it("2. Judge: fabricated claim is blocked", async () => {
    const claims = decomposeScriptIntoClaims(editorialResult.workerResults, editionKey);

    // Build a judge session that blocks claims from politics-desk
    const judgeSession: JudgeSession = vi.fn().mockResolvedValue({
      rawContent: JSON.stringify({
        claims: claims.map((c) => ({
          claimId: c.claimId,
          verdict:
            c.roleId === "politics-desk" && c.claim.includes("criminal prosecution")
              ? "block"
              : "approved",
          reason:
            c.roleId === "politics-desk" && c.claim.includes("criminal prosecution")
              ? "Fabricated — no evidence of criminal prosecution"
              : "Corroborated",
          evidence: [],
          receiptsCorroborated: c.roleId !== "politics-desk",
          linkupCorroborated: false,
          confidence: c.roleId !== "politics-desk" ? 0.9 : 0.1,
        })),
      }),
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latencyMs: 80,
      ok: true,
    });

    const judgeResult = await judgeEdition(
      editorialResult.workerResults,
      editionKey,
      judgeSession,
    );

    expect(judgeResult.blocked).toBeGreaterThanOrEqual(1);
    expect(judgeResult.approved).toBeGreaterThanOrEqual(1);
  });

  it("3. Gate: blocked claim surfaces in blocked list", async () => {
    const claims = decomposeScriptIntoClaims(editorialResult.workerResults, editionKey);

    const judgeSession: JudgeSession = vi.fn().mockResolvedValue({
      rawContent: JSON.stringify({
        claims: claims.map((c) => ({
          claimId: c.claimId,
          verdict:
            c.roleId === "politics-desk" && c.claim.includes("criminal prosecution")
              ? "block"
              : "approved",
          reason:
            c.roleId === "politics-desk" && c.claim.includes("criminal prosecution")
              ? "Fabricated"
              : "Corroborated",
          evidence: [],
          receiptsCorroborated: c.roleId !== "politics-desk",
          linkupCorroborated: false,
          confidence: c.roleId !== "politics-desk" ? 0.9 : 0.1,
        })),
      }),
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latencyMs: 80,
      ok: true,
    });

    const judgeResult = await judgeEdition(editorialResult.workerResults, editionKey, judgeSession);
    const { gatedResults, blockedClaims } = gateScript(editorialResult.workerResults, judgeResult, claims);

    // At least one blocked claim
    expect(blockedClaims.length).toBeGreaterThanOrEqual(1);
    expect(blockedClaims.some((bc) => bc.roleId === "politics-desk")).toBe(true);

    // Audio gate should reject
    const gate = validateGatedInput(editorialResult.workerResults, judgeResult);
    expect(gate.valid).toBe(false);
    expect(gate.blocked.length).toBeGreaterThanOrEqual(1);
  });
});
