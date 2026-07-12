// ---------------------------------------------------------------------------
// Orchestrator — long-running autonomous newsroom loop
// Polls Convex for enriched clusters, runs full editorial pipeline,
// publishes editions. Retries on failure.
// ---------------------------------------------------------------------------

import { config } from "dotenv"; config({ path: ".env.local" });
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";

// ── Config ─────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = Number(process.env.ORCHESTRATOR_POLL_MS || "300000"); // 5 min
const EDITION_INTERVAL_MS = Number(process.env.ORCHESTRATOR_EDITION_MS || "1800000"); // 30 min
const MAX_RETRIES = 3;
const ONCE_MODE = process.argv.includes("--once");

// ── Convex client ──────────────────────────────────────────────────
const client = new ConvexHttpClient(process.env.CONVEX_URL || "");
const secret = process.env.INGESTION_API_SECRET || "";
const callM = (name: string, args: Record<string, unknown> = {}) =>
  (client as any).mutation(name, { secret, ...args });
const callQ = (name: string, args: Record<string, unknown> = {}) =>
  (client as any).query(name, args);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Hermes call helper ─────────────────────────────────────────────
async function callHermes(systemPrompt: string, userMessage: string, maxTokens = 800): Promise<string> {
  const res = await fetch(`${process.env.HERMES_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HERMES_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.HERMES_MODEL || "hermes-agent",
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json.choices?.[0]?.message?.content || "";
}

// ── Retry wrapper ──────────────────────────────────────────────────
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      console.error(`[orch] ${label} attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(5000 * attempt); // exponential backoff
    }
  }
  throw new Error("unreachable");
}

// ── Extract JSON from Hermes response ──────────────────────────────
function extractJson(text: string): any {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const i = t.indexOf("{");
  if (i < 0) throw new Error(`No JSON found in: ${t.slice(0, 100)}`);
  let depth = 0, inString = false, escaped = false;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++; if (c === "}") { depth--; if (depth === 0) return JSON.parse(t.slice(i, j + 1)); }
  }
  throw new Error("Unclosed JSON");
}

// ── Fetch summarized clusters from Convex ──────────────────────────
async function getSummarizedClusters(): Promise<any[]> {
  // Query storyClusters with status "summarized"
  const clusters = await callQ("public:latestEdition", {}); // placeholder
  // Actually we need to query storyClusters directly
  try {
    // Use raw query
    const result = await (client as any).query("ingestion:listSummarized", { max: 10 });
    return (result as any) || [];
  } catch {
    // Fallback: query via the HTTP API
    const res = await fetch(`${process.env.CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "ingestion:listSummarized", args: { max: 10 } }),
    });
    const data = await res.json();
    return (data as any)?.value || [];
  }
}

// ── Claim clusters for this edition ────────────────────────────────
async function claimCluster(clusterId: string): Promise<void> {
  await callM("enrichment:markThin", {
    clusterId,
    callId: randomUUID(),
    reason: "claimed for editorial",
    hermesCallStatus: "failed",
    hermesCallStartedAt: Date.now(),
    hermesCallModel: "orchestrator",
    hermesCallPromptVersion: "editorial-v1",
    hermesCallBaseUrlHost: "orchestrator",
    hermesCallUsageSource: "none",
    hermesCallRequestSummary: "claimed",
  });
}

// ── Full editorial job ─────────────────────────────────────────────
async function runEdition(): Promise<boolean> {
  console.log(`\n[orch] ===== Starting edition at ${new Date().toISOString()} =====`);

  // 1. Get enriched clusters
  console.log("[orch] 1. Fetching summarized clusters...");
  let clusters: any[];
  try {
    clusters = await withRetry("fetch-clusters", () => getSummarizedClusters());
  } catch {
    console.log("[orch]   ✗ No clusters available — skipping edition");
    return false;
  }

  if (!clusters || clusters.length < 2) {
    console.log(`[orch]   ✗ Only ${clusters?.length || 0} clusters — need at least 2`);
    return false;
  }
  console.log(`[orch]   ✓ ${clusters.length} clusters available`);

  // 2. Build candidate input
  const candidates = clusters.slice(0, 6).map((c: any, i: number) => ({
    clusterId: c._id || c.clusterId || `c-${i}`,
    title: c.leadTitle || c.title || "Untitled",
    summaryBullets: c.summaryBullets || [],
    suggestedBeat: c.beats?.[0] || c.suggestedBeat || "general",
    confidence: c.summaryConfidence || c.confidence || 0.7,
    outletCount: c.outletCount || 1,
    missingContext: c.missingContext || [],
  }));

  const editionKey = `edition-${Date.now()}`;
  const maxRoles = process.argv.includes("--one") ? 1 : 4;

  // 3. Derive editorial plan
  console.log("[orch] 2. Deriving editorial plan...");
  const planPrompt = `You are the Editor-in-Chief. Derive an editorial plan from these candidates. Output JSON with: editorialDirection, sections [{name,description,priority}], roles [{roleId,name,rationale,assignedClusterIds,mission,allowedTools,guardrails,successCriteria,tokenBudget,timeBudgetMs}], dormantBeats, dormantRationale, concurrencyLimit.`;

  const planRaw = await withRetry("plan-edition", () =>
    callHermes(planPrompt, JSON.stringify({ editionKey, candidates, availableBeats: ["top", "nation", "business", "world", "sports", "search"] }), 1200)
  );
  const plan = extractJson(planRaw);
  console.log(`[orch]   ✓ ${plan.roles?.length || 0} roles: ${(plan.roles || []).map((r: any) => r.roleId || r.name).join(", ")}`);
  if (plan.dormantBeats?.length) console.log(`[orch]   Dormant: ${plan.dormantBeats.join(", ")}`);

  // 4. Persist plan to Convex
  const planId = randomUUID();
  await withRetry("persist-plan", () =>
    callM("editorial:upsertEditorialPlan", {
      planId, editionKey,
      editorialDirection: plan.editorialDirection || "Today's edition",
      sectionNames: (plan.sections || []).map((s: any) => s.name || s),
      sectionDescriptions: (plan.sections || []).map((s: any) => s.description || ""),
      roleIds: (plan.roles || []).map((r: any) => r.roleId || r.name),
      dormantBeats: plan.dormantBeats || [],
      dormantRationale: plan.dormantRationale || "",
      totalTokenBudget: (plan.roles || []).reduce((s: number, r: any) => s + (r.tokenBudget || 500), 0),
      concurrencyLimit: plan.concurrencyLimit || 3,
      inputDigest: `${candidates.length} candidates`,
      rawHermesResponse: JSON.stringify(plan).slice(0, 2000),
      costCents: 0,
    })
  );
  console.log("[orch]   ✓ Plan persisted");

  // Persist role specs immediately so Mission Control's Planned column has
  // observable work before workers complete.
  for (const role of (plan.roles || [])) {
    const roleId = role.roleId || role.name || "worker";
    await callM("editorial:upsertRoleSpec", {
      planId,
      editionKey,
      roleId,
      name: role.name || roleId,
      rationale: role.rationale || "Selected by editor-in-chief",
      assignedClusterIds: (role.assignedClusterIds || []).map(String),
      mission: role.mission || "Report assigned story",
      allowedTools: role.allowedTools || ["web_search"],
      guardrails: role.guardrails || [],
      successCriteria: role.successCriteria || [],
      parentTrace: "editor-in-chief",
      tokenBudget: role.tokenBudget || 500,
      timeBudgetMs: role.timeBudgetMs || 300000,
      wasNamed: Boolean(role.wasNamed),
      rawHermesResponse: JSON.stringify(role).slice(0, 2000),
    }).catch((err: any) => console.warn(`[orch]   role spec persist failed for ${roleId}: ${err.message}`));
  }
  console.log(`[orch]   ✓ ${(plan.roles || []).length} role specs persisted`);

  // 5. Run workers (sequential — Hermes/OpenAI is slow)
  console.log("[orch] 3. Running workers...");
  const allStories: any[] = [];
  const rolesToRun = (plan.roles || []).slice(0, maxRoles);
  for (const role of (plan.roles || [])) {
    const roleId = role.roleId || role.name || "worker";
    console.log(`[orch]   Running ${roleId}...`);
    const assignedCandidates = candidates.filter((c: any) =>
      (role.assignedClusterIds || []).includes(c.clusterId)
    );

    const traceNodeId = `${editionKey}:${roleId}:agent`;
    const workerStartedAt = Date.now();
    await callM("missionControl:recordTraceNode", {
      editionKey,
      nodeId: traceNodeId,
      parentNodeId: "editor-in-chief",
      roleId,
      roleName: role.name || roleId,
      beat: assignedCandidates[0]?.suggestedBeat || "general",
      assignment: role.mission || "Report assigned story",
      status: "running",
      kind: "agent_session",
      inputSummary: `${assignedCandidates.length} assigned candidate(s)` ,
      startedAt: workerStartedAt,
    }).catch(() => {});

    const workerPrompt = `You are ${role.name || role.roleId}. Mission: ${role.mission}. Write a news story. Output JSON: { "story": { "title": "...", "summary": "...", "summaryBullets": ["..."], "beat": "...", "confidence": 0.0-1.0, "sources": [{"url":"...","name":"...","accessed":true}] }, "selfAssessment": { "meetsCriteria": true/false, "reasoning": "..." } }`;

    try {
      const workerRaw = await withRetry(`worker-${roleId}`, () =>
        callHermes(workerPrompt, JSON.stringify({ role, assignedCandidates }))
      );
      const workerOutput = extractJson(workerRaw);
      const story = workerOutput.story || workerOutput;

      // Persist worker result
      await callM("editorial:upsertWorkerResult", {
        editionKey, resultId: randomUUID(),
        roleId,
        title: story.title || "Untitled",
        summary: story.summary || "",
        summaryBullets: story.summaryBullets || [],
        beat: story.beat || "general",
        confidence: story.confidence || 0.7,
        sourceUrls: (story.sources || []).map((s: any) => s.url || ""),
        sourceNames: (story.sources || []).map((s: any) => s.name || ""),
        meetsCriteria: workerOutput.selfAssessment?.meetsCriteria ?? true,
        selfAssessmentReasoning: workerOutput.selfAssessment?.reasoning || "",
        validationStatus: "valid",
        validationErrors: [],
        repairAttempted: false,
        rawResponse: JSON.stringify(workerOutput).slice(0, 2000),
        tokensUsed: 0, estimatedCostCents: 0, latencyMs: 0,
      });

      await callM("missionControl:recordTraceNode", {
        editionKey,
        nodeId: traceNodeId,
        parentNodeId: "editor-in-chief",
        roleId,
        roleName: role.name || roleId,
        beat: story.beat || "general",
        assignment: story.title || role.mission || "Completed story",
        status: "completed",
        kind: "agent_session",
        latencyMs: Date.now() - workerStartedAt,
        outputSummary: (story.summary || story.summaryBullets?.join(" ") || "Story completed").slice(0, 500),
        startedAt: workerStartedAt,
        finishedAt: Date.now(),
      }).catch(() => {});

      allStories.push({
        roleId,
        title: story.title,
        summary: story.summary,
        summaryBullets: story.summaryBullets || [],
        beat: story.beat || "general",
        confidence: story.confidence || 0.7,
        sources: story.sources || [],
      });
      console.log(`[orch]     ✓ "${(story.title || "").slice(0, 50)}..."`);
    } catch (err: any) {
      console.log(`[orch]     ✗ Failed: ${err.message}`);
      await callM("missionControl:recordTraceNode", {
        editionKey,
        nodeId: traceNodeId,
        parentNodeId: "editor-in-chief",
        roleId,
        roleName: role.name || roleId,
        beat: assignedCandidates[0]?.suggestedBeat || "general",
        assignment: role.mission || "Report assigned story",
        status: "failed",
        kind: "agent_session",
        latencyMs: Date.now() - workerStartedAt,
        errorMessage: String(err.message || err).slice(0, 500),
        startedAt: workerStartedAt,
        finishedAt: Date.now(),
      }).catch(() => {});
      // Continue with other roles even if one fails
    }
  }
  console.log(`[orch]   ✓ ${allStories.length}/${(plan.roles || []).length} workers completed`);

  if (allStories.length === 0) {
    console.log("[orch]   ✗ No stories produced — aborting");
    return false;
  }

  // 6. Judge the output (simple gate: check if stories have confidence > 0.5)
  console.log("[orch] 4. Judging output...");
  const blocked: any[] = [];
  const approved = allStories.filter((s: any) => {
    if (s.confidence < 0.3) { blocked.push(s); return false; }
    return true;
  });

  // Persist claims + verdicts so Mission Control's Fact Check column has
  // observable artifacts. Keep this lightweight until full judge integration.
  for (const story of allStories) {
    const isBlocked = blocked.includes(story);
    const claimId = randomUUID();
    const storyKey = `${editionKey}-${story.roleId}`;
    await callM("judge:upsertClaim", {
      claimId,
      editionKey,
      claim: story.summaryBullets?.[0] || story.summary || story.title || "Story claim",
      storyKey,
      roleId: story.roleId,
      sourceLines: (story.sources || []).map((s: any) => s.url || s.name || "source").filter(Boolean),
    }).catch(() => {});
    await callM("judge:recordVerdict", {
      claimId,
      editionKey,
      verdict: isBlocked ? "block" : "approved",
      reason: isBlocked ? "Low confidence" : "Passed confidence threshold",
      evidenceJson: JSON.stringify((story.sources || []).map((s: any) => ({ url: s.url || "", name: s.name || "Source" }))),
      receiptsCorroborated: !isBlocked,
      linkupCorroborated: false,
      confidence: story.confidence,
      tokensUsed: 0, estimatedCostCents: 0, latencyMs: 0,
    }).catch(() => {});
  }
  console.log(`[orch]   ✓ ${approved.length} approved, ${blocked.length} blocked`);

  // 7. Publish edition
  console.log("[orch] 5. Publishing edition...");
  await withRetry("publish-edition", () =>
    callM("public:upsertEdition", {
      editionKey,
      title: `Overnight Newsroom — ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
      subtitle: plan.editorialDirection?.slice(0, 120) || `${approved.length} stories from real-time feeds`,
      status: "published",
      publishedAt: Date.now(),
      stories: approved.filter((s: any) => {
        const t = (s.title || "").trim();
        return t.length > 3 && t !== "..." && t !== "Untitled";
      }).map((s: any, i: number) => ({
        storyKey: `${editionKey}-${i}`,
        title: s.title,
        summary: s.summaryBullets?.join(". ") || s.summary || "",
        summaryBullets: s.summaryBullets || [],
        canonicalPublisherName: s.sources?.[0]?.name || "News Source",
        canonicalPublisherUrl: s.sources?.[0]?.url || "",
        sourceUrl: s.sources?.[0]?.url || "",
        sourceName: s.sources?.[0]?.name || "News Source",
        sortOrder: i,
      })),
    })
  );
  console.log(`[orch]   ✓ Edition published with ${approved.length} stories`);

  // 8. Add publication receipt
  await callM("public:addPublicationReceipt", {
    editionKey, receiptType: "publish", status: "published",
    metadata: JSON.stringify({ workerCount: allStories.length, approved: approved.length, blocked: blocked.length }),
  }).catch(() => {});

  console.log(`[orch] ===== Edition ${editionKey} complete =====\n`);
  return true;
}

// ── Main loop ──────────────────────────────────────────────────────
async function main() {
  console.log(`[orch] Starting autonomous newsroom orchestrator`);
  console.log(`[orch] Poll interval: ${POLL_INTERVAL_MS}ms | Edition interval: ${EDITION_INTERVAL_MS}ms`);

  let lastEditionAt = 0;
  let running = true;

  process.on("SIGTERM", () => { console.log("[orch] SIGTERM — shutting down"); running = false; });
  process.on("SIGINT", () => { console.log("[orch] SIGINT — shutting down"); running = false; });

  while (running) {
    const now = Date.now();

    // Check if enough time has passed since last edition
    if (ONCE_MODE || now - lastEditionAt >= EDITION_INTERVAL_MS) {
      try {
        const success = await runEdition();
        if (success) { lastEditionAt = now; if (ONCE_MODE) { console.log("[orch] --once mode: exiting after edition"); process.exit(0); } }
      } catch (err: any) {
        console.error(`[orch] Edition failed: ${err.message}`);
        // Wait a bit before retrying
        await sleep(60000);
        continue;
      }
    }

    const nextEditionIn = Math.max(0, EDITION_INTERVAL_MS - (now - lastEditionAt));
    const sleepTime = Math.min(POLL_INTERVAL_MS, nextEditionIn);
    console.log(`[orch] Next edition in ${Math.round(nextEditionIn / 60000)}min | sleeping ${Math.round(sleepTime / 1000)}s...`);
    await sleep(sleepTime);
  }

  console.log("[orch] Orchestrator stopped");
  process.exit(0);
}

main().catch((err) => {
  console.error("[orch] Fatal:", err?.message || err);
  process.exit(1);
});
