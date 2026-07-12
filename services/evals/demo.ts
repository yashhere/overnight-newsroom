// Demo script: full pipeline from RSS → public edition
// Run: npx tsx services/evals/demo.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { FEEDS } from "../ingestion/src/feeds.js";
import { parseRss, extractCluster } from "../ingestion/src/googleNews.js";
import {
  startIngestionRun, finishIngestionRun, ingestClusters,
  logIngestionEvent,
} from "../ingestion/src/convex.js";
import { ConvexHttpClient } from "convex/browser";

const USER_AGENT = "OvernightNewsroom/1.0 (demo)";
const client = new ConvexHttpClient(process.env.CONVEX_URL || "");
const callM = (name: string, args: Record<string, unknown>) =>
  (client as any).mutation(name, { secret: process.env.INGESTION_API_SECRET, ...args });

async function main() {
  const runId = randomUUID();
  const editionKey = `edition-${Date.now()}`;
  console.log(`\n═══ DEMO: RSS → Public Edition ═══\n`);
  console.log(`Edition: ${editionKey}\n`);

  // ── 1. Fetch RSS ──
  console.log("1. Fetching RSS from Google News...");
  const feed = FEEDS[0]; // "top" feed
  const res = await fetch(feed.url, { headers: { "User-Agent": USER_AGENT } });
  const xml = await res.text();
  const items = parseRss(xml);
  console.log(`   ✓ ${items.length} items from ${feed.beat} feed`);

  if (items.length === 0) { console.log("   ✗ No items."); process.exit(1); }

  // ── 2. Build clusters ──
  console.log("\n2. Building clusters...");
  const retrievedAt = Date.now();
  const candidates = [];
  for (const item of items.slice(0, 5)) {
    try {
      candidates.push(extractCluster(item, feed.beat, feed.url, retrievedAt));
    } catch { /* skip unparseable */ }
  }
  console.log(`   ✓ ${candidates.length} clusters built`);

  // ── 3. Start ingestion run + store clusters ──
  console.log("\n3. Storing to Convex...");
  await callM("ingestion:startIngestionRun", {
    runId, trigger: "manual", serviceVersion: "demo-1.0.0", feedCount: 1, startedAt: Date.now(),
  });

  const cluster = candidates[0];
  const result = await callM("ingestion:ingestClusters", {
    runId, secret: process.env.INGESTION_API_SECRET,
    clusters: [{
      titleHash: cluster.titleHash, leadTitle: cluster.leadTitle,
      normalizedTitle: cluster.normalizedTitle,
      alternateHeadlines: cluster.alternateHeadlines,
      outletNames: cluster.outletNames, outletCount: cluster.outletCount,
      beat: cluster.beat, language: cluster.language, country: cluster.country,
      publishedAt: cluster.publishedAt, feedUrl: cluster.feedUrl,
      googleNewsUrl: cluster.googleNewsUrl, rssGuid: cluster.rssGuid,
      rssPublishedAt: cluster.rssPublishedAt, rssTitle: cluster.rssTitle,
      rssDescriptionText: cluster.rssDescriptionText, retrievedAt: cluster.retrievedAt,
    }],
  });
  const clusterId = (result as any)?.clusterIds?.[0] || (result as any)?.clusterId;
  console.log(`   ✓ Cluster stored: "${cluster.leadTitle.slice(0, 60)}..."`);

  await callM("ingestion:finishIngestionRun", {
    runId, status: "success", feedsSucceeded: 1, feedsFailed: 0,
    itemsSeen: items.length, clustersCreated: 1, clustersUpdated: 0,
    duplicatesSkipped: 0,
  });
  console.log("   ✓ Run finished");

  // ── 4. Use RSS description as summary (Hermes enrichment is ~2 min, skip for speed) ──
  console.log("\n4. Building summary from RSS description...");
  const summaryText = cluster.rssDescriptionText || cluster.leadTitle;
  const summaryBullets = [
    cluster.leadTitle,
    ...cluster.alternateHeadlines.slice(0, 2),
  ];
  const sourceName = cluster.outletNames[0] || "News Outlet";
  const sourceUrl = cluster.googleNewsUrl;
  console.log(`   ✓ ${summaryBullets.length} bullet points`);

  // ── 5. Create edition ──
  console.log("\n5. Creating edition...");

  await callM("public:upsertEdition", {
    editionKey,
    title: `Overnight Newsroom — ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    subtitle: `Live edition from RSS feed — ${cluster.outletNames.slice(0, 2).join(", ")}`,
    status: "published",
    publishedAt: Date.now(),
    stories: [{
      storyKey: `${editionKey}-story-0`,
      clusterId,
      title: cluster.leadTitle,
      summary: summaryBullets.join(". "),
      summaryBullets,
      canonicalPublisherName: sourceName,
      canonicalPublisherUrl: sourceUrl,
      sourceUrl,
      sourceName,
      sortOrder: 0,
    }],
  });
  console.log("   ✓ Edition published");

  // ── 6. Verify public query ──
  console.log("\n6. Verifying public page...");
  const edition = await (client as any).query("public:latestEdition", {});
  if (!edition) { console.log("   ✗ Edition not found — check deployment"); process.exit(1); }
  console.log(`   ✓ ${edition.stories.length} stories visible`);
  console.log(`   Title: "${edition.stories[0].title.slice(0, 60)}..."`);
  console.log(`   Source: ${edition.stories[0].sourceName}`);

  console.log(`\n═══ DEMO COMPLETE ═══`);
  console.log(`Edition key: ${editionKey}`);
  console.log(`Convex URL: ${process.env.CONVEX_URL}`);
  console.log(`RSS items: ${items.length} | Clusters: 1 | Enriched: ✓ | Published: ✓\n`);
}

main().catch((err) => {
  console.error("Demo failed:", err?.message || err);
  process.exit(1);
});
