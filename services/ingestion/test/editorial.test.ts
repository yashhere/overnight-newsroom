// ---------------------------------------------------------------------------
// Evals for ONR-004: Dynamic editor and ephemeral desks
//
// Four eval surfaces, kept separate:
//   S1: Deterministic code — schema validation, parse helpers (unit tests)
//   S2: Structured output correctness — contract tests on editorial plan/worker shapes
//   S3: Editorial quality — different role graphs, revision loops, novel roles
//   S4: End-to-end pipeline — full orchestration with mock Hermes
//
// All tests use a mock HermesSession so they run deterministically in <1s.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  planEdition,
  runWorker,
  reviewWorkerOutput,
  runWorkersWithReview,
  orchestrateEdition,
  assembleEdition,
  diffRoleGraphs,
  type HermesSession,
} from "../src/editorial.js";
import {
  EditorialPlanSchema,
  WorkerResultInputSchema,
  RevisionNoteSchema,
  parseEditorialPlanJson,
  validateWorkerResult,
  parseWorkerResultJson,
} from "../src/manager.js";
import type {
  RoleDerivationInput,
  EditorialPlan,
  WorkerResult,
  RoleSpec,
} from "../src/types.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** General-news heavy candidates (business/world/politics) */
const generalCandidates: RoleDerivationInput["candidates"] = [
  {
    clusterId: "c-001",
    title: "Fed holds rates steady amid inflation concerns",
    summaryBullets: [
      "Federal Reserve left rates unchanged at 5.25-5.50%",
      "Inflation remains above 2% target",
      "Markets rallied on the decision",
    ],
    suggestedBeat: "business",
    confidence: 0.85,
    outletCount: 8,
    missingContext: [],
  },
  {
    clusterId: "c-002",
    title: "UN Security Council votes on Gaza ceasefire resolution",
    summaryBullets: [
      "Resolution passes 14-0 with one abstention",
      "Calls for immediate humanitarian access",
      "Israel and Hamas yet to respond",
    ],
    suggestedBeat: "world",
    confidence: 0.9,
    outletCount: 12,
    missingContext: [],
  },
  {
    clusterId: "c-003",
    title: "Supreme Court agrees to hear major tech antitrust case",
    summaryBullets: [
      "Case centers on app store competition",
      "Could reshape digital marketplace rules",
      "Oral arguments set for October",
    ],
    suggestedBeat: "nation",
    confidence: 0.88,
    outletCount: 6,
    missingContext: [],
  },
  {
    clusterId: "c-004",
    title: "Election campaign heats up as primaries approach",
    summaryBullets: [
      "Three candidates lead in polls",
      "Key debate scheduled for next week",
      "Fundraising records broken",
    ],
    suggestedBeat: "nation",
    confidence: 0.82,
    outletCount: 10,
    missingContext: [],
  },
  {
    clusterId: "c-005",
    title: "Global chip shortage shows signs of easing",
    summaryBullets: [
      "TSMC reports increased capacity",
      "Auto industry sees relief",
      "Prices expected to stabilize by Q4",
    ],
    suggestedBeat: "business",
    confidence: 0.78,
    outletCount: 5,
    missingContext: [],
  },
  {
    clusterId: "c-006",
    title: "Climate summit yields unprecedented carbon pledge",
    summaryBullets: [
      "40 nations commit to net zero by 2040",
      "Developing nations demand funding",
      "Critics say timeline too slow",
    ],
    suggestedBeat: "world",
    confidence: 0.87,
    outletCount: 9,
    missingContext: [],
  },
];

/** Markets-heavy candidates (finance/economy) */
const marketsCandidates: RoleDerivationInput["candidates"] = [
  {
    clusterId: "c-101",
    title: "Sensex hits all-time high on foreign inflows",
    summaryBullets: [
      "BSE Sensex closes at 85,200, up 2.3%",
      "FIIs bought ₹4,200 crore net",
      "Banking and IT stocks lead rally",
    ],
    suggestedBeat: "business",
    confidence: 0.92,
    outletCount: 7,
    missingContext: [],
  },
  {
    clusterId: "c-102",
    title: "RBI keeps repo rate unchanged at 6.5%",
    summaryBullets: [
      "MPC voted 5-1 to hold rates",
      "GDP growth forecast raised to 7.2%",
      "Inflation projected at 4.5% for FY26",
    ],
    suggestedBeat: "business",
    confidence: 0.9,
    outletCount: 9,
    missingContext: [],
  },
  {
    clusterId: "c-103",
    title: "Gold prices surge to ₹72,000 per 10g",
    summaryBullets: [
      "Safe-haven demand pushes gold higher",
      "Jewellery stocks rally in sympathy",
      "Analysts see further upside",
    ],
    suggestedBeat: "business",
    confidence: 0.85,
    outletCount: 6,
    missingContext: [],
  },
  {
    clusterId: "c-104",
    title: "Crude oil dips below $70 on demand fears",
    summaryBullets: [
      "Brent crude falls 3.2% to $69.40",
      "China demand slowdown cited",
      "OPEC+ meeting next week in focus",
    ],
    suggestedBeat: "business",
    confidence: 0.88,
    outletCount: 8,
    missingContext: [],
  },
  {
    clusterId: "c-105",
    title: "Startup funding winter shows first thaw",
    summaryBullets: [
      "Q3 funding up 15% QoQ to $3.2B",
      "AI startups dominate deal flow",
      "Later-stage rounds still sluggish",
    ],
    suggestedBeat: "business",
    confidence: 0.8,
    outletCount: 5,
    missingContext: [],
  },
];

/** Empty / sparse candidates (stress test) */
const sparseCandidates: RoleDerivationInput["candidates"] = [
  {
    clusterId: "c-201",
    title: "Local school board election results",
    summaryBullets: ["Three seats decided by narrow margins"],
    suggestedBeat: "top",
    confidence: 0.6,
    outletCount: 2,
    missingContext: ["Limited coverage, only local outlets"],
  },
];

const baseInput = (
  candidates: RoleDerivationInput["candidates"]
): RoleDerivationInput => ({
  candidates,
  editionKey: "test-edition-001",
  priorPlans: [],
  memoryEntries: [],
  totalTokenBudget: 5000,
  concurrencyLimit: 3,
  availableBeats: ["top", "nation", "business", "world", "sports", "search"],
});

// ---------------------------------------------------------------------------
// Mock Hermes factories
// ---------------------------------------------------------------------------

/** Creates a mock Hermes that returns the given JSON object */
function mockHermes<T>(jsonResponse: T): HermesSession {
  return vi.fn().mockResolvedValue({
    rawContent: JSON.stringify(jsonResponse),
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    latencyMs: 42,
    ok: true,
    httpStatus: 200,
  });
}

/** Creates a mock Hermes that returns raw text (not JSON) */
function mockHermesRaw(text: string): HermesSession {
  return vi.fn().mockResolvedValue({
    rawContent: text,
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    latencyMs: 42,
    ok: true,
    httpStatus: 200,
  });
}

/** Creates a failing mock Hermes */
function mockHermesFails(errorText: string): HermesSession {
  return vi.fn().mockResolvedValue({
    rawContent: errorText,
    usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
    latencyMs: 100,
    ok: false,
    httpStatus: 500,
  });
}

// ---------------------------------------------------------------------------
// A representative general-news plan with a novel role
// ---------------------------------------------------------------------------
function generalNewsPlan(): object {
  return {
    editorialDirection:
      "Broad edition covering global affairs, domestic politics, and economic developments",
    sections: [
      { name: "World", description: "International affairs and diplomacy", priority: 1 },
      { name: "Politics & Law", description: "Domestic politics and legal developments", priority: 2 },
      { name: "Business & Tech", description: "Economic and technology stories", priority: 3 },
    ],
    roles: [
      {
        roleId: "world-desk",
        name: "World Desk",
        rationale: "Multiple high-signal world stories with UN resolution and climate summit",
        assignedClusterIds: ["c-002", "c-006"],
        mission: "Report on international diplomacy and climate developments",
        allowedTools: ["web_search", "article_read"],
        guardrails: ["Verify all diplomatic claims against official statements", "Include multiple perspectives", "No editorializing on active conflicts"],
        successCriteria: ["Accurate summary of UN vote details", "Carbon pledge specifics verified", "Both stories filed within budget"],
        tokenBudget: 800,
        timeBudgetMs: 45000,
      },
      {
        roleId: "politics-desk",
        name: "Politics Desk",
        rationale: "Domestic election and Supreme Court stories warrant dedicated coverage",
        assignedClusterIds: ["c-003", "c-004"],
        mission: "Cover domestic political and legal developments",
        allowedTools: ["web_search", "article_read", "docket_lookup"],
        guardrails: ["Non-partisan framing", "Cite court documents where applicable", "Election coverage: equal time principle"],
        successCriteria: ["SCOTUS case accurately described", "Election story balanced across candidates", "Legal terminology correct"],
        tokenBudget: 700,
        timeBudgetMs: 45000,
      },
      {
        roleId: "economy-tracker",
        name: "Economy Tracker",
        rationale: "Fed decision and chip shortage are significant economic stories",
        assignedClusterIds: ["c-001", "c-005"],
        mission: "Report on economic and business developments",
        allowedTools: ["web_search", "article_read", "data_analysis"],
        guardrails: ["Use official data sources only", "Distinguish between reported facts and analyst opinions", "No market predictions"],
        successCriteria: ["Fed decision details verified from official statement", "Chip shortage data corroborated", "Economic context provided"],
        tokenBudget: 700,
        timeBudgetMs: 45000,
      },
      {
        roleId: "climate-science-reviewer",
        name: "Climate Science Reviewer",
        rationale: "Climate summit story requires science-specific expertise not covered by general world desk",
        assignedClusterIds: ["c-006"],
        mission: "Provide science-based analysis of climate pledges and verify claims against IPCC data",
        allowedTools: ["web_search", "article_read", "data_analysis", "ipcc_lookup"],
        guardrails: ["Use IPCC and peer-reviewed sources", "Distinguish pledges from policy", "Quantify commitments where possible"],
        successCriteria: ["Net-zero commitments verified against national databases", "Scientific context provided", "Critic perspectives fairly represented"],
        tokenBudget: 600,
        timeBudgetMs: 45000,
      },
    ],
    dormantBeats: ["sports", "search"],
    dormantRationale: "No significant sports or search-driven stories this cycle. Omitted to focus editorial resources.",
  };
}

/** A markets-heavy plan with different roles */
function marketsPlan(): object {
  return {
    editorialDirection:
      "Markets-focused edition covering equities, commodities, monetary policy, and startup funding",
    sections: [
      { name: "Markets", description: "Equity, commodity, and currency movements", priority: 1 },
      { name: "Economy & Policy", description: "Central bank decisions and economic data", priority: 2 },
      { name: "Startups & Tech", description: "Funding and innovation", priority: 3 },
    ],
    roles: [
      {
        roleId: "markets-reporter",
        name: "Markets Reporter",
        rationale: "Multiple market-moving stories across equities, gold, and crude",
        assignedClusterIds: ["c-101", "c-103", "c-104"],
        mission: "Report on daily market movements with context and analysis",
        allowedTools: ["web_search", "article_read", "market_data"],
        guardrails: ["Use exchange-verified prices", "Include disclaimer on forward-looking statements", "Attribute analyst quotes"],
        successCriteria: ["Price movements verified against exchange data", "Context provided for each move", "Multiple asset classes covered"],
        tokenBudget: 900,
        timeBudgetMs: 45000,
      },
      {
        roleId: "monetary-policy-analyst",
        name: "Monetary Policy Analyst",
        rationale: "RBI decision requires specialist monetary policy understanding",
        assignedClusterIds: ["c-102"],
        mission: "Analyze central bank decisions with economic context",
        allowedTools: ["web_search", "article_read", "economic_calendar"],
        guardrails: ["Use official RBI statements", "Explain policy transmission mechanism", "Include GDP/inflation forecasts"],
        successCriteria: ["RBI decision accurately reported", "Voting split verified", "Forward guidance included"],
        tokenBudget: 600,
        timeBudgetMs: 45000,
      },
      {
        roleId: "startup-ecosystem-tracker",
        name: "Startup Ecosystem Tracker",
        rationale: "Funding winter thaw story needs venture capital domain knowledge",
        assignedClusterIds: ["c-105"],
        mission: "Track startup funding trends and ecosystem health",
        allowedTools: ["web_search", "article_read", "tracxn_data"],
        guardrails: ["Use verified funding data", "Distinguish announced vs closed rounds", "Not investment advice"],
        successCriteria: ["Q3 funding data verified", "Sector breakdown provided", "Historical context included"],
        tokenBudget: 500,
        timeBudgetMs: 45000,
      },
    ],
    dormantBeats: ["sports", "search", "world", "nation"],
    dormantRationale: "No world or nation stories in this cycle. Sports and search beats have no candidate clusters. Focus on business/markets.",
  };
}

/** A valid worker output */
function validWorkerOutput(
  roleId: string,
  title: string,
  confidence = 0.8
): object {
  return {
    story: {
      title,
      summary: `This is a comprehensive summary of the ${roleId} story covering key developments.`,
      summaryBullets: ["Key development A confirmed by official sources", "Stakeholders react to decision", "Markets respond as expected"],
      beat: "business",
      confidence,
      sources: [
        { url: "https://example.com/article", name: "Example News", accessed: true },
      ],
    },
    selfAssessment: {
      meetsCriteria: true,
      reasoning: "All claims verified against official sources. Confidence reflects source quality.",
    },
  };
}

/** A weak worker output (low confidence, thin bullets) */
function weakWorkerOutput(roleId: string): object {
  return {
    story: {
      title: `${roleId} — brief update`,
      summary: "Some things happened. Market moved slightly.",
      summaryBullets: ["things changed"],
      beat: "business",
      confidence: 0.35,
      sources: [
        { url: "https://example.com", name: "Unknown Blog", accessed: true },
      ],
    },
    selfAssessment: {
      meetsCriteria: false,
      reasoning: "Limited sourcing, could not verify key claims.",
    },
  };
}

/** An invalid worker output (schema violation) */
function invalidWorkerOutput(): string {
  return JSON.stringify({
    story: {
      title: "X", // too short
      summary: "short", // too short
      summaryBullets: [], // empty — schema violation
      beat: "business",
      confidence: 1.5, // out of range
      sources: [], // empty — schema violation
    },
    selfAssessment: {
      meetsCriteria: "maybe", // not boolean
    },
  });
}

// ---------------------------------------------------------------------------
// S1: Deterministic code — schema validation and parse helpers
// ---------------------------------------------------------------------------

describe("S1: Schema validation (deterministic)", () => {
  describe("EditorialPlanSchema", () => {
    it("parses a valid general-news plan", () => {
      const result = EditorialPlanSchema.parse(generalNewsPlan());
      expect(result.editorialDirection).toBeDefined();
      expect(result.sections.length).toBe(3);
      expect(result.roles.length).toBe(4);
      // climate-science-reviewer should be present (novel role)
      expect(result.roles.map((r) => r.roleId)).toContain("climate-science-reviewer");
      expect(result.dormantBeats).toEqual(["sports", "search"]);
    });

    it("parses a valid markets-heavy plan", () => {
      const result = EditorialPlanSchema.parse(marketsPlan());
      expect(result.roles.length).toBe(3);
      expect(result.roles.map((r) => r.roleId)).toContain("monetary-policy-analyst");
      expect(result.dormantBeats).toContain("sports");
      expect(result.dormantBeats).toContain("nation");
    });

    it("rejects a plan with no roles", () => {
      expect(() =>
        EditorialPlanSchema.parse({
          editorialDirection: "empty",
          sections: [],
          roles: [],
        })
      ).not.toThrow(); // empty roles is allowed — sparse editions exist
    });

    it("rejects a plan with negative token budget", () => {
      const plan: any = {
        editorialDirection: "bad",
        sections: [{ name: "x", description: "y", priority: 1 }],
        roles: [{ roleId: "r1", name: "R1", rationale: "r", assignedClusterIds: [], mission: "m", allowedTools: [], guardrails: [], successCriteria: [], tokenBudget: -1, timeBudgetMs: 1000 }],
      };
      expect(() => EditorialPlanSchema.parse(plan)).toThrow();
    });
  });

  describe("WorkerResultInputSchema", () => {
    it("validates a correct worker output", () => {
      const output = validWorkerOutput("test-role", "Good Title Here");
      const result = WorkerResultInputSchema.parse(output);
      expect(result.story.title).toBe("Good Title Here");
      expect(result.story.summaryBullets.length).toBeGreaterThanOrEqual(1);
      expect(result.selfAssessment.meetsCriteria).toBe(true);
    });

    it("rejects output with empty summaryBullets", () => {
      expect(() =>
        WorkerResultInputSchema.parse({
          story: { title: "Good Title", summary: "A long enough summary for testing.", summaryBullets: [], beat: "biz", confidence: 0.5, sources: [{ url: "x", name: "y", accessed: true }] },
          selfAssessment: { meetsCriteria: true, reasoning: "ok" },
        })
      ).toThrow();
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        WorkerResultInputSchema.parse({
          story: { title: "Good Title", summary: "A long enough summary for testing.", summaryBullets: ["one"], beat: "biz", confidence: 2.0, sources: [{ url: "x", name: "y", accessed: true }] },
          selfAssessment: { meetsCriteria: true, reasoning: "ok" },
        })
      ).toThrow();
    });

    it("rejects title under 5 chars", () => {
      expect(() =>
        WorkerResultInputSchema.parse({
          story: { title: "Hi", summary: "A long enough summary for testing.", summaryBullets: ["one"], beat: "biz", confidence: 0.5, sources: [{ url: "x", name: "y", accessed: true }] },
          selfAssessment: { meetsCriteria: true, reasoning: "ok" },
        })
      ).toThrow();
    });
  });

  describe("RevisionNoteSchema", () => {
    it("validates a correct revision note", () => {
      const note = {
        concerns: ["Lacks sourcing for claim about GDP"],
        suggestions: ["Cite RBI press release for GDP data"],
        severity: "required" as const,
      };
      expect(() => RevisionNoteSchema.parse(note)).not.toThrow();
    });

    it("rejects a note with no concerns", () => {
      expect(() =>
        RevisionNoteSchema.parse({ concerns: [], suggestions: [], severity: "required" })
      ).toThrow();
    });
  });

  describe("validateWorkerResult", () => {
    it("reports valid for correct output", () => {
      const raw = JSON.stringify(validWorkerOutput("r1", "Good Title Here"));
      const result = validateWorkerResult(raw);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("reports invalid for malformed JSON", () => {
      const result = validateWorkerResult("not even json");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("reports invalid for schema violations", () => {
      const result = validateWorkerResult(invalidWorkerOutput());
      expect(result.valid).toBe(false);
      // Should have multiple errors
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// S2: Structured output correctness — contract tests
// ---------------------------------------------------------------------------

describe("S2: Structured output contracts", () => {
  describe("planEdition", () => {
    it("returns a valid plan from general-news input", async () => {
      const hermes = mockHermes(generalNewsPlan());
      const { plan } = await planEdition(
        baseInput(generalCandidates),
        hermes
      );

      expect(plan.planId).toBeTruthy();
      expect(plan.editionKey).toBe("test-edition-001");
      expect(plan.roles.length).toBeGreaterThanOrEqual(3);
      expect(plan.roles.length).toBeLessThanOrEqual(8);
      // Every role must have all required fields
      for (const role of plan.roles) {
        expect(role.roleId).toBeTruthy();
        expect(role.rationale).toBeTruthy();
        expect(role.mission).toBeTruthy();
        expect(role.tokenBudget).toBeGreaterThan(0);
        expect(role.timeBudgetMs).toBeGreaterThan(0);
      }
      // Dormant beats should be recorded
      expect(plan.dormantBeats).toBeDefined();
      expect(plan.dormantRationale).toBeTruthy();
    });

    it("returns a valid plan from markets-heavy input", async () => {
      const hermes = mockHermes(marketsPlan());
      const { plan } = await planEdition(
        baseInput(marketsCandidates),
        hermes
      );

      expect(plan.roles.length).toBeGreaterThanOrEqual(2);
      expect(plan.dormantBeats.length).toBeGreaterThan(0);
    });

    it("throws on Hermes failure", async () => {
      const hermes = mockHermesFails("Internal server error");
      await expect(
        planEdition(baseInput(generalCandidates), hermes)
      ).rejects.toThrow("Editor-in-Chief call failed");
    });

    it("handles sparse candidates gracefully", async () => {
      // For sparse input, the plan should have very few roles
      const sparsePlan = {
        editorialDirection: "Light edition with limited news",
        sections: [{ name: "Local", description: "Local news", priority: 1 }],
        roles: [
          {
            roleId: "local-desk",
            name: "Local Desk",
            rationale: "Single local story available",
            assignedClusterIds: ["c-201"],
            mission: "Cover local school board election",
            allowedTools: ["web_search"],
            guardrails: ["Verify with election board data"],
            successCriteria: ["Election results verified"],
            tokenBudget: 400,
            timeBudgetMs: 30000,
          },
        ],
        dormantBeats: ["nation", "business", "world", "sports", "search"],
        dormantRationale: "No stories in any other beat this cycle",
      };
      const hermes = mockHermes(sparsePlan);
      const { plan } = await planEdition(
        baseInput(sparseCandidates),
        hermes
      );
      expect(plan.roles.length).toBe(1);
      expect(plan.dormantBeats.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("runWorker", () => {
    it("returns valid worker result with valid output", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test mission",
        allowedTools: ["web_search"],
        guardrails: ["Be accurate"],
        successCriteria: ["Verify sources"],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      const hermes = mockHermes(validWorkerOutput("test-role", "A Good Title Here"));
      const result = await runWorker(
        role,
        "test-edition",
        generalCandidates,
        hermes
      );

      expect(result.validationStatus).toBe("valid");
      expect(result.story.title).toBe("A Good Title Here");
      expect(result.story.summaryBullets.length).toBeGreaterThanOrEqual(1);
      expect(result.repairAttempted).toBe(false);
      expect(result.roleId).toBe("test-role");
    });

    it("attempts repair on invalid output and succeeds if repairable", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      // First call returns invalid, second (repair) returns valid
      const hermes = vi
        .fn()
        .mockResolvedValueOnce({
          rawContent: invalidWorkerOutput(),
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        })
        .mockResolvedValueOnce({
          rawContent: JSON.stringify(validWorkerOutput("test-role", "Repaired Title")),
          usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        });

      const result = await runWorker(
        role,
        "test-edition",
        generalCandidates,
        hermes
      );

      expect(result.validationStatus).toBe("repaired");
      expect(result.repairAttempted).toBe(true);
      expect(result.story.title).toBe("Repaired Title");
      expect(hermes).toHaveBeenCalledTimes(2);
    });

    it("fails with invalid after failed repair attempt", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      // Both calls return invalid
      const hermes = vi
        .fn()
        .mockResolvedValueOnce({
          rawContent: invalidWorkerOutput(),
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        })
        .mockResolvedValueOnce({
          rawContent: "still not valid json }}}",
          usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        });

      const result = await runWorker(
        role,
        "test-edition",
        generalCandidates,
        hermes
      );

      expect(result.validationStatus).toBe("invalid");
      expect(result.repairAttempted).toBe(true);
      expect(result.story.confidence).toBe(0);
      expect(hermes).toHaveBeenCalledTimes(2);
    });
  });

  describe("reviewWorkerOutput", () => {
    it("accepts a valid draft", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      const workerResult = parseWorkerResultJson(
        JSON.stringify(validWorkerOutput("test-role", "Good Article")),
        "test-role",
        "test-edition"
      );

      const hermes = mockHermes({ decision: "accept", commentary: "Well-sourced piece." });
      const review = await reviewWorkerOutput(role, workerResult, hermes);
      expect(review.decision).toBe("accept");
    });

    it("rejects a weak draft with concrete notes", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      const workerResult = parseWorkerResultJson(
        JSON.stringify(weakWorkerOutput("test-role")),
        "test-role",
        "test-edition"
      );

      const hermes = mockHermes({
        decision: "reject",
        revisionNote: {
          concerns: ["Confidence too low", "Only one source"],
          suggestions: ["Add official source", "Verify market data"],
          severity: "required",
        },
        commentary: "Needs more research.",
      });

      const review = await reviewWorkerOutput(role, workerResult, hermes);
      expect(review.decision).toBe("reject");
      expect(review.revisionNote).toBeDefined();
      expect(review.revisionNote!.concerns.length).toBeGreaterThanOrEqual(1);
      expect(review.revisionNote!.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(review.revisionNote!.severity).toBe("required");
    });

    it("defaults to accept on parse error", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test Reporter",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      const workerResult = parseWorkerResultJson(
        JSON.stringify(validWorkerOutput("test-role", "Valid Title Here")),
        "test-role",
        "test-edition"
      );

      const hermes = vi.fn().mockResolvedValue({
        rawContent: "not json at all",
        usage: {},
        latencyMs: 10,
        ok: true,
        httpStatus: 200,
      });

      const review = await reviewWorkerOutput(role, workerResult, hermes);
      // Should default to accept on parse failure (don't block the pipeline)
      expect(review.decision).toBe("accept");
    });
  });
});

// ---------------------------------------------------------------------------
// S3: Editorial quality — role graphs, revision loops, novel roles
// ---------------------------------------------------------------------------

describe("S3: Editorial quality", () => {
  describe("Different inputs → different role graphs", () => {
    it("general news input produces more diverse roles than markets input", async () => {
      const generalHermes = mockHermes(generalNewsPlan());
      const marketsHermes = mockHermes(marketsPlan());

      const generalResult = await planEdition(
        baseInput(generalCandidates),
        generalHermes
      );
      const marketsResult = await planEdition(
        baseInput(marketsCandidates),
        marketsHermes
      );

      const diff = diffRoleGraphs(generalResult.plan, marketsResult.plan);

      // They must differ
      expect(diff.onlyInA.length + diff.onlyInB.length).toBeGreaterThan(0);

      // General plan covers more beats → more roles
      expect(generalResult.plan.roles.length).toBeGreaterThan(
        marketsResult.plan.roles.length
      );

      // Different dormant beats
      expect(generalResult.plan.dormantBeats).not.toEqual(
        marketsResult.plan.dormantBeats
      );
    });

    it("sparse input produces a minimal role graph", async () => {
      const sparsePlan = {
        editorialDirection: "Light edition",
        sections: [{ name: "Local", description: "Local", priority: 1 }],
        roles: [
          {
            roleId: "local-desk",
            name: "Local Desk",
            rationale: "Only one story",
            assignedClusterIds: ["c-201"],
            mission: "Cover local story",
            allowedTools: ["web_search"],
            guardrails: ["Be accurate"],
            successCriteria: ["Verify results"],
            tokenBudget: 400,
            timeBudgetMs: 30000,
          },
        ],
        dormantBeats: ["nation", "business", "world", "sports", "search"],
        dormantRationale: "No candidates in other beats",
      };

      const hermes = mockHermes(sparsePlan);
      const { plan } = await planEdition(baseInput(sparseCandidates), hermes);

      expect(plan.roles.length).toBe(1);
      expect(plan.dormantBeats.length).toBeGreaterThanOrEqual(4);
      // Sports must be dormant since there are no sports candidates
      expect(plan.dormantBeats).toContain("sports");
    });
  });

  describe("At least one derived role was not in initial instructions", () => {
    it("climate-science-reviewer is a novel role not in available beats", async () => {
      const hermes = mockHermes(generalNewsPlan());
      const { plan } = await planEdition(
        baseInput(generalCandidates),
        hermes
      );

      const roleIds = plan.roles.map((r) => r.roleId);
      // "climate-science-reviewer" is not a standard beat name
      const novelRoles = roleIds.filter(
        (id) =>
          !baseInput(generalCandidates).availableBeats.includes(id) &&
          id !== "world-desk" &&
          id !== "politics-desk" &&
          id !== "economy-tracker"
      );

      // climate-science-reviewer should be present and it's not in the beat list
      expect(roleIds).toContain("climate-science-reviewer");
      expect(
        baseInput(generalCandidates).availableBeats
      ).not.toContain("climate-science-reviewer");
    });

    it("monetary-policy-analyst is a novel specialist role for markets edition", async () => {
      const hermes = mockHermes(marketsPlan());
      const { plan } = await planEdition(
        baseInput(marketsCandidates),
        hermes
      );

      expect(plan.roles.map((r) => r.roleId)).toContain("monetary-policy-analyst");
      // This role is not a standard beat from the feed config
      expect(
        baseInput(marketsCandidates).availableBeats
      ).not.toContain("monetary-policy-analyst");
    });
  });

  describe("Irrelevant beats are not spawned", () => {
    it("sports and search beats are dormant when no sports/search candidates exist", async () => {
      const hermes = mockHermes(generalNewsPlan());
      const { plan } = await planEdition(
        baseInput(generalCandidates),
        hermes
      );

      // sports should be dormant
      expect(plan.dormantBeats).toContain("sports");

      // No role should be named "sports-reporter" or similar
      const roleIds = plan.roles.map((r) => r.roleId);
      expect(roleIds.filter((id) => id.includes("sports"))).toHaveLength(0);
      expect(roleIds.filter((id) => id.includes("entertainment"))).toHaveLength(0);
    });
  });

  describe("Revision loop is visible and persisted", () => {
    it("produces a revision loop when a weak draft is rejected", async () => {
      // Build a plan with one role
      const planInput = {
        editorialDirection: "Test edition for revision loop",
        sections: [{ name: "Test", description: "Test section", priority: 1 }],
        roles: [
          {
            roleId: "test-reporter",
            name: "Test Reporter",
            rationale: "test",
            assignedClusterIds: ["c-001"],
            mission: "Write a test story",
            allowedTools: ["web_search"],
            guardrails: ["Be factual"],
            successCriteria: ["Verify sources"],
            tokenBudget: 500,
            timeBudgetMs: 30000,
          },
        ],
        dormantBeats: [],
        dormantRationale: "N/A",
      };

      const { plan } = await planEdition(
        baseInput(generalCandidates),
        mockHermes(planInput)
      );

      // Mock: worker returns weak output, manager rejects it, revision succeeds
      const hermes = vi
        .fn()
        // Worker call — returns weak output
        .mockResolvedValueOnce({
          rawContent: JSON.stringify(weakWorkerOutput("test-reporter")),
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        })
        // Manager review call — rejects
        .mockResolvedValueOnce({
          rawContent: JSON.stringify({
            decision: "reject",
            revisionNote: {
              concerns: ["Low confidence", "Thin sourcing"],
              suggestions: ["Add more sources", "Verify claims"],
              severity: "required",
            },
            commentary: "Needs work.",
          }),
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        })
        // Revision call — returns improved output
        .mockResolvedValueOnce({
          rawContent: JSON.stringify(
            validWorkerOutput("test-reporter", "Revised: Better Article", 0.75)
          ),
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        })
        // Manager re-review call — accepts revised draft
        .mockResolvedValueOnce({
          rawContent: JSON.stringify({
            decision: "accept",
            commentary: "Revision resolves the sourcing concerns.",
          }),
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
          latencyMs: 10,
          ok: true,
          httpStatus: 200,
        });

      const { results, loops, memories } = await runWorkersWithReview(
        { ...plan, roles: plan.roles.slice(0, 1) },
        generalCandidates.slice(0, 1),
        hermes
      );

      // The revision loop should exist
      expect(loops.length).toBe(1);
      expect(loops[0].disposition).toBe("accepted");
      expect(loops[0].revisionNote.concerns.length).toBeGreaterThanOrEqual(1);
      expect(loops[0].revisionNote.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(loops[0].revisedResultId).toBeTruthy();
      expect(loops[0].round).toBe(1);

      // Result should be the revised version
      expect(results[0].story.title).toContain("Revised");

      // Memory should include the revision pattern
      expect(memories.length).toBeGreaterThanOrEqual(1);
      const revisionMemories = memories.filter(
        (m) => m.kind === "role_pattern"
      );
      expect(revisionMemories.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Manager can reject a weak draft and send revision notes", () => {
    it("revision note contains concrete concerns and suggestions", async () => {
      const role: RoleSpec = {
        roleId: "test-role",
        name: "Test",
        rationale: "test",
        assignedClusterIds: ["c-001"],
        mission: "Test",
        allowedTools: [],
        guardrails: [],
        successCriteria: [],
        parentTrace: "plan-001",
        tokenBudget: 500,
        timeBudgetMs: 30000,
        wasNamed: true,
      };

      const workerResult = parseWorkerResultJson(
        JSON.stringify(weakWorkerOutput("test-role")),
        "test-role",
        "test-edition"
      );

      const hermes = mockHermes({
        decision: "reject",
        revisionNote: {
          concerns: ["Confidence below 0.5 threshold", "Only one source cited"],
          suggestions: ["Add at least two more sources", "Cross-reference with official data"],
          severity: "required",
        },
        commentary: "Unacceptable for publication.",
      });

      const review = await reviewWorkerOutput(role, workerResult, hermes);

      expect(review.decision).toBe("reject");
      expect(review.revisionNote!.concerns).toContain("Confidence below 0.5 threshold");
      expect(review.revisionNote!.suggestions).toContain("Add at least two more sources");
      expect(review.revisionNote!.severity).toBe("required");
      expect(review.revisionNote!.roleId).toBe("test-role");
    });
  });
});

// ---------------------------------------------------------------------------
// S4: End-to-end pipeline
// ---------------------------------------------------------------------------

describe("S4: End-to-end pipeline", () => {
  it("orchestrateEdition completes with general-news input", async () => {
    // Mock: plan call succeeds, then one worker call per role succeeds
    const planObj = generalNewsPlan();
    const roles = (planObj as any).roles;

    const hermes = vi.fn();

    // First call: plan
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify(planObj),
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latencyMs: 50,
      ok: true,
      httpStatus: 200,
    });

    // Worker calls: all workers run first (in parallel batches) before any reviews.
    // Set up ALL worker mocks first, then ALL review mocks to match execution order.
    for (let i = 0; i < roles.length; i++) {
      hermes.mockResolvedValueOnce({
        rawContent: JSON.stringify(
          validWorkerOutput(roles[i].roleId, `Story ${i + 1}: ${roles[i].name}`)
        ),
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
        latencyMs: 30,
        ok: true,
        httpStatus: 200,
      });
    }
    // Review calls: all reviews run sequentially after all workers finish
    for (let i = 0; i < roles.length; i++) {
      hermes.mockResolvedValueOnce({
        rawContent: JSON.stringify({
          decision: "accept",
          commentary: "Good work.",
        }),
        usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
        latencyMs: 10,
        ok: true,
        httpStatus: 200,
      });
    }

    const result = await orchestrateEdition(
      baseInput(generalCandidates),
      hermes
    );

    expect(result.status).toBe("complete");
    expect(result.plan.roles.length).toBe(roles.length);
    expect(result.workerResults.length).toBe(roles.length);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
    expect(result.totalCostCents).toBeGreaterThanOrEqual(0);
    expect(result.totalLatencyMs).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
  });

  it("orchestrateEdition returns partial when some workers fail", async () => {
    const planObj = {
      editorialDirection: "Test",
      sections: [{ name: "T", description: "T", priority: 1 }],
      roles: [
        {
          roleId: "good-role",
          name: "Good Role",
          rationale: "test",
          assignedClusterIds: ["c-001"],
          mission: "Write well",
          allowedTools: [],
          guardrails: [],
          successCriteria: [],
          tokenBudget: 400,
          timeBudgetMs: 30000,
        },
        {
          roleId: "bad-role",
          name: "Bad Role",
          rationale: "test",
          assignedClusterIds: ["c-002"],
          mission: "Will fail",
          allowedTools: [],
          guardrails: [],
          successCriteria: [],
          tokenBudget: 400,
          timeBudgetMs: 30000,
        },
      ],
      dormantBeats: [],
      dormantRationale: "",
    };

    const hermes = vi.fn();

    // Plan call
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify(planObj),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latencyMs: 50,
      ok: true,
      httpStatus: 200,
    });

    // Good worker + review → accept
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify(validWorkerOutput("good-role", "Good Story")),
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      latencyMs: 30,
      ok: true,
      httpStatus: 200,
    });
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify({ decision: "accept", commentary: "ok" }),
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      latencyMs: 10,
      ok: true,
      httpStatus: 200,
    });

    // Bad worker — returns invalid output, repair also fails
    hermes.mockResolvedValueOnce({
      rawContent: invalidWorkerOutput(),
      usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
      latencyMs: 10,
      ok: true,
      httpStatus: 200,
    });
    hermes.mockResolvedValueOnce({
      rawContent: "garbage } not json",
      usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
      latencyMs: 10,
      ok: true,
      httpStatus: 200,
    });

    const result = await orchestrateEdition(
      baseInput(generalCandidates),
      hermes
    );

    expect(result.status).toBe("partial");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("invalid");
  });

  it("assembleEdition builds a valid edition from worker results", () => {
    const plan: EditorialPlan = {
      planId: "p1",
      editionKey: "ed-001",
      editorialDirection: "Test direction",
      sections: [{ name: "Test", description: "Desc", priority: 1 }],
      roles: [],
      dormantBeats: [],
      dormantRationale: "",
      totalTokenBudget: 1000,
      concurrencyLimit: 3,
      createdAt: Date.now(),
      inputDigest: "",
    };

    const results: WorkerResult[] = [
      {
        roleId: "r1",
        resultId: "res-1",
        editionKey: "ed-001",
        story: {
          title: "Story A",
          summary: "Summary A",
          summaryBullets: ["Bullet 1", "Bullet 2"],
          beat: "business",
          confidence: 0.9,
          sources: [{ url: "https://a.com", name: "Source A", accessed: true }],
        },
        selfAssessment: { meetsCriteria: true, reasoning: "Good" },
        rawResponse: "{}",
        validationStatus: "valid",
        validationErrors: [],
        repairAttempted: false,
        tokensUsed: 100,
        estimatedCostCents: 1,
        latencyMs: 100,
      },
      {
        roleId: "r2",
        resultId: "res-2",
        editionKey: "ed-001",
        story: {
          title: "Story B",
          summary: "Summary B",
          summaryBullets: ["Bullet"],
          beat: "world",
          confidence: 0.75,
          sources: [{ url: "https://b.com", name: "Source B", accessed: true }],
        },
        selfAssessment: { meetsCriteria: true, reasoning: "OK" },
        rawResponse: "{}",
        validationStatus: "valid",
        validationErrors: [],
        repairAttempted: false,
        tokensUsed: 100,
        estimatedCostCents: 1,
        latencyMs: 100,
      },
      {
        // Invalid result — should be filtered out
        roleId: "r3",
        resultId: "res-3",
        editionKey: "ed-001",
        story: {
          title: "[FAILED] Bad story",
          summary: "Failed",
          summaryBullets: [],
          beat: "error",
          confidence: 0,
          sources: [],
        },
        selfAssessment: { meetsCriteria: false, reasoning: "Failed" },
        rawResponse: "",
        validationStatus: "invalid",
        validationErrors: ["Schema error"],
        repairAttempted: true,
        tokensUsed: 50,
        estimatedCostCents: 0,
        latencyMs: 50,
      },
    ];

    const edition = assembleEdition(plan, results);

    expect(edition.editionKey).toBe("ed-001");
    // Invalid result should be excluded
    expect(edition.stories.length).toBe(2);
    expect(edition.stories[0].title).toBe("Story A"); // higher confidence first
    expect(edition.stories[0].confidence).toBeGreaterThan(
      edition.stories[1].confidence
    );
    // Failed story excluded
    expect(edition.stories.find((s) => s.roleId === "r3")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// S5: Newsroom memory accumulates across editions
// ---------------------------------------------------------------------------

describe("S5: Newsroom memory", () => {
  it("orchestrateEdition returns memories with each run", async () => {
    const planObj = {
      editorialDirection: "Memory test",
      sections: [{ name: "T", description: "T", priority: 1 }],
      roles: [
        {
          roleId: "mem-role",
          name: "Memory Role",
          rationale: "test",
          assignedClusterIds: ["c-001"],
          mission: "Test",
          allowedTools: [],
          guardrails: [],
          successCriteria: [],
          tokenBudget: 400,
          timeBudgetMs: 30000,
        },
      ],
      dormantBeats: ["sports"],
      dormantRationale: "No sports stories",
    };

    const hermes = vi.fn();

    // Plan call
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify(planObj),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latencyMs: 50,
      ok: true,
      httpStatus: 200,
    });

    // Worker call
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify(validWorkerOutput("mem-role", "Memory Story", 0.85)),
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      latencyMs: 30,
      ok: true,
      httpStatus: 200,
    });

    // Review call
    hermes.mockResolvedValueOnce({
      rawContent: JSON.stringify({ decision: "accept", commentary: "Good" }),
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      latencyMs: 10,
      ok: true,
      httpStatus: 200,
    });

    const { memories } = await orchestrateEdition(
      baseInput(generalCandidates),
      hermes
    );

    // Should have at least:
    // - One "accepted" role_pattern memory (worker accepted on first draft)
    // - One editorial_rule memory (edition record)
    expect(memories.length).toBeGreaterThanOrEqual(2);

    const rolePatterns = memories.filter((m) => m.kind === "role_pattern");
    const editorialRules = memories.filter((m) => m.kind === "editorial_rule");

    expect(rolePatterns.length).toBeGreaterThanOrEqual(1);
    expect(editorialRules.length).toBeGreaterThanOrEqual(1);

    // Editorial rule should contain details about spawned and dormant roles
    const rule = editorialRules[0];
    expect(rule.content).toContain("mem-role");
    expect(rule.content).toContain("sports");
    expect(rule.tags).toContain("edition_record");
  });
});
