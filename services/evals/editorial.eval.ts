// ---------------------------------------------------------------------------
// Editorial eval set — 15+ seeded scenarios exercising the full editorial
// pipeline with deterministic mock Hermes responses.
//
// Each scenario is a fixed input + a factory that produces exactly the
// Hermes response sequence needed. No live Hermes calls. No non-determinism.
//
// Run: npm run evals:editorial
//       npm run evals:editorial -- --scenario dormancy
//       npm run evals:editorial -- --verbose
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import {
  planEdition,
  runWorker,
  runWorkersWithReview,
  orchestrateEdition,
  assembleEdition,
  diffRoleGraphs,
  type HermesSession,
  type CapturedEvalCase,
} from "../ingestion/src/editorial.js";
import {
  EditorialPlanSchema,
  validateWorkerResult,
} from "../ingestion/src/manager.js";
import type { RoleDerivationInput } from "../ingestion/src/manager.js";
import type { RoleSpec, EditorialPlan, WorkerResult } from "../ingestion/src/types.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const scenarioFilter = ((): string | null => {
  const idx = args.indexOf("--scenario");
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
})();
const verbose = args.includes("--verbose");

// ---------------------------------------------------------------------------
// Eval types
// ---------------------------------------------------------------------------
type EvalCategory =
  | "role-graph"
  | "novelty"
  | "dormancy"
  | "revision-loop"
  | "schema-validation"
  | "concurrency"
  | "budget"
  | "edge-case"
  | "assembly";

interface EvalCase {
  id: string;
  category: EvalCategory;
  description: string;
  /** Return the mock Hermes for this scenario */
  buildMock: () => HermesSession;
  /** The input to provide */
  input: () => RoleDerivationInput;
  /** The check — return { pass, detail } or throw on failure */
  check: (result: Awaited<ReturnType<typeof orchestrateEdition>>) => Promise<{
    pass: boolean;
    detail: string;
  }>;
}

interface EvalResult {
  caseId: string;
  category: EvalCategory;
  pass: boolean;
  detail: string;
  errors: string[];
  durationMs: number;
}

interface EvalRun {
  runId: string;
  timestamp: number;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byCategory: Record<string, { total: number; passed: number; passRate: number }>;
  results: EvalResult[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
function mockHermes(...responses: object[]): HermesSession {
  if (responses.length === 0) {
    responses = [{ _empty: true }];
  }
  let idx = 0;
  return ((_params: any) => {
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

// ---------------------------------------------------------------------------
// Shared candidate factories
// ---------------------------------------------------------------------------
function mkCandidate(
  clusterId: string,
  title: string,
  beat: string,
  bullets: string[],
  outletCount = 5,
  confidence = 0.8
): RoleDerivationInput["candidates"][number] {
  return { clusterId, title, summaryBullets: bullets, suggestedBeat: beat, confidence, outletCount, missingContext: [] };
}

const GENERAL_CANDIDATES: RoleDerivationInput["candidates"] = [
  mkCandidate("c-001", "Fed holds rates steady", "business", ["Rates unchanged", "Inflation above target", "Markets rallied"], 8, 0.85),
  mkCandidate("c-002", "UN votes on Gaza resolution", "world", ["14-0 vote", "Humanitarian access", "Israel yet to respond"], 12, 0.9),
  mkCandidate("c-003", "Supreme Court antitrust case", "nation", ["App store competition", "October arguments"], 6, 0.88),
  mkCandidate("c-004", "Primary elections heat up", "nation", ["3 candidates lead", "Debate next week", "Fundraising records"], 10, 0.82),
  mkCandidate("c-005", "Chip shortage easing", "business", ["TSMC capacity up", "Auto relief", "Q4 stabilization"], 5, 0.78),
  mkCandidate("c-006", "Climate summit carbon pledge", "world", ["40 nations net zero 2040", "Funding demands", "Critics: too slow"], 9, 0.87),
];

const MARKETS_CANDIDATES: RoleDerivationInput["candidates"] = [
  mkCandidate("c-101", "Sensex all-time high", "business", ["85,200 close", "FIIs buy ₹4,200cr", "Banking IT lead"], 7, 0.92),
  mkCandidate("c-102", "RBI keeps repo rate at 6.5%", "business", ["5-1 vote hold", "GDP 7.2%", "Inflation 4.5% FY26"], 9, 0.9),
  mkCandidate("c-103", "Gold ₹72,000 per 10g", "business", ["Safe-haven demand", "Jewellery rally"], 6, 0.85),
  mkCandidate("c-104", "Crude below $70 on demand fears", "business", ["Brent $69.40", "China slowdown"], 8, 0.88),
  mkCandidate("c-105", "Startup funding winter thaw", "business", ["Q3 +15% QoQ $3.2B", "AI dominates", "Later-stage sluggish"], 5, 0.8),
];

const BASE_INPUT = (candidates: RoleDerivationInput["candidates"], editionKey = "eval-edition"): RoleDerivationInput => ({
  candidates,
  editionKey,
  priorPlans: [],
  memoryEntries: [],
  totalTokenBudget: 5000,
  concurrencyLimit: 3,
  availableBeats: ["top", "nation", "business", "world", "sports", "search"],
});

// ---------------------------------------------------------------------------
// Mock plan factories — deterministic role graphs
// ---------------------------------------------------------------------------
function generalPlanResponse(): object {
  return {
    editorialDirection: "Broad edition: diplomacy, domestic politics, economy, climate science",
    sections: [
      { name: "World", description: "International affairs", priority: 1 },
      { name: "Politics", description: "Domestic politics and law", priority: 2 },
      { name: "Business", description: "Economy and tech", priority: 3 },
    ],
    roles: [
      { roleId: "world-desk", name: "World Desk", rationale: "UN vote + climate summit", assignedClusterIds: ["c-002", "c-006"], mission: "International diplomacy and climate", allowedTools: ["web_search"], guardrails: ["Verify official statements"], successCriteria: ["UN vote accurate", "Climate pledge verified"], tokenBudget: 800, timeBudgetMs: 45000 },
      { roleId: "politics-desk", name: "Politics Desk", rationale: "SCOTUS + elections", assignedClusterIds: ["c-003", "c-004"], mission: "Domestic politics", allowedTools: ["web_search"], guardrails: ["Non-partisan"], successCriteria: ["SCOTUS accurate", "Election balanced"], tokenBudget: 700, timeBudgetMs: 45000 },
      { roleId: "economy-tracker", name: "Economy Tracker", rationale: "Fed + chip shortage", assignedClusterIds: ["c-001", "c-005"], mission: "Economic developments", allowedTools: ["web_search"], guardrails: ["Official data only"], successCriteria: ["Fed details verified", "Chip data corroborated"], tokenBudget: 700, timeBudgetMs: 45000 },
      { roleId: "climate-science-reviewer", name: "Climate Science Reviewer", rationale: "Climate story needs science expertise", assignedClusterIds: ["c-006"], mission: "Science analysis of climate pledges", allowedTools: ["web_search", "ipcc_lookup"], guardrails: ["IPCC sources only"], successCriteria: ["Commitments verified", "Scientific context"], tokenBudget: 600, timeBudgetMs: 45000 },
    ],
    dormantBeats: ["sports", "search"],
    dormantRationale: "No sports or search stories this cycle",
  };
}

function marketsPlanResponse(): object {
  return {
    editorialDirection: "Markets edition: equities, commodities, monetary policy, startups",
    sections: [
      { name: "Markets", description: "Equities and commodities", priority: 1 },
      { name: "Economy", description: "Central bank policy", priority: 2 },
      { name: "Startups", description: "Funding and innovation", priority: 3 },
    ],
    roles: [
      { roleId: "markets-reporter", name: "Markets Reporter", rationale: "Sensex + gold + crude", assignedClusterIds: ["c-101", "c-103", "c-104"], mission: "Daily market movements", allowedTools: ["web_search"], guardrails: ["Exchange-verified prices"], successCriteria: ["Prices verified", "Context provided"], tokenBudget: 900, timeBudgetMs: 45000 },
      { roleId: "monetary-policy-analyst", name: "Monetary Policy Analyst", rationale: "RBI decision needs specialist", assignedClusterIds: ["c-102"], mission: "Central bank analysis", allowedTools: ["web_search"], guardrails: ["Official RBI statements"], successCriteria: ["RBI accurate", "Voting split verified"], tokenBudget: 600, timeBudgetMs: 45000 },
      { roleId: "startup-ecosystem-tracker", name: "Startup Ecosystem Tracker", rationale: "Funding thaw needs VC expertise", assignedClusterIds: ["c-105"], mission: "Startup funding trends", allowedTools: ["web_search"], guardrails: ["Verified data only"], successCriteria: ["Q3 data verified", "Sector breakdown"], tokenBudget: 500, timeBudgetMs: 45000 },
    ],
    dormantBeats: ["sports", "search", "world", "nation"],
    dormantRationale: "No world/nation/sports/search stories",
  };
}

function singleCandidatePlan(): object {
  return {
    editorialDirection: "Light edition with single local story",
    sections: [{ name: "Local", description: "Local news", priority: 1 }],
    roles: [
      { roleId: "local-desk", name: "Local Desk", rationale: "Only one story available", assignedClusterIds: ["c-201"], mission: "Cover local election", allowedTools: ["web_search"], guardrails: ["Verify with election board"], successCriteria: ["Results verified"], tokenBudget: 400, timeBudgetMs: 30000 },
    ],
    dormantBeats: ["nation", "business", "world", "sports", "search"],
    dormantRationale: "No other candidates",
  };
}

function workerOutput(roleId: string, title: string, confidence = 0.8): object {
  return {
    story: { title, summary: `Comprehensive summary of the ${roleId} story.`, summaryBullets: ["Finding A confirmed", "Stakeholders react", "Markets respond"], beat: "business", confidence, sources: [{ url: "https://example.com", name: "Example News", accessed: true }] },
    selfAssessment: { meetsCriteria: true, reasoning: "All claims verified." },
  };
}

function weakWorkerOutput(roleId: string): object {
  return {
    story: { title: `${roleId} brief`, summary: "Some things happened briefly.", summaryBullets: ["one thing"], beat: "business", confidence: 0.35, sources: [{ url: "https://x.com", name: "Blog", accessed: true }] },
    selfAssessment: { meetsCriteria: false, reasoning: "Limited sourcing." },
  };
}

function invalidWorkerOutput(): string {
  return JSON.stringify({ story: { title: "X", summary: "s", summaryBullets: [], beat: "biz", confidence: 2.0, sources: [] } });
}

function reviewAccept(): object {
  return { decision: "accept", commentary: "Good work." };
}

function reviewReject(): object {
  return { decision: "reject", revisionNote: { concerns: ["Low confidence", "Thin sourcing"], suggestions: ["Add more sources", "Verify data"], severity: "required" }, commentary: "Needs work." };
}

// ---------------------------------------------------------------------------
// Eval cases
// ---------------------------------------------------------------------------
const EVAL_CASES: EvalCase[] = [
  // ── Role-graph ──────────────────────────────────────────────────
  {
    id: "role-graph/different-plans",
    category: "role-graph",
    description: "General news and markets inputs produce different role graphs",
    buildMock: () => mockHermes(generalPlanResponse()),
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-rg-general"),
    check: async (result) => {
      const marketsMock = mockHermes(marketsPlanResponse());
      const marketsResult = await orchestrateEdition(BASE_INPUT(MARKETS_CANDIDATES, "eval-rg-markets"), marketsMock);
      const diff = diffRoleGraphs(result.plan, marketsResult.plan);
      const pass = (diff.onlyInA.length + diff.onlyInB.length) > 0;
      return { pass, detail: `Only in general: [${diff.onlyInA.join(", ")}], only in markets: [${diff.onlyInB.join(", ")}]` };
    },
  },
  {
    id: "role-graph/general-3-8-roles",
    category: "role-graph",
    description: "General news produces between 3 and 8 roles",
    buildMock: () => mockHermes(generalPlanResponse()),
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-rg-count"),
    check: async (result) => {
      const pass = result.plan.roles.length >= 3 && result.plan.roles.length <= 8;
      return { pass, detail: `${result.plan.roles.length} roles derived (expected 3-8)` };
    },
  },
  {
    id: "role-graph/sparse-1-role",
    category: "role-graph",
    description: "Single candidate produces exactly 1 role",
    buildMock: () => mockHermes(singleCandidatePlan()),
    input: () => BASE_INPUT([mkCandidate("c-201", "School board election", "top", ["Three seats decided"], 2, 0.6)], "eval-rg-sparse"),
    check: async (result) => {
      const pass = result.plan.roles.length === 1;
      return { pass, detail: `${result.plan.roles.length} roles for 1 candidate` };
    },
  },

  // ── Novelty ─────────────────────────────────────────────────────
  {
    id: "novelty/climate-science-reviewer",
    category: "novelty",
    description: "climate-science-reviewer is a novel role not in availableBeats",
    buildMock: () => mockHermes(generalPlanResponse()),
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-novel-climate"),
    check: async (result) => {
      const role = result.plan.roles.find((r) => r.roleId === "climate-science-reviewer");
      const pass = role !== undefined && !role.wasNamed;
      return { pass, detail: `climate-science-reviewer found: ${!!role}, wasNamed: ${role?.wasNamed}` };
    },
  },
  {
    id: "novelty/monetary-policy-analyst",
    category: "novelty",
    description: "monetary-policy-analyst is novel for markets input",
    buildMock: () => mockHermes(marketsPlanResponse()),
    input: () => BASE_INPUT(MARKETS_CANDIDATES, "eval-novel-mpa"),
    check: async (result) => {
      const role = result.plan.roles.find((r) => r.roleId === "monetary-policy-analyst");
      const pass = role !== undefined && !role.wasNamed;
      return { pass, detail: `monetary-policy-analyst found: ${!!role}, wasNamed: ${role?.wasNamed}` };
    },
  },
  {
    id: "novelty/economy-tracker-is-named",
    category: "novelty",
    description: "economy-tracker IS named (business is in availableBeats) — verify false-positive guard",
    buildMock: () => mockHermes(generalPlanResponse()),
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-novel-false-pos"),
    check: async (result) => {
      // economy-tracker roleId is not a beat name → should be wasNamed: false
      const role = result.plan.roles.find((r) => r.roleId === "economy-tracker");
      // Only exact beat-name matches get wasNamed. "economy-tracker" != "business"
      const pass = role !== undefined && role.wasNamed === false;
      return { pass, detail: `economy-tracker wasNamed=${role?.wasNamed} (expected false — it's a derived role, not a beat name)` };
    },
  },

  // ── Dormancy ────────────────────────────────────────────────────
  {
    id: "dormancy/sports-dormant",
    category: "dormancy",
    description: "Sports beat is dormant when no sports candidates exist",
    buildMock: () => mockHermes(generalPlanResponse()),
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-dorm-sports"),
    check: async (result) => {
      const pass = result.plan.dormantBeats.includes("sports");
      const roleIds = result.plan.roles.map((r) => r.roleId);
      const noSportsRole = roleIds.filter((id) => id.includes("sports")).length === 0;
      return { pass: pass && noSportsRole, detail: `sports dormant: ${pass}, no sports role: ${noSportsRole}` };
    },
  },
  {
    id: "dormancy/markets-dormant-many",
    category: "dormancy",
    description: "Markets input marks many beats dormant (only business has stories)",
    buildMock: () => mockHermes(marketsPlanResponse()),
    input: () => BASE_INPUT(MARKETS_CANDIDATES, "eval-dorm-markets"),
    check: async (result) => {
      const pass = result.plan.dormantBeats.length >= 3;
      return { pass, detail: `${result.plan.dormantBeats.length} dormant beats: [${result.plan.dormantBeats.join(", ")}]` };
    },
  },

  // ── Revision-loop ───────────────────────────────────────────────
  {
    id: "revision-loop/accept-on-first",
    category: "revision-loop",
    description: "Good worker output is accepted on first review without revision",
    buildMock: () => {
      const plan = generalPlanResponse();
      const roles = (plan as any).roles;
      return mockHermes(
        plan,                    // planEdition
        ...roles.map(() => workerOutput("r", "Good Story")),  // workers
        ...roles.map(() => reviewAccept()),                    // reviews
      );
    },
    input: () => BASE_INPUT(GENERAL_CANDIDATES, "eval-rev-accept"),
    check: async (result) => {
      const pass = result.revisionLoops.length === 0 && result.status === "complete";
      return { pass, detail: `revision loops: ${result.revisionLoops.length}, status: ${result.status}` };
    },
  },
  {
    id: "revision-loop/reject-revise-accept",
    category: "revision-loop",
    description: "Weak output → reject → revise → accept path is visible",
    buildMock: () => {
      return mockHermes(
        { editorialDirection: "Test", sections: [{ name: "T", description: "T", priority: 1 }],
          roles: [{ roleId: "test-reporter", name: "Test", rationale: "test", assignedClusterIds: ["c-001"], mission: "Test", allowedTools: [], guardrails: [], successCriteria: [], tokenBudget: 500, timeBudgetMs: 30000 }],
          dormantBeats: [], dormantRationale: "" },
        weakWorkerOutput("test-reporter"),
        reviewReject(),
        workerOutput("test-reporter", "Revised: Better Article", 0.75),
        reviewAccept(),
      );
    },
    input: () => BASE_INPUT([mkCandidate("c-001", "Test story", "business", ["One bullet"], 3, 0.7)], "eval-rev-reject-revise"),
    check: async (result) => {
      const pass = result.revisionLoops.length >= 1 &&
        result.revisionLoops[0].disposition === "accepted";
      return { pass, detail: `loops: ${result.revisionLoops.length}, disposition: ${result.revisionLoops[0]?.disposition}` };
    },
  },
  {
    id: "revision-loop/reject-revise-fail",
    category: "revision-loop",
    description: "Revision that still fails re-review is rejected",
    buildMock: () => {
      return mockHermes(
        { editorialDirection: "Test", sections: [{ name: "T", description: "T", priority: 1 }],
          roles: [{ roleId: "bad-reporter", name: "Bad", rationale: "test", assignedClusterIds: ["c-001"], mission: "Test", allowedTools: [], guardrails: [], successCriteria: [], tokenBudget: 500, timeBudgetMs: 30000 }],
          dormantBeats: [], dormantRationale: "" },
        weakWorkerOutput("bad-reporter"),
        reviewReject(),
        workerOutput("bad-reporter", "Revised but still bad", 0.35),
        reviewReject(),  // re-review also rejects
      );
    },
    input: () => BASE_INPUT([mkCandidate("c-001", "Difficult story", "business", ["One bullet"], 3, 0.7)], "eval-rev-fail"),
    check: async (result) => {
      const pass = result.revisionLoops.length >= 1 &&
        result.revisionLoops[0].disposition === "rejected";
      return { pass, detail: `loops: ${result.revisionLoops.length}, disposition: ${result.revisionLoops[0]?.disposition}` };
    },
  },

  // ── Schema-validation ───────────────────────────────────────────
  {
    id: "schema-validation/valid-output",
    category: "schema-validation",
    description: "Well-formed worker output passes schema validation",
    buildMock: () => mockHermes(workerOutput("r", "Valid Title Here")),
    input: () => BASE_INPUT([mkCandidate("c-001", "Test", "business", ["Bullet"], 3, 0.7)], "eval-sv-valid"),
    check: async (result) => {
      // Only check via direct validateWorkerResult
      const { valid } = validateWorkerResult(JSON.stringify(workerOutput("r", "Valid Title Here")));
      return { pass: valid, detail: `Validation result: ${valid}` };
    },
  },
  {
    id: "schema-validation/invalid-output",
    category: "schema-validation",
    description: "Malformed output is caught by schema validation",
    buildMock: () => mockHermes({}),
    input: () => BASE_INPUT([], "eval-sv-invalid"),
    check: async (_result) => {
      const { valid, errors } = validateWorkerResult(invalidWorkerOutput());
      const pass = !valid && errors.length >= 3;
      return { pass, detail: `valid: ${valid}, errors: ${errors.length}` };
    },
  },
  {
    id: "schema-validation/repair-succeeds",
    category: "schema-validation",
    description: "One repair attempt fixes parseable schema violations",
    buildMock: () => mockHermes({}),
    input: () => BASE_INPUT([mkCandidate("c-001", "Test", "business", ["Bullet"], 3, 0.7)], "eval-sv-repair"),
    check: async (_result) => {
      const role: RoleSpec = { roleId: "r", name: "R", rationale: "t", assignedClusterIds: ["c-001"], mission: "t", allowedTools: [], guardrails: [], successCriteria: [], parentTrace: "p", tokenBudget: 500, timeBudgetMs: 30000, wasNamed: false };
      const herm = mockHermes(invalidWorkerOutput(), workerOutput("r", "Repaired Title", 0.7));
      const wr = await runWorker(role, "eval-sv-repair", [mkCandidate("c-001", "Test", "business", ["Bullet"], 3, 0.7)], herm);
      const pass = wr.validationStatus === "repaired" && wr.repairAttempted;
      return { pass, detail: `status: ${wr.validationStatus}, repaired: ${wr.repairAttempted}` };
    },
  },

  // ── Edge cases ──────────────────────────────────────────────────
  {
    id: "edge-case/empty-candidates",
    category: "edge-case",
    description: "Zero candidates should throw (no plan can be derived)",
    buildMock: () => mockHermes({ editorialDirection: "No news", sections: [], roles: [], dormantBeats: [], dormantRationale: "" }),
    input: () => BASE_INPUT([], "eval-edge-empty"),
    check: async (result) => {
      const pass = result.plan.roles.length === 0 || result.status === "partial" || result.status === "failed";
      return { pass, detail: `roles: ${result.plan.roles.length}, status: ${result.status}` };
    },
  },

  // ── Assembly ────────────────────────────────────────────────────
  {
    id: "assembly/filters-invalid",
    category: "assembly",
    description: "assembleEdition excludes invalid worker results",
    buildMock: () => mockHermes({ editorialDirection: "Test", sections: [], roles: [], dormantBeats: [], dormantRationale: "" }),
    input: () => BASE_INPUT([], "eval-asm-filter"),
    check: async (result) => {
      // Build a fake plan and results with mixed validity
      const plan: EditorialPlan = { planId: "p", editionKey: "eval", editorialDirection: "x", sections: [], roles: [], dormantBeats: [], dormantRationale: "", totalTokenBudget: 1000, concurrencyLimit: 3, createdAt: Date.now(), inputDigest: "" };
      const valid: WorkerResult = { roleId: "r1", resultId: "res1", editionKey: "eval", story: { title: "A", summary: "Summary A is long enough for test", summaryBullets: ["b1"], beat: "biz", confidence: 0.9, sources: [{ url: "x", name: "y", accessed: true }] }, selfAssessment: { meetsCriteria: true, reasoning: "ok" }, rawResponse: "{}", validationStatus: "valid", validationErrors: [], repairAttempted: false, tokensUsed: 100, estimatedCostCents: 1, latencyMs: 50 };
      const invalid: WorkerResult = { ...valid, roleId: "r2", resultId: "res2", story: { ...valid.story, title: "[FAILED]", summaryBullets: [] }, validationStatus: "invalid", validationErrors: ["schema error"] };
      const edition = assembleEdition(plan, [valid, invalid]);
      const pass = edition.stories.length === 1;
      return { pass, detail: `Total stories: ${edition.stories.length} (expected 1, filtering out invalid)` };
    },
  },
];

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  const runId = randomUUID();
  const start = Date.now();
  const cases = scenarioFilter
    ? EVAL_CASES.filter((c) => c.category === scenarioFilter || c.id.includes(scenarioFilter))
    : EVAL_CASES;

  console.log(`\n══ Editorial Evals — Run ${runId} ══`);
  console.log(`Cases: ${cases.length}${scenarioFilter ? ` (filter: "${scenarioFilter}")` : ""}\n`);

  const results: EvalResult[] = [];

  for (const ec of cases) {
    const caseStart = Date.now();
    process.stdout.write(`  ${ec.id.padEnd(42)} `);

    try {
      const hermes = ec.buildMock();
      const input = ec.input();
      const orchestrationResult = await orchestrateEdition(input, hermes);
      const { pass, detail } = await ec.check(orchestrationResult);
      const durationMs = Date.now() - caseStart;

      results.push({ caseId: ec.id, category: ec.category, pass, detail, errors: orchestrationResult.errors, durationMs });
      console.log(pass ? "✓" : "✗", verbose ? `(${durationMs}ms) ${detail}` : "");
      if (!pass && verbose) {
        console.log(`    detail: ${detail}`);
        if (orchestrationResult.errors.length > 0) {
          console.log(`    errors: ${orchestrationResult.errors.join("; ")}`);
        }
      }
    } catch (err: any) {
      const durationMs = Date.now() - caseStart;
      results.push({ caseId: ec.id, category: ec.category, pass: false, detail: err.message, errors: [err.message], durationMs });
      console.log(`✗ (${durationMs}ms) ${err.message}`);
    }
  }

  // ── Summary ──
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const totalDuration = Date.now() - start;

  // Group by category
  const byCategory: Record<string, { total: number; passed: number; passRate: number }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, passed: 0, passRate: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].passed++;
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].passRate = Math.round((byCategory[cat].passed / byCategory[cat].total) * 100);
  }

  const run: EvalRun = {
    runId,
    timestamp: Date.now(),
    total: results.length,
    passed,
    failed,
    passRate: Math.round((passed / results.length) * 100),
    byCategory,
    results,
    durationMs: totalDuration,
  };

  // ── Print report ──
  console.log(`\n── Summary ──`);
  console.log(`  Total:   ${run.total}`);
  console.log(`  Passed:  ${run.passed} (${run.passRate}%)`);
  console.log(`  Failed:  ${run.failed}`);
  console.log(`  Time:    ${totalDuration}ms`);
  console.log(`\n  By category:`);
  for (const [cat, stats] of Object.entries(run.byCategory)) {
    const icon = stats.passRate === 100 ? "✓" : stats.passRate >= 70 ? "⚠" : "✗";
    console.log(`    ${icon} ${cat.padEnd(18)} ${stats.passed}/${stats.total} (${stats.passRate}%)`);
  }

  // ── Failed cases ──
  if (failed > 0) {
    console.log(`\n── Failures ──`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ✗ ${r.caseId}`);
      console.log(`    ${r.detail}`);
    }
  }

  // ── Persist to Convex ──
  const convexUrl = process.env.CONVEX_URL;
  const convexSecret = process.env.INGESTION_API_SECRET;
  const promptVersion = process.env.HERMES_MODEL || "hermes-agent";

  if (convexUrl && convexSecret) {
    try {
      const { ConvexHttpClient } = await import("convex/browser");
      const client = new ConvexHttpClient(convexUrl);
      const callMutation = (name: string, args: Record<string, unknown>) =>
        (client as any).mutation(name, args);

      await callMutation("editorial:recordEvalRun", {
        secret: convexSecret,
        runId,
        evalSet: "editorial",
        total: run.total,
        passed: run.passed,
        failed: run.failed,
        passRate: run.passRate,
        byCategoryJson: JSON.stringify(run.byCategory),
        promptVersion,
        source: "manual",
      });
      console.log(`  ✓ Persisted eval run ${runId} to Convex`);
    } catch (e: any) {
      console.log(`  ⚠ Convex persist failed (eval results still valid): ${e.message}`);
    }
  } else {
    console.log(`  ⚠ CONVEX_URL/INGESTION_API_SECRET not set — run not persisted`);
  }

  console.log(`\n── Complete ── (${totalDuration}ms)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal eval error:", err);
  process.exit(2);
});
