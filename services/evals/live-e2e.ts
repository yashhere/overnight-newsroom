// Live E2E: planEdition (real Hermes) → persist to Convex
import { config } from "dotenv"; config({ path: ".env.local" });
// Run: npx tsx services/evals/live-e2e.ts
// tsx auto-loads .env.local

import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { planEdition } from "../ingestion/src/editorial.js";

const convexUrl = process.env.CONVEX_URL;
const secret = process.env.INGESTION_API_SECRET;

if (!convexUrl || !secret) {
  console.error("CONVEX_URL and INGESTION_API_SECRET must be set in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const call = (name: string, args: Record<string, unknown>) =>
  (client as any).mutation(name, { secret, ...args });

const CANDIDATES = [
  { clusterId: "live-c-001", title: "Fed holds rates steady at 5.25-5.50%", summaryBullets: ["Federal Reserve kept interest rates unchanged", "Inflation remains above 2% target", "Markets rallied on the decision"], suggestedBeat: "business", confidence: 0.85, outletCount: 8, missingContext: [] },
  { clusterId: "live-c-002", title: "UN Security Council votes 14-0 on Gaza ceasefire resolution", summaryBullets: ["Resolution passes with one abstention", "Calls for immediate humanitarian access", "Israel, Hamas yet to respond"], suggestedBeat: "world", confidence: 0.9, outletCount: 12, missingContext: [] },
  { clusterId: "live-c-003", title: "Supreme Court agrees to hear tech antitrust case", summaryBullets: ["Case centers on app store competition", "Could reshape digital marketplace rules", "Oral arguments set for October"], suggestedBeat: "nation", confidence: 0.88, outletCount: 6, missingContext: [] },
  { clusterId: "live-c-004", title: "Primary elections heat up as three candidates lead in polls", summaryBullets: ["Key debate scheduled for next week", "Fundraising records broken across parties", "Voter turnout expected to be high"], suggestedBeat: "nation", confidence: 0.82, outletCount: 10, missingContext: [] },
  { clusterId: "live-c-005", title: "Global chip shortage shows signs of easing", summaryBullets: ["TSMC reports increased production capacity", "Auto industry sees supply relief", "Prices expected to stabilize by Q4"], suggestedBeat: "business", confidence: 0.78, outletCount: 5, missingContext: [] },
  { clusterId: "live-c-006", title: "Climate summit yields unprecedented carbon pledge", summaryBullets: ["40 nations commit to net zero by 2040", "Developing nations demand climate funding", "Critics say timeline still too slow"], suggestedBeat: "world", confidence: 0.87, outletCount: 9, missingContext: [] },
];

async function main() {
  const editionKey = `live-${Date.now()}`;
  console.log(`\n══ Live E2E — ${editionKey} ══\n`);
  console.log(`Convex: ${convexUrl}`);
  console.log(`Hermes: ${process.env.HERMES_BASE_URL}\n`);

  // 1. Plan — real Hermes call
  console.log("1. planEdition: deriving roles from 6 candidates...");
  const start = Date.now();

  const { plan, costCents, latencyMs } = await planEdition({
    candidates: CANDIDATES,
    editionKey,
    priorPlans: [],
    memoryEntries: [],
    totalTokenBudget: 5000,
    concurrencyLimit: 3,
    availableBeats: ["top", "nation", "business", "world", "sports", "search"],
  });

  console.log(`   ✓ ${plan.roles.length} roles in ${latencyMs}ms (${costCents}c)`);
  for (const role of plan.roles) {
    console.log(`     • ${role.roleId} (${role.name}) — ${role.assignedClusterIds.length} stories`);
  }
  console.log(`   Dormant: [${plan.dormantBeats.join(", ")}]`);

  // 2. Persist to Convex
  console.log("\n2. Persisting to Convex...");
  await call("editorial:upsertEditorialPlan", {
    planId: plan.planId, editionKey: plan.editionKey,
    editorialDirection: plan.editorialDirection,
    sectionNames: plan.sections.map((s) => s.name),
    sectionDescriptions: plan.sections.map((s) => s.description),
    roleIds: plan.roles.map((r) => r.roleId),
    dormantBeats: plan.dormantBeats, dormantRationale: plan.dormantRationale,
    totalTokenBudget: plan.totalTokenBudget, concurrencyLimit: plan.concurrencyLimit,
    inputDigest: plan.inputDigest,
    rawHermesResponse: JSON.stringify(plan).slice(0, 2000),
    costCents,
  });
  console.log("   ✓ Plan persisted");

  for (const role of plan.roles) {
    await call("editorial:upsertRoleSpec", {
      planId: plan.planId, editionKey: plan.editionKey,
      roleId: role.roleId, name: role.name, rationale: role.rationale,
      assignedClusterIds: role.assignedClusterIds, mission: role.mission,
      allowedTools: role.allowedTools, guardrails: role.guardrails,
      successCriteria: role.successCriteria, parentTrace: role.parentTrace,
      tokenBudget: role.tokenBudget, timeBudgetMs: role.timeBudgetMs,
      wasNamed: role.wasNamed,
      rawHermesResponse: JSON.stringify({ roleId: role.roleId }).slice(0, 2000),
    });
  }
  console.log(`   ✓ ${plan.roles.length} role specs persisted`);

  // 3. Verify
  console.log("\n3. Verifying via public query...");
  const planFromDb = await (client as any).query("editorial:getLatestPlan", { editionKey });
  if (planFromDb) {
    console.log(`   ✓ Read back: ${planFromDb.roleIds.length} roles, "${planFromDb.editorialDirection.slice(0, 60)}..."`);
  } else {
    console.log("   ✗ NOT FOUND — check Convex deployment");
  }

  console.log(`\n══ Done in ${Date.now() - start}ms ══\n`);
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});
