---
id: ONR-016
number: 16
title: Ship the OCI ingestion service (RSS poller plus Hermes enricher)
body: First v2.1 ingestion and enrichment slice for Google News RSS, Hermes bullet summaries, and Convex observability, hosted on the OCI VM.
type: issue
status: pending-user-confirmation
priority: P0
phase: event-day-frontier
blocked_by:
  - ONR-001
blocks:
  - ONR-004
  - ONR-011
labels:
  - ready-for-agent
  - oci
  - convex
  - hermes
  - ingestion
  - observability
prd: ../overnight-newsroom-prd-v2.md
supersedes:
  - Old ONR-003 hybrid RSS and public-page gateway from PRD v1.
  - Previous draft of ONR-003 that placed ingestion in a Cloudflare Worker.
---

# 016 — Ship the OCI ingestion service

## Goal

Build the first ingestion slice for Overnight Newsroom v2.1 as two small systemd services on the OCI VM. A poller fetches five or six Google News RSS feeds every 15 minutes and writes normalized story clusters to Convex. An enricher claims pending clusters and calls the Hermes API server on localhost for a structured bullet-point summary, then writes the summary and observability records back to Convex.

This slice should ship first and run continuously through the sprint. Later newsroom stages read from the same tables.

## Why no Cloudflare Worker

An earlier draft placed the poller in a Cloudflare Worker. Two facts made that the wrong shape:

1. Cloudflare Workers cap scheduled invocations at 30 seconds of wall clock time. A tick that produces 15 new clusters cannot wait for 15 sequential Hermes summaries, and Hermes calling its browser tool internally does not shorten a single response.
2. The Hermes API server runs on the OCI VM on plain HTTP. Cloudflare Workers refuse HTTPS to HTTP calls, so an enricher on the Worker cannot reach Hermes without a TLS terminator that is not worth building tomorrow.

Once the enricher runs on OCI under systemd, the VM already provides the durable off-the-laptop process the Worker was there for. A cron-triggered systemd timer on the same VM fetches six URLs cheaply, and the Cloudflare +25 power-up is already earned through Pages hosting the newspaper and R2 serving audio, both of which are visible real work for a mentor. The Worker would be a third piece with no additional points.

## Important boundary

The poller does **not** fetch Google News article links or publisher article pages. It stores the Google News URL only as a discovery receipt. The enricher is the only component that attempts links, through Hermes, which uses its browser or web tool server-side to read a public page or search the headline as a fallback. Nothing bypasses paywalls, logins, or anti-bot protections. A failed fetch marks the cluster thin and the pipeline moves on.

## Proposed repository layout

```text
convex/
  schema.ts
  http.ts
  ingestion.ts
  enrichment.ts
  observability.ts
  _generated/
services/
  ingestion/
    package.json
    tsconfig.json
    src/
      poller.ts           # systemd timer target, one-shot per tick
      enricher.ts         # long-running loop
      feeds.ts            # hardcoded feed list
      googleNews.ts       # RSS parsing and normalization
      hermes.ts           # OpenAI-compatible client for the Hermes API server
      convex.ts           # Convex Node client wrapper
      cost.ts             # token and cost estimation helpers
      types.ts
    test/
      googleNews.test.ts
      fixtures/
        top-stories.xml
        topic-feed.xml
    systemd/
      newsroom-poller.service
      newsroom-poller.timer
      newsroom-enricher.service
```

Root `package.json` scripts:

```json
{
  "scripts": {
    "convex:dev": "convex dev",
    "convex:deploy": "convex deploy",
    "svc:build": "cd services/ingestion && tsc -p .",
    "svc:test": "cd services/ingestion && vitest run",
    "svc:poll": "cd services/ingestion && node dist/poller.js",
    "svc:enrich": "cd services/ingestion && node dist/enricher.js"
  }
}
```

## Feed set

Hardcoded in `services/ingestion/src/feeds.ts` for day one. A `sourceFeeds` config table can come later without changing readers.

```ts
export const FEEDS = [
  { url: "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en", beat: "top" },
  { url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en", beat: "nation" },
  { url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en", beat: "business" },
  { url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en", beat: "world" },
  { url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en", beat: "sports" },
  { url: "https://news.google.com/rss/search?q=india%20when:2h&hl=en-IN&gl=IN&ceid=IN:en", beat: "search" },
];
```

## Poller design

`services/ingestion/src/poller.ts` is a one-shot Node script.

1. Start an `ingestionRuns` record in Convex with status `running` and trigger `scheduled`.
2. Fetch all feeds concurrently with `Promise.allSettled`. A dead feed does not stop the run. Send a normal user agent, e.g., `OvernightNewsroom/1.0 (buildathon)`.
3. Record one event per feed with status, HTTP code, byte count, latency, item count, and error class if any. These are `events` rows with family `ingestion`.
4. Parse RSS with `fast-xml-parser` and normalize each item into a candidate cluster.
5. In a single Convex mutation, upsert candidates by `titleHash + language` and append a `clusterReceipts` row per sighting. New clusters get `summaryStatus: pending`.
6. Finish the run row with aggregate counts and latency.

A tick with nothing new should complete in under 5 seconds. A tick with fresh content and dozens of items should complete in under 15 seconds.

### RSS parsing rules

- The top stories feed returns items where the description contains a cluster of anchors and outlet names. Parse anchor texts and outlet names from the escaped HTML description.
- Topic and search feeds usually return single articles. Treat a single article as a cluster of one, so the downstream shape is uniform.
- Strip trailing source suffixes like " - The Hindu" from lead titles with the regex `/\s+-\s+[^-]+$/`.
- Normalize titles by lowercasing, removing everything except letters, digits, and spaces, collapsing whitespace, and trimming.
- Hash normalized titles with SHA-256 to hex, using `node:crypto`.
- Store the original Google News URL as the discovery receipt and never fetch it in the poller.

## Enricher design

`services/ingestion/src/enricher.ts` is a long-running Node loop under systemd.

1. Every 60 seconds, run a Convex mutation `claimPending({ max: 3 })` that atomically flips up to three clusters from `pending` to `claimed`, with `claimedAt`. Also reclaim any cluster stuck in `claimed` for more than 5 minutes.
2. For each claimed cluster, call the Hermes API server on `http://localhost:8642/v1/chat/completions` with a bounded timeout, e.g., 45 seconds.
3. Validate the JSON response with Zod. On success, call `saveEnrichment`. On timeout, bad JSON, or a confidence below 0.3, call `markThin` with a short note. Never retry in a tight loop.
4. Keep a rolling one-hour counter. Stop claiming past 30 enrichments per hour so cost stays bounded on a heavy news hour.
5. Emit trace nodes and events for every attempt, success, and failure.

### Hermes API server call

The Hermes API server is OpenAI-compatible. Call shape:

```http
POST http://localhost:8642/v1/chat/completions
Authorization: Bearer $HERMES_API_KEY
Content-Type: application/json

{
  "model": "$HERMES_MODEL",
  "temperature": 0.2,
  "max_tokens": 450,
  "response_format": {"type": "json_object"},
  "messages": [
    {"role": "system", "content": "<enricher system prompt>"},
    {"role": "user",   "content": "<one story bundle as JSON>"}
  ]
}
```

Hermes uses its browser or web tool internally to complete this request. The client does not orchestrate tool calls.

Expected model output:

```json
{
  "summaryBullets": ["...", "..."],
  "whyItMatters": "...",
  "suggestedBeat": "nation|business|world|sports|general|other",
  "confidence": 0.0,
  "missingContext": ["..."],
  "sources": [
    {
      "sourceName": "The Hindu",
      "url": "https://example.com/story",
      "accessed": true,
      "accessedAt": "2026-07-12T06:30:00.000Z",
      "notes": "Resolved from headline search; public page accessible.",
      "content": "Concise content notes or extracted text returned by Hermes.",
      "contentKind": "article_text|snippet|search_result|rss_description|other",
      "confidence": 0.0
    }
  ]
}
```

### Cost and token accounting

Hermes may or may not return a `usage` block. Handle both:

- If `usage.prompt_tokens` and `usage.completion_tokens` are present, store them and set `usageSource: "provider"`.
- If not, estimate with `Math.ceil(chars / 4)` for prompt and response text and set `usageSource: "estimated"`.
- Compute cost from configurable rates `HERMES_INPUT_USD_PER_1M_TOKENS` and `HERMES_OUTPUT_USD_PER_1M_TOKENS`.
- Store cost as `estimatedCostCents` (integer). Sub-cent precision is false precision here.
- Measure latency around the HTTP request in the client.

### The enricher prompt

The system prompt, verbatim:

```
You are a news content enricher. You receive one story: a lead headline,
alternate headlines from other outlets, outlet names, and a Google News
discovery link.

1. Try to read the article at the link. If it redirects, follow it. If it
   fails, is paywalled, or shows a consent page, search the web for the
   headline instead and read one public article covering the same story.
2. Never bypass a paywall, login, or anti-bot protection.
3. Output ONLY a JSON object matching the schema you have been given. No
   prose, no markdown fences.
4. Every fact in summaryBullets must come from what you read. If you could
   not read enough, return summaryBullets: [] and confidence: 0.
```

## Convex setup

Free plan is sufficient. A day of this system writes a few thousand small documents and makes tens of thousands of function calls.

Provisioning:

```bash
npm install convex
CONVEX_AGENT_MODE=anonymous npx convex dev --once
npx convex deploy
npx convex env set INGESTION_API_SECRET <random-secret>
```

The poller and enricher can use either the Convex Node client (`ConvexHttpClient` from the `convex/browser` module works in Node) or a single HTTP action. Prefer the Node client, since it is one line per call and avoids designing an HTTP surface for a service that only ever talks to itself.

### HTTP surface

Keep the HTTP action minimal: one route for a health probe, `GET /health`, returning schema version and last successful run id. All other reads and writes go through the Convex client with a shared secret checked inside each mutation.

## Convex schema

Design for observability and Mission Control, not just stories. Trimmed from the earlier draft to remove overlapping tables.

### `sourceFeeds` (optional, deferred)

Not built on day one. Feeds live in `feeds.ts`. Add this table only if the operator UI needs live toggles.

### `ingestionRuns`

One poller invocation.

Fields: `runId`, `trigger` ("scheduled" | "manual"), `serviceVersion`, `status` ("running" | "success" | "partial" | "failed"), `startedAt`, `finishedAt?`, `latencyMs?`, `feedCount`, `feedsSucceeded`, `feedsFailed`, `itemsSeen`, `clustersCreated`, `clustersUpdated`, `duplicatesSkipped`, `errorSummary?`.

Indexes: `by_startedAt`, `by_status_startedAt`, `by_trigger_startedAt`.

### `storyClusters`

Canonical discovery cluster used by later newsroom stages.

Fields: `titleHash`, `leadTitle`, `normalizedTitle`, `alternateHeadlines`, `outletNames`, `outletCount`, `beats`, `language`, `country`, `publishedAt?`, `firstSeenAt`, `lastSeenAt`, `status` ("discovered" | "summarized" | "thin" | "selected" | "aired" | "suppressed"), `summaryStatus` ("pending" | "claimed" | "summarized" | "thin" | "failed"), `claimedAt?`, `summaryBullets?`, `whyItMatters?`, `summaryConfidence?`, `missingContext?`, `summaryPromptVersion?`, `latestHermesCallId?`, `canonicalPublisherUrl?`, `extractionConfidence?`, `createdAt`, `updatedAt`.

Indexes: `by_titleHash_language`, `by_status_lastSeenAt`, `by_summaryStatus_lastSeenAt`, `by_language_lastSeenAt`.

`canonicalPublisherUrl` and `extractionConfidence` are set from the best Hermes-returned source, folding what would have been a separate `clusterSourceRecords` table into the cluster itself.

### `clusterReceipts`

Provenance for repeated feed sightings.

Fields: `clusterId`, `runId`, `feedUrl`, `beat`, `googleNewsUrl`, `rssGuid?`, `rssPublishedAt?`, `rssTitle`, `rssDescriptionText?`, `outletNames`, `retrievedAt`.

Indexes: `by_clusterId_retrievedAt`, `by_runId`, `by_googleNewsUrl`.

### `hermesCalls`

Every Hermes API server call.

Fields: `callId`, `runId?`, `clusterId?`, `purpose` ("rss_summary"), `provider` ("hermes_openai_compat"), `baseUrlHost`, `model`, `promptVersion`, `status` ("success" | "failed" | "timeout" | "parse_error"), `startedAt`, `finishedAt?`, `latencyMs?`, `httpStatus?`, `inputTokens?`, `outputTokens?`, `totalTokens?`, `usageSource` ("provider" | "estimated" | "none"), `estimatedCostCents?`, `requestSummary`, `responseSummary?`, `errorClass?`, `errorMessage?`.

Indexes: `by_clusterId_startedAt`, `by_status_startedAt`, `by_model_startedAt`.

### `events`

Append-only event stream for Mission Control. Absorbs what an earlier draft split across `feedFetches`, `traceNodes`, and `dependencyHealth`.

Fields: `eventId`, `runId?`, `clusterId?`, `hermesCallId?`, `family` ("ingestion" | "enrichment" | "source" | "cost" | "health" | "exception"), `type`, `severity` ("debug" | "info" | "warning" | "error"), `message`, `dataRedacted?`, `createdAt`.

Indexes: `by_createdAt`, `by_runId_createdAt`, `by_family_createdAt`, `by_severity_createdAt`.

Health snapshots are just the latest event per service, queried on demand.

## OCI setup

### Node and process supervision

Install Node 20 and build the service:

```bash
sudo apt install -y nodejs npm
cd services/ingestion
npm install
npm run svc:build
```

### Environment file

`/etc/newsroom.env`:

```
CONVEX_URL=https://<deployment>.convex.cloud
INGESTION_API_SECRET=<shared-secret>
HERMES_BASE_URL=http://localhost:8642/v1
HERMES_API_KEY=<bearer>
HERMES_MODEL=deepseek-v4-pro
HERMES_TIMEOUT_MS=45000
HERMES_INPUT_USD_PER_1M_TOKENS=<rate>
HERMES_OUTPUT_USD_PER_1M_TOKENS=<rate>
SUMMARY_PROMPT_VERSION=rss-summary-v1
```

`chmod 600 /etc/newsroom.env`.

### systemd units

`/etc/systemd/system/newsroom-poller.service`:

```ini
[Unit]
Description=Overnight Newsroom RSS poller
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/home/<user>/newsroom/services/ingestion
EnvironmentFile=/etc/newsroom.env
ExecStart=/usr/bin/node dist/poller.js
```

`/etc/systemd/system/newsroom-poller.timer`:

```ini
[Unit]
Description=Poll Google News every 15 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
AccuracySec=30s
Unit=newsroom-poller.service

[Install]
WantedBy=timers.target
```

`/etc/systemd/system/newsroom-enricher.service`:

```ini
[Unit]
Description=Overnight Newsroom Hermes enricher
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/<user>/newsroom/services/ingestion
EnvironmentFile=/etc/newsroom.env
ExecStart=/usr/bin/node dist/enricher.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now newsroom-poller.timer
sudo systemctl enable --now newsroom-enricher.service
```

Both survive SSH disconnect and crashes, which the PRD checklist requires.

## Security

- No secrets in the repo. `/etc/newsroom.env` is `chmod 600` and owned by the service user.
- Convex mutations check `INGESTION_API_SECRET` from the arguments.
- The Hermes bearer token stays in the env file. It never appears in Convex records or logs.
- Redacted request and response summaries only in Convex. Never full raw payloads.
- The `/health` HTTP action returns non-sensitive fields only.

## Cost and rubric mapping

- Every `hermesCalls` and `ingestionRuns` row records tokens, cost, and latency. That is the observability L4 requirement (7x weight, 21 points).
- Enrichment runs on a background schedule outside the timed edition run. This is the design that lets the cost and latency parameter score L4 (target 3 points on 1x weight) without cutting audio quality.
- The `events` and trace fields on `hermesCalls` support the L5 stretch: diff two runs, alert on cost spike, search across runs. Wire the L5 stretch after the core loop works.

## Acceptance criteria

- [ ] Convex project has the trimmed schema (`ingestionRuns`, `storyClusters`, `clusterReceipts`, `hermesCalls`, `events`) and one `/health` HTTP action.
- [ ] Services build in `services/ingestion` with a single `svc:build` command.
- [ ] The poller fetches six Google News RSS feeds with concurrency and treats each response independently.
- [ ] The parser handles both feed shapes and returns a cluster of one for single-article items.
- [ ] The poller deduplicates by normalized title hash and never fetches Google News article links.
- [ ] The poller completes a scheduled run in under 10 seconds when no new stories are present.
- [ ] The enricher claims pending clusters atomically and never processes the same cluster twice.
- [ ] The enricher calls the Hermes API server on localhost and parses the structured JSON response.
- [ ] Hermes-returned facts, canonical URL, and confidence land on the cluster row.
- [ ] `hermesCalls` records show client-measured latency, tokens (provider or estimated), and estimated cost.
- [ ] A stuck claim is reclaimed after 5 minutes.
- [ ] Enrichment volume is capped at 30 per hour.
- [ ] systemd timer and service files enable the poller and enricher to survive an SSH disconnect and a service restart.
- [ ] Unit tests cover RSS parser fixtures (both shapes and a malformed description), title normalization, hash dedup, Hermes response parsing, and cost estimation.
- [ ] No secrets appear in git, Convex records, or logs intended for Mission Control.

## Verification checklist

1. `npx convex deploy` succeeds and the dashboard shows the tables.
2. `npm run svc:test` passes.
3. `sudo systemctl start newsroom-poller.service` creates one `ingestionRuns` row with child receipts and events.
4. Running the poller a second time updates receipts and last-seen timestamps instead of duplicating clusters.
5. `sudo systemctl status newsroom-enricher.service` is active. Within two minutes, at least one cluster flips from `pending` to `summarized` with populated bullets and canonical URL.
6. `sudo systemctl stop newsroom-enricher.service` and confirm pending clusters accumulate. Restart it and confirm they process.
7. Kill the enricher mid-claim (send SIGKILL) and confirm the stuck claim is reclaimed after 5 minutes.
8. `journalctl -u newsroom-enricher -f` shows structured events for each attempt with no secrets.

## Out of scope

- Editor-in-Chief planning and dynamic role derivation.
- Reporter, Judge, and Publisher agents.
- Linkup trust gate.
- ElevenLabs audio, R2 audio hosting, Telegram publishing.
- Newspaper website and Mission Control UI (they read the tables built here, but the UI is separate tickets).
- A Convex `sourceFeeds` config table.
