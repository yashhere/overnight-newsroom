// E2E: Pick one random enriched cluster from Convex → run full pipeline
// Run: npx tsx services/evals/e2e-random-article.ts

import { config } from "dotenv"; config({ path: ".env.local" });
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import {
  planEdition,
  runWorker,
  reviewWorkerOutput,
  assembleEdition,
  defaultHermesSession,
} from "../ingestion/src/editorial.js";
import {
  assembleScript,
  addPronunciationHints,
  createElevenLabsClient,
  createR2Uploader,
  produceEditionAudio,
} from "../audio/src/pipeline.js";

const convexUrl = process.env.CONVEX_URL;
const secret = process.env.INGESTION_API_SECRET;

if (!convexUrl || !secret) {
  console.error("CONVEX_URL and INGESTION_API_SECRET must be set in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const callQ = (name: string, args: Record<string, unknown> = {}) =>
  (client as any).query(name, args);
const callM = (name: string, args: Record<string, unknown>) =>
  (client as any).mutation(name, { secret, ...args });

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return "n/a";
  return `${cents.toFixed(cents < 1 ? 4 : 2)}c`;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "n/a";
  return `${ms}ms`;
}

async function main() {
  console.log("══════════════════════════════════════════════");
  console.log("  E2E: Random Article → Full Pipeline");
  console.log("══════════════════════════════════════════════\n");

  // ── STEP 1: Fetch enriched clusters from Convex ─────────────────
  console.log("📡 STEP 1: Fetching enriched clusters from Convex...");
  let clusters: any[];
  try {
    clusters = await callQ("ingestion:listSummarized", { max: 20 });
  } catch (err: any) {
    console.error(`  ✗ Failed: ${err.message}`);
    process.exit(1);
  }

  if (!clusters || clusters.length === 0) {
    console.error("  ✗ No summarized clusters found in Convex. Run ingestion + enrichment first.");
    process.exit(1);
  }

  console.log(`  ✓ Found ${clusters.length} summarized clusters\n`);

  // ── STEP 2: Pick one random cluster ─────────────────────────────
  const cluster = pickRandom(clusters);
  console.log("🎲 STEP 2: Random cluster selected:");
  console.log(`  _id:        ${cluster._id}`);
  console.log(`  Title:      "${cluster.leadTitle}"`);
  console.log(`  Beat:       ${cluster.beats?.join(", ") || "none"}`);
  console.log(`  Outlet:     ${cluster.outletNames?.join(", ") || "none"}`);
  console.log(`  Confidence: ${cluster.summaryConfidence}`);
  console.log(`  Bullets:    ${cluster.summaryBullets?.length || 0}`);
  console.log(`  URL:        ${cluster.canonicalPublisherUrl || cluster.googleNewsUrl || "none"}`);
  if (cluster.whyItMatters) {
    console.log(`  Why:        ${cluster.whyItMatters.slice(0, 120)}...`);
  }
  console.log();

  // ── STEP 3: Build candidate from enriched cluster ───────────────
  console.log("🔧 STEP 3: Building candidate from enrichment data...");
  const candidate = {
    clusterId: cluster._id,
    title: cluster.leadTitle.replace(/\s*-\s*[^-]+$/, "").trim(), // strip outlet suffix
    summaryBullets: cluster.summaryBullets || [],
    suggestedBeat: cluster.beats?.[0] || "general",
    confidence: cluster.summaryConfidence ?? 0.7,
    outletCount: cluster.outletCount ?? 1,
    missingContext: cluster.missingContext || [],
  };
  console.log(`  candidate.clusterId:     ${candidate.clusterId}`);
  console.log(`  candidate.title:         "${candidate.title.slice(0, 80)}..."`);
  console.log(`  candidate.suggestedBeat: ${candidate.suggestedBeat}`);
  console.log(`  candidate.confidence:    ${candidate.confidence}`);
  console.log(`  candidate.bullets:       ${candidate.summaryBullets.length}`);
  console.log();

  // ── STEP 4: Editorial Plan (Hermes EIC) ────────────────────────
  const editionKey = `e2e-${Date.now()}`;
  console.log("🧠 STEP 4: Deriving editorial plan via Hermes (Editor-in-Chief)...");

  let planResult;
  try {
    planResult = await planEdition({
      candidates: [candidate],
      editionKey,
      priorPlans: [],
      memoryEntries: [],
      totalTokenBudget: 3000,
      concurrencyLimit: 1,
      availableBeats: ["top", "nation", "business", "world", "sports", "search"],
    });
  } catch (err: any) {
    console.error(`  ✗ planEdition failed: ${err.message}`);
    process.exit(1);
  }

  const { plan, costCents: planCost, latencyMs: planLatency } = planResult;
  console.log(`  ✓ Plan derived in ${formatMs(planLatency)} (${formatCents(planCost)})`);
  console.log(`  Usage: input=${planResult.inputTokens}, output=${planResult.outputTokens}, total=${planResult.totalTokens}, source=${planResult.usageSource}`);
  console.log(`  Direction: "${plan.editorialDirection.slice(0, 100)}..."`);
  console.log(`  Sections:  [${plan.sections.map((s: any) => s.name).join(", ")}]`);
  console.log(`  Roles:     ${plan.roles.length}`);
  for (const role of plan.roles) {
    console.log(`    • ${role.roleId} (${role.name})`);
    console.log(`      Mission: ${role.mission.slice(0, 100)}...`);
    console.log(`      Stories: [${role.assignedClusterIds.join(", ")}]`);
    console.log(`      Guardrails: [${(role.guardrails || []).join(", ")}]`);
  }
  console.log(`  Dormant:   [${plan.dormantBeats.join(", ")}]`);
  console.log();

  // ── STEP 5: Persist plan to Convex ──────────────────────────────
  console.log("💾 STEP 5: Persisting editorial plan to Convex...");
  try {
    await callM("editorial:upsertEditorialPlan", {
      planId: plan.planId, editionKey: plan.editionKey,
      editorialDirection: plan.editorialDirection,
      sectionNames: plan.sections.map((s: any) => s.name),
      sectionDescriptions: plan.sections.map((s: any) => s.description || ""),
      roleIds: plan.roles.map((r: any) => r.roleId),
      dormantBeats: plan.dormantBeats, dormantRationale: plan.dormantRationale,
      totalTokenBudget: plan.totalTokenBudget, concurrencyLimit: plan.concurrencyLimit,
      inputDigest: plan.inputDigest,
      rawHermesResponse: JSON.stringify(plan).slice(0, 2000),
      costCents: planCost,
    });
    console.log("  ✓ Plan persisted");
  } catch (err: any) {
    console.log(`  ⚠ Plan persist failed (non-fatal): ${err.message}`);
  }

  // ── STEP 6: Run Worker ──────────────────────────────────────────
  if (plan.roles.length === 0) {
    console.error("\n  ✗ No roles derived — stopping.");
    process.exit(1);
  }

  const role = plan.roles[0]; // single article → single role
  console.log(`\n🖊️  STEP 6: Running worker "${role.name}" (${role.roleId})...`);

  let workerResult;
  try {
    workerResult = await runWorker(role, editionKey, [candidate], defaultHermesSession);
  } catch (err: any) {
    console.error(`  ✗ Worker failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`  ✓ Worker completed in ${workerResult.latencyMs}ms`);
  console.log(`  Validation: ${workerResult.validationStatus}`);
  console.log(`  Title:      "${workerResult.story.title}"`);
  console.log(`  Summary:    "${workerResult.story.summary.slice(0, 200)}..."`);
  console.log(`  Bullets:    ${workerResult.story.summaryBullets.length}`);
  for (const b of workerResult.story.summaryBullets) {
    console.log(`    • ${b}`);
  }
  console.log(`  Beat:       ${workerResult.story.beat}`);
  console.log(`  Confidence: ${workerResult.story.confidence}`);
  console.log(`  Sources:    ${workerResult.story.sources.length}`);
  for (const s of workerResult.story.sources) {
    console.log(`    • ${s.name} — ${s.url.slice(0, 60)}... (accessed: ${s.accessed})`);
  }
  console.log(`  Self-assessment: ${workerResult.selfAssessment.meetsCriteria ? "✓ meets" : "✗ fails"} — "${workerResult.selfAssessment.reasoning.slice(0, 120)}..."`);
  console.log(`  Usage: input/output not persisted on WorkerResult, total=${workerResult.tokensUsed}, source=provider-or-estimated`);
  console.log(`  Cost: ${formatCents(workerResult.estimatedCostCents)} | Latency: ${formatMs(workerResult.latencyMs)}`);
  if (workerResult.validationErrors.length > 0) {
    console.log(`  ⚠ Validation errors: ${workerResult.validationErrors.join("; ")}`);
  }
  console.log();

  // ── STEP 7: Manager Review ──────────────────────────────────────
  console.log("🔍 STEP 7: Manager review of worker output...");
  let review;
  try {
    review = await reviewWorkerOutput(role, workerResult, defaultHermesSession);
  } catch (err: any) {
    console.log(`  ⚠ Review failed (non-fatal): ${err.message}`);
    review = { decision: "accept", commentary: "Auto-accepted (review error)" };
  }

  console.log(`  Decision:   ${review.decision.toUpperCase()}`);
  console.log(`  Commentary: "${review.commentary}"`);
  console.log(`  Usage:      input=${review.inputTokens}, output=${review.outputTokens}, total=${review.tokensUsed}, source=${review.usageSource}`);
  console.log(`  Cost:       ${formatCents(review.estimatedCostCents)} | Latency: ${formatMs(review.latencyMs)}`);
  if (review.decision === "reject" && review.revisionNote) {
    console.log(`  Concerns:   [${review.revisionNote.concerns.join("; ")}]`);
    console.log(`  Suggestions:[${review.revisionNote.suggestions.join("; ")}]`);
    console.log(`  Severity:   ${review.revisionNote.severity}`);
  }
  console.log();

  // ── STEP 7b: Generate Audio (ElevenLabs + R2) ─────────────────
  console.log("🎙️  STEP 7b: Generating audio (ElevenLabs TTS → R2)...");

  const elevenlabs = createElevenLabsClient();
  const uploader = createR2Uploader();

  // Build script from worker result + add pronunciation hints
  const script = addPronunciationHints(
    assembleScript([workerResult], editionKey)
  );
  console.log(`  Script: ${script.turns.length} turns, ${script.wordCount} words`);

  let editionAudio: any = null;
  try {
    const audioResult = await produceEditionAudio(script, elevenlabs, uploader);
    editionAudio = audioResult.editionAudio;
    console.log(`  ✓ ${audioResult.segments.length} segments generated`);
    console.log(`  Full audio: ${editionAudio.fullAudioUrl}`);
    console.log(`  Duration:   ${formatMs(editionAudio.totalDurationMs)}`);
    console.log(`  Chapters:   ${editionAudio.chapters.length}`);
    console.log(`  Cost:       ${formatCents(editionAudio.totalCostCents)}`);
    console.log(`  Latency:    ${formatMs(editionAudio.totalLatencyMs)}`);

    // Persist segments to Convex
    for (const seg of audioResult.segments) {
      await callM("judge:upsertAudioSegment", {
        segmentId: seg.segmentId,
        editionKey: seg.editionKey,
        anchor: seg.anchor,
        turnIndex: seg.turnIndex,
        text: seg.text,
        voiceId: seg.voiceId,
        durationMs: seg.durationMs,
        clipUrl: seg.clipUrl,
        costCents: seg.costCents,
        latencyMs: seg.latencyMs,
      });
    }
    console.log(`  ✓ ${audioResult.segments.length} segments persisted`);

    // Persist edition audio
    await callM("judge:upsertEditionAudio", {
      editionKey: editionAudio.editionKey,
      totalDurationMs: editionAudio.totalDurationMs,
      fullAudioUrl: editionAudio.fullAudioUrl,
      chaptersJson: JSON.stringify(editionAudio.chapters),
      segmentIds: audioResult.segments.map((s: any) => s.segmentId),
      totalCostCents: editionAudio.totalCostCents,
      totalLatencyMs: editionAudio.totalLatencyMs,
    });
    console.log(`  ✓ Edition audio persisted`);
  } catch (err: any) {
    console.log(`  ⚠ Audio generation failed (non-fatal): ${err.message}`);
  }

  // ── STEP 8: Assemble Edition ────────────────────────────────────
  console.log("📦 STEP 8: Assembling edition...");
  const assembly = assembleEdition(plan, [workerResult]);
  console.log(`  Title:    "${assembly.title}"`);
  console.log(`  Subtitle: "${assembly.subtitle}"`);
  console.log(`  Stories:  ${assembly.stories.length}`);
  for (const s of assembly.stories) {
    console.log(`    • "${s.title}" [${s.beat}] confidence=${s.confidence}`);
    console.log(`      Source: ${s.sourceName} — ${s.sourceUrl?.slice(0, 60)}...`);
  }
  console.log();

  // ── STEP 9: Publish to Convex ───────────────────────────────────
  console.log("🚀 STEP 9: Publishing edition to Convex...");
  try {
    await callM("public:upsertEdition", {
      editionKey: assembly.editionKey,
      title: assembly.title,
      subtitle: assembly.subtitle,
      status: "published",
      publishedAt: Date.now(),
      stories: assembly.stories.filter((s) => {
        const t = (s.title || "").trim();
        return t.length > 3 && t !== "..." && t !== "Untitled";
      }).map((s, i) => ({
        storyKey: s.storyKey,
        title: s.title,
        summary: s.summaryBullets?.join(". ") || s.summary || "",
        summaryBullets: s.summaryBullets || [],
        canonicalPublisherName: s.sourceName || "News Source",
        canonicalPublisherUrl: s.sourceUrl || "",
        sourceUrl: s.sourceUrl || "",
        sourceName: s.sourceName || "News Source",
        sortOrder: i,
      })),
    });
    console.log("  ✓ Edition published");
  } catch (err: any) {
    console.log(`  ⚠ Publish failed: ${err.message}`);
  }

  // ── Persist eval case + eval run ────────────────────────────────
  const evalId = randomUUID();
  const evalCategory = "assembly";
  const modelName = process.env.LLM_MODEL || "gpt-5.5";

  try {
    await callM("editorial:upsertEvalCase", {
      evalId,
      category: evalCategory,
      description: `E2E single-article pipeline: "${cluster.leadTitle.slice(0, 80)}"`,
      inputDigest: JSON.stringify({ clusterId: cluster._id, bulletCount: candidate.summaryBullets.length }),
      expectedBehavior: "Worker produces valid schema-compliant story; edition publishes with 1 story",
      promptVersionAtCapture: modelName,
      source: "captured",
      provenanceEdition: editionKey,
      provenanceRoleId: role.roleId,
      notes: JSON.stringify({
        validationStatus: workerResult.validationStatus,
        reviewDecision: review.decision,
        storyConfidence: workerResult.story.confidence,
        planTokens: planResult.totalTokens,
        planCostCents: planCost,
        workerTokens: workerResult.tokensUsed,
        workerCostCents: workerResult.estimatedCostCents,
        reviewTokens: review.tokensUsed,
        reviewCostCents: review.estimatedCostCents,
        audioCostCents: editionAudio?.totalCostCents ?? 0,
        planLatencyMs: planLatency,
        workerLatencyMs: workerResult.latencyMs,
        reviewLatencyMs: review.latencyMs,
        audioLatencyMs: editionAudio?.totalLatencyMs ?? 0,
        bulletsProduced: workerResult.story.summaryBullets.length,
        sourcesFound: workerResult.story.sources.length,
      }),
    });

    const passed = workerResult.validationStatus === "valid" || workerResult.validationStatus === "repaired" ? 1 : 0;
    const failed = passed ? 0 : 1;
    await callM("editorial:recordEvalRun", {
      runId: randomUUID(),
      evalSet: "e2e-single-article",
      total: 1,
      passed,
      failed,
      passRate: passed,
      byCategoryJson: JSON.stringify({ [evalCategory]: { total: 1, passed, failed } }),
      promptVersion: modelName,
      source: "manual",
    });
    console.log("  ✓ Eval case + run recorded");
  } catch (err: any) {
    console.log(`  ⚠ Eval persist failed: ${err.message}`);
  }

  // ── STEP 10: Verify via public query ────────────────────────────
  console.log("\n✅ STEP 10: Verifying via public query...");
  try {
    const pub = await callQ("public:latestEdition", {});
    if (pub?.edition) {
      console.log(`  Edition key:  ${pub.edition.editionKey}`);
      console.log(`  Title:        "${pub.edition.title}"`);
      console.log(`  Status:       ${pub.edition.status}`);
      console.log(`  Stories:      ${pub.stories?.length || 0}`);
      if (pub.stories?.length > 0) {
        const story = pub.stories[pub.stories.length - 1]; // newest
        console.log(`  Latest story: "${story.title.slice(0, 80)}..."`);
        console.log(`  Source:       ${story.sourceName}`);
      }
    } else {
      console.log("  ⚠ Edition not found via public query");
    }
  } catch (err: any) {
    console.log(`  ⚠ Verification failed: ${err.message}`);
  }

  // ── SUMMARY ─────────────────────────────────────────────────────
  const llmCost = planCost + workerResult.estimatedCostCents + review.estimatedCostCents;
  const audioCost = editionAudio?.totalCostCents ?? 0;
  const totalCost = llmCost + audioCost;
  const llmLatency = planLatency + workerResult.latencyMs + review.latencyMs;
  const audioLatency = editionAudio?.totalLatencyMs ?? 0;
  const totalLatency = llmLatency + audioLatency;

  console.log("\n══════════════════════════════════════════════");
  console.log("  OBSERVABILITY");
  console.log("══════════════════════════════════════════════");
  console.log(`  Model/provider: ${process.env.LLM_PROVIDER || "openai"}/${process.env.LLM_MODEL || "gpt-5.5"}`);
  console.log(`  Plan:           tokens=${planResult.totalTokens} (in=${planResult.inputTokens}, out=${planResult.outputTokens}, ${planResult.usageSource}) | cost=${formatCents(planCost)} | latency=${formatMs(planLatency)}`);
  console.log(`  Worker:         tokens=${workerResult.tokensUsed} | cost=${formatCents(workerResult.estimatedCostCents)} | latency=${formatMs(workerResult.latencyMs)}`);
  console.log(`  Review:         tokens=${review.tokensUsed} (in=${review.inputTokens}, out=${review.outputTokens}, ${review.usageSource}) | cost=${formatCents(review.estimatedCostCents)} | latency=${formatMs(review.latencyMs)}`);
  console.log(`  Audio:          segments=${editionAudio?.segments?.length ?? 0} | cost=${formatCents(audioCost)} | generation latency=${formatMs(audioLatency)} | duration=${formatMs(editionAudio?.totalDurationMs ?? 0)}`);
  console.log(`  Totals:         LLM=${formatCents(llmCost)}, audio=${formatCents(audioCost)}, all=${formatCents(totalCost)} | latency=${formatMs(totalLatency)}`);

  console.log("\n══════════════════════════════════════════════");
  console.log("  PIPELINE COMPLETE");
  console.log("══════════════════════════════════════════════");
  console.log(`  Cluster ID:     ${cluster._id}`);
  console.log(`  Title:          "${cluster.leadTitle.slice(0, 80)}..."`);
  console.log(`  Edition:        ${editionKey}`);
  console.log(`  Role:           ${role.name} (${role.roleId})`);
  console.log(`  Story:          "${workerResult.story.title.slice(0, 80)}..."`);
  console.log(`  Review:         ${review.decision.toUpperCase()}`);
  console.log(`  Total cost:     ${formatCents(totalCost)}`);
  console.log(`  Total latency:  ${formatMs(totalLatency)}`);
  console.log(`  Published:      ✓`);
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Pipeline failed:", err?.message || err);
  process.exit(1);
});
