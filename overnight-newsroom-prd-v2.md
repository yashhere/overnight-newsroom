---
id: ONR-PRD-001
title: Overnight Newsroom
slug: overnight-newsroom
type: prd
status: ready-for-agent
version: 2.1.0
created_at: 2026-07-11
updated_at: 2026-07-12
owner: chandamama
track: AI as Agency
source: GrowthX Hermes Buildathon Builder Handbook
labels:
  - ready-for-agent
  - hermes-buildathon
  - ai-as-agency
  - autonomous-newsroom
  - zero-outreach
related_documents:
  - /home/azureuser/hermes_buildathon_handoff.md
  - /home/azureuser/hermes_buildathon_handbook.txt
issue_directory: ./issues
---

# Overnight Newsroom, product requirements document

## What changed in v2

Version 2 replaces the source acquisition design and adds an explicit rubric strategy. The changes are:

1. Google News RSS is the only discovery source. There are no publisher feeds to hunt for and no scraper adapters. Six URLs from one provider, with one XML shape, cover discovery. The scraper fallback ticket (ONR-003) is deleted, not deferred.
2. Google News article links are never fetched. They are encrypted redirects that cannot be resolved to publisher URLs and often return consent pages to servers. They are stored as discovery receipts only.
3. Linkup is the content layer, not a corroboration add-on. Reporters gather facts for each picked story from a Linkup search on its headline. The Judge verifies claims against the canonical publisher URLs that Linkup returns. This removes all article fetching and paywall risk, and it makes the Linkup power-up load bearing.
4. Semantic dedup is mostly free. The Google News top stories feed groups the same event across outlets into one item, so the parser extracts these clusters directly. A title hash handles overlap across feeds. The embedding layer is deferred unless near duplicates leak through in testing.
5. Every design decision is now mapped to the rubric parameter it earns, with a target level and a fallback level. The rubric strategy section is the contract for the build.
6. HTMLRewriter, domain allowlists, robots handling, and per-publisher extraction confidence are removed from the design because nothing is scraped.

Everything else from v1 stands: the dynamic agent organisation, the fail-closed fact gate, the three-pane Mission Control, the newspaper website, chaptered audio, cron scheduling with an enqueue and runtime split, and Convex as the single source of truth.

## What changed in v2.1

Version 2.1 adds a content enrichment stage and partially supersedes v2 changes 2 and 3.

1. A Hermes-driven enricher now sits between discovery and editorial. It runs frequently, obtains article content and the canonical publisher URL for new clusters, and stores summaries in Convex. When the edition cron fires, the editor selects from clusters whose content is already stored, so the timed run contains no research wait. This improves edition latency, repeated-run reliability, and the cost and latency score, because research cost is attributed to background enrichment runs rather than the timed task.
2. Reporters write from stored enriched content instead of researching live. Their role specs get cheaper and their job becomes writer-per-beat, but they remain ephemeral and derived per edition.
3. Linkup moves to the trust gate. The Judge corroborates claims with live search on every edition, reporters keep Linkup only as a fallback when their cluster is thin, and the breaking sentinel uses it to confirm corroboration.
4. The v2 rule that nothing fetches article links is narrowed rather than dropped. The Worker still never fetches links. Only the enricher attempts them, with browser-grade fetching, and a failed fetch degrades to a headline search instead of failing the pipeline.

## Problem statement

People following Indian news face a fragmented stream of articles, live blogs, and clips. A commuter cannot quickly learn what matters, what changed since the last update, or which claims are sourced. Existing summaries are text-only, manually triggered, repetitive, and opaque about how stories were selected or verified.

For the buildathon, the product must prove more than summarisation. It must show a complete newsroom function run by an autonomous, observable organisation of agents. It must publish real output to real public surfaces without a human triggering each edition, and it must show dynamic management, durable memory, fact gating, measurable evaluation, and repeated autonomous runs.

The builder is solo and has no pre-existing repository backlog, inbox, customer list, or audience to use as a live surface. The product therefore creates its own legitimate public surface from public news inputs, with no outreach and no fabricated activity.

## Solution

Overnight Newsroom is an autonomous Indian news operation powered by Hermes. A Cloudflare Worker polls six Google News RSS feeds on a schedule and writes normalized story clusters into Convex. A Hermes enricher then runs frequently in the background, obtains the article content and canonical publisher URL for each new cluster, and stores a summary with key facts in Convex. On each edition cron tick, an Editor-in-Chief session reads the fresh enriched clusters and prior coverage, creates a different editorial plan for each edition, derives the specialist roles that plan needs, and launches ephemeral Hermes workers. No worker roles are registered in advance.

Each beat reporter drafts segment notes from the enriched content, with a source receipt on every fact, and falls back to a Linkup search only when the stored content is thin. The Editor-in-Chief reviews drafts and returns weak ones with revision notes. A Judge decomposes the script into atomic claims, corroborates them with live Linkup results, and blocks any claim without sufficient evidence. Blocked claims become regression cases. Approved scripts are rendered as two-anchor audio with ElevenLabs, assembled with FFmpeg, stored in R2, published on a newspaper-style public website, and posted to a Telegram channel through the Hermes gateway.

Hermes cron triggers a standard edition every 30 to 45 minutes during the event. Convex stores newsroom state, story memory, decisions, traces, costs, prompt versions, evaluation cases, publication receipts, and engagement events.

The core proof is a scrollable public history of editions that published while the builder was doing something else, with timestamps, source receipts, dynamic agent trees, judge decisions, and links to the exact Telegram and website output.

## Rubric strategy

This section is the contract for the build. Every ticket must state which row it serves. The scoring formula is points = (level minus 1) times weight.

| Parameter | Weight | Target | Fallback | How the design earns the target |
|---|---|---|---|---|
| Working product shipping real output | 20x | L5 (80) plus overflow | L4 (60) | The Telegram channel and the public website are real live surfaces. Three or more editions publish end to end with no human touch, escalation happens by exception only, and success holds at 85% or better across repeated runs. The 30 to 45 minute cadence means 2 to 3 editions publish during the judging window, and each one pays 20 overflow points. One published edition is one real task. |
| Agent org structure | 5x | L5 (20) | L4 (15) | Only the Editor-in-Chief is a stable role. It derives role specs from the current news mix, so two editions produce two different role graphs. At least one run spawns a specialist not named in the manager instructions. At least one draft is rejected and revised. Stuck workers escalate with a concrete blocker instead of looping. |
| Observability | 7x | L4 (21), L5 stretch (28) | L3 (14) | Every step emits a trace node with parent, role, tokens, latency, and estimated cost. Mission Control renders the tree per edition and filters by role or task. The L5 stretch adds a side-by-side run diff, a cost spike alert that has actually fired, and search across runs. |
| Evaluation and iteration | 5x | L4 (15), L5 stretch (20) | L3 (10) | Blocked claims are captured automatically as evaluation cases tied to a prompt version. Prompts are version-controlled in git. The eval set runs before a prompt change is accepted, and a pass rate below the threshold blocks the change. A pass rate chart across versions is shown on the dashboard. The L5 story is that failures feed the set automatically and the trend is visible. |
| Agent handoffs and memory | 2x | L5 (8) | L4 (6) | The rubric's three memory layers are implemented by name. Now is the current edition state in Convex. The user's past is story memory of prior coverage, so follow-ups cite earlier editions and unchanged stories are suppressed. Business rules are the newsroom policy document injected into every role spec. All three survive every handoff because each role spec carries the bundle. |
| Cost and latency per task | 1x | L4 (3) | L3 (2) | Target under 150 seconds and under $0.50 per edition. Content is enriched in the background before the edition runs, so the timed run contains no research wait. Three stories maximum, reporters fan out concurrently, one repair attempt only. Do not chase L5. It requires under 60 seconds and under $0.10 at the same time, which would force cutting audio quality for one extra point. |
| Management UI | 1x | L3 (2) | L2 (1) | Mission Control includes pause and resume, plus cadence and language controls, operable by a non-developer with the on-screen help text. Do not build role creation UI. It is the L5 bar on a 1x parameter. |

Power-ups target: ElevenLabs, Cloudflare, and Convex are structural, Linkup does verified work at the trust gate on every edition, and Wispr Flow is claimed by dictating 500 or more words during the event, for +125 total. Dodo is out of scope.

Cross-track bonus target: QR codes for the Telegram channel and a waitlist form are on the website and on screen all day, with analytics installed in the first hour, for up to +50.

Projected total: 183 to 221 from the track base and overflow, plus 125 in power-ups, plus up to 50 cross-track.

## Product principles

1. Real output over simulated workflows. A published edition on the website and Telegram is the unit of value.
2. No source, no claim. Unsupported factual claims are blocked, never softened or guessed.
3. Dynamic organisation over a fixed chain. The Editor-in-Chief derives specialists from the current news mix and records why each role exists.
4. Public receipts over private assertions. Every edition exposes sources, timestamps, corrections, and publication receipts.
5. Continuity over repetition. Later editions recognize prior coverage and explain what changed.
6. Exception-only human involvement. Normal editions publish automatically.
7. Fast, short editions. About 250 words and 60 to 90 seconds, so repeated autonomous output stays cheap and reliable.
8. Discovery, content, and verification are separate stages. Google News says which stories exist. The Hermes enricher gathers the content and the citable publisher source ahead of time. Linkup corroborates claims at the trust gate. The bulletin is written in the newsroom's own words.

## Goals

- Publish at least three successful autonomous editions on real public surfaces during the event.
- Reach at least 85% successful end-to-end runs across three or more repeated runs.
- Show at least two editions with visibly different plans and role graphs.
- Show at least one draft rejected and revised by the Editor-in-Chief.
- Block every unsupported factual claim before voice generation.
- Produce a two-anchor bulletin plus a chapter clip for every published story.
- Preserve story continuity across editions without repeating unchanged stories.
- Provide a trace tree with parent-child relationships, tokens, latency, and estimated cost per step.
- Turn blocked claims into a growing, versioned evaluation set with a visible pass rate trend.
- Operate with no preconfigured worker agents and no manual trigger per edition.
- Qualify for the ElevenLabs, Cloudflare, Convex, Linkup, and Wispr Flow power-ups.
- Collect verifiable visits, listens, channel joins, and waitlist signups for cross-track evidence.

## Non-goals

- Replacing professional reporters or claiming original reporting.
- Bypassing paywalls, logins, or anti-bot protections. The enricher reads public pages only, at polite rates, and a failed fetch degrades to a headline search.
- Publishing unverified social media rumours.
- Building a general no-code multi-agent platform during the sprint.
- Supporting every Indian language at launch.
- Payments, subscriptions, or Dodo checkout.
- A 24/7 production newsroom after the event.

## Primary users

### Commuter / listener
Wants a short, credible audio update and a readable front page, with the ability to jump to the audio for one story.

### Judge / mentor
Wants to verify that output is real, autonomous, sourced, repeated, and produced by a dynamic organisation rather than a fixed script, using their own device.

### Newsroom operator
Wants to pause or resume publication, adjust cadence and language, and understand why the system selected or rejected a story, without editing code.

## User stories

### Audience
1. As a commuter, I want a short audio bulletin at predictable intervals, so that I can catch up without reading many sites.
2. As a commuter, I want a newspaper-style front page with clear timestamps, so that I can scan the edition and judge freshness.
3. As a commuter, I want a full-edition player, a standalone clip per story, and a "listen from here" control that seeks the full player to that story.
4. As a commuter, I want source links and a "why this story" note on every story, so that I can inspect the original reporting and the selection reasoning.
5. As a commuter, I want follow-up stories labelled with what changed and corrections published in the open, so that repeated coverage stays useful and trust does not depend on silent edits.
6. As a commuter, I want Telegram audio to arrive without me requesting it, with a link to the matching web edition.
7. As a visitor, I want a QR code to the Telegram channel and a simple waitlist form, so that I can follow the project quickly at the event.

### Ingestion
8. As an ingestion Worker, I poll the configured Google News feeds on a schedule, parse both feed shapes, and write normalized story clusters into Convex.
9. As an ingestion Worker, I treat a single-article item as a cluster of one, so that downstream logic has one shape.
10. As an ingestion Worker, I strip the trailing source suffix from titles, hash the normalized lead title, and skip items whose hash already exists, so that the same story arriving through two feeds becomes one candidate.
11. As an ingestion Worker, I record the outlet count and outlet names from each cluster, so that the editor has a corroboration signal.
12. As an ingestion Worker, I never fetch a news.google.com article link myself. I store it as a discovery receipt for the enricher, which is the only component that attempts it.
12a. As an enricher, I want one pending cluster and a bounded budget per session, so that I can obtain its content and canonical publisher URL by allowed means, or mark it thin and move on.
12b. As an enricher, I want my sessions triggered frequently by a Hermes cron enqueue and run by the OCI runtime, so that content is already in Convex before any edition needs it.

### Editorial
13. As an Editor-in-Chief, I want fresh clusters, prior coverage, newsroom policy, and a run budget at the start of every edition, so that planning has full context.
14. As an Editor-in-Chief, I want to derive beat specialists from the current candidate set and skip beats with nothing worth covering, so that the organisation changes with the news.
15. As an Editor-in-Chief, I want to create an unexpected specialist when a story requires it, so that emergent work is handled explicitly and appears in the trace.
16. As an Editor-in-Chief, I want every generated role to state a mission, inputs, tools, guardrails, and success criteria, so that ephemeral workers stay controlled.
17. As an Editor-in-Chief, I want to return weak drafts with concrete revision notes, so that review is visible and quality improves before publication.
18. As an Editor-in-Chief, I want outlet count and source diversity in the selection inputs, so that importance is judged by corroboration and not by one loud headline.
19. As a beat reporter, I want my story bundle with the cluster's enriched content, key facts, and canonical source, so that I write from sourced material in a focused context, with a Linkup search available only as a fallback when the bundle is thin.
20. As a beat reporter, I want an explicit prohibition on inventing facts or quotes, and a requirement to attach a source receipt to every fact.
21. As a writer, I want approved reporter notes and the edition plan with anchor turns, so that the script reflects editorial intent and sounds deliberate.

### Trust
22. As a Judge, I want the script decomposed into atomic claims with the reporters' receipts attached, so that each claim is evaluated independently against evidence.
23. As a Judge, I want to run my own Linkup corroboration on high-impact claims, so that approval does not rest on a single source.
24. As a Judge, I want unsupported claims blocked before voice generation, disputed claims escalated with full context, and every verdict recorded with evidence links and a reason.
25. As an evaluator, I want every blocked claim stored as a regression case tied to a prompt version, pass rate tracked by version, and a change rejected when the pass rate drops below the threshold.

### Publishing and operations
26. As a publisher, I want generation to stop when the Judge has not approved the script, so that publication is fail-closed.
27. As a publisher, I want per-story clips rendered before the full edition is assembled, publication to be idempotent, receipts recorded for every surface, and partial publishes visible rather than silently marked successful.
28. As an operator, I want editions triggered by Hermes cron every 30 to 45 minutes, a lock per edition window, and pause, resume, cadence, and language controls in the dashboard.
29. As an operator, I want exceptions delivered to Telegram with run context, so that I intervene only when required.
30. As an operator, I want English as the fallback language if the Hindi voice test fails, so that language cannot sink the demo.

### Evidence
31. As a mentor, I want a live roster of the Editor-in-Chief and every ephemeral specialist with assignment and state, so that dynamic spawning is visible rather than claimed.
32. As a mentor, I want a stage board that follows stories from discovery to publication, and a real-time event feed of handoffs, revisions, blocks, renders, and publishes.
33. As a mentor, I want to open any agent, story, or event into a drawer showing the role spec, trace, evidence, tokens, and cost.
34. As a mentor, I want the trace tree per edition with cost per node and a filter by role or task, so that I can answer which agent spent the most without asking the team.
35. As a mentor, I want to open the Telegram posts and website pages from my own device, so that output is not a screenshot claim.
36. As a mentor, I want at least three autonomous publication receipts and a cost and latency summary per edition.
37. As a builder, I want Wispr Flow usage captured separately, and a backup recording plus exported proof pack, so that a stage failure cannot erase the evidence.

## Implementation decisions

### System boundaries

1. Source gateway. A Cloudflare Worker polls Google News RSS and writes normalized clusters to Convex.
2. Newsroom runtime. The Hermes Editor-in-Chief and dynamically derived ephemeral specialists, driven by a Node.js runtime on the OCI VM.
3. Trust gate. Claim extraction, Linkup verification, judge verdicts, evaluation capture, and corrections.
4. Media pipeline. Script segmentation, ElevenLabs rendering, FFmpeg assembly, and offset extraction.
5. Publishing surfaces. Newspaper website, Telegram channel, waitlist, and analytics.
6. Evidence plane. Convex-backed traces, costs, prompt versions, run history, health, and proof exports.

### Locked stack

- React, Vite, TypeScript, and Tailwind CSS for the newspaper and Mission Control
- Convex for schemas, functions, durable state, and real-time subscriptions
- Cloudflare Pages for the single public React deployment
- Cloudflare Worker with a scheduled trigger for feed polling
- Cloudflare R2 for chapter clips, full bulletin audio, and proof artifacts
- Node.js and TypeScript newsroom runtime on the OCI VM
- Hermes quiet one-shot sessions for the Editor-in-Chief and generated specialists
- Hermes cron for fast idempotent enqueue ticks
- ElevenLabs for two-anchor speech, FFmpeg for assembly and offsets
- Linkup Hermes skills for reporter research and judge corroboration
- Hermes Telegram gateway for publishing and exception alerts
- Zod, Vitest, and Playwright for validation

Avoid Next.js, a second backend framework, a generic agent framework, an embedding service, and a third-party dashboard template. None of them improves the proof.

### Deployment topology

1. Cloudflare Pages serves the front page, edition and article routes, and /mission-control.
2. The Cloudflare Worker polls the feeds every 15 minutes and writes candidates to Convex.
3. R2 serves immutable audio with CORS and byte-range support.
4. Convex pushes live state to the public site and the dashboard.
5. The OCI VM runs the Hermes gateway and a supervised newsroom runtime service.
6. Hermes cron enqueues edition requests in seconds. The runtime performs the longer multi-agent run.

The public site deploys once. Publishing an edition writes Convex state and R2 media. It does not rebuild the website.

### Source acquisition: Google News RSS only

Discovery uses one provider and about six URLs:

```
https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en
https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en
https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en
https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en
https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en
https://news.google.com/rss/search?q=india%20when:2h&hl=en-IN&gl=IN&ceid=IN:en   (optional)
```

The feed list lives in a Convex config table with a beat label per URL, so a feed can be added or disabled without a deploy. For a Hindi edition the same URLs work with hl=hi-IN and ceid=IN:hi.

Parsing rules:

- Parse the XML with fast-xml-parser. The Worker has no DOM parser.
- The description field is escaped HTML. Unescape it, then extract the anchor texts and the outlet names with a small regex. The regex is safe because the structure is a fixed template that Google generates.
- The top stories feed groups one event across outlets into one item. Parse each item as one story cluster with a lead headline, alternate headlines, and outlet names.
- Topic and search feeds mostly return single articles. Treat a single article as a cluster of one, so downstream code sees one shape.
- Strip the trailing " - Source" suffix from the lead title.
- Google's clustering is the semantic dedup layer within a feed. Across feeds, normalize the lead title, hash it, and skip items whose hash already exists. Defer any embedding layer unless testing shows near duplicates leaking through.
- The Worker never fetches a news.google.com article link. The ids are encrypted redirects, and plain server fetches often receive consent pages. The Worker stores the link as a discovery receipt for the enricher, which is the only component allowed to attempt it, with browser-grade fetching and a headline-search fallback.
- Poll every 15 minutes with a normal user agent. Do not poll aggressively.

Compliance posture: the feed is used only as a discovery signal for which stories exist. The bulletin's facts come from Linkup results, the citable sources are canonical publisher URLs, and the words are the newsroom's own. Two direct publisher feed URLs are kept ready in the config table as an optional fallback, disabled by default.

### Canonical news item contract

Every candidate cluster stores a stable id, lead title, alternate headlines, outlet names, outlet count, beat, published time, retrieval time, feed of origin, title hash, discovery receipt, language, and a status field the editor flips when a story airs. Enrichment adds a content summary of 5 to 8 key facts, usable quotes, the canonical publisher URL, an extraction confidence, and an enrichment trace id. A cluster the enricher could not fill is marked thin rather than deleted, and it remains selectable through the reporter's Linkup fallback.

### Content enrichment: Hermes

A Hermes-driven enricher turns discovered clusters into ready-to-write material before any edition needs them.

- The Worker writes a cluster and marks it pending. A frequent Hermes cron tick, every 10 minutes, enqueues pending clusters, and the OCI runtime launches short one-shot enricher sessions to process them.
- Each session receives one cluster and a bounded token and time budget. Its mission is to obtain the story's content and canonical publisher URL by allowed means: follow the article link with browser-grade fetching, or search the headline when the link fails. It writes back the key facts, quotes worth using, the canonical URL, and an extraction confidence.
- Prioritize rather than exhaust. Enrich the freshest clusters per beat first, under a per-hour budget cap, so cost stays bounded on a heavy news hour.
- Failures are isolated. A paywall, a consent page, or a dead link marks the cluster thin and the session moves on. Nothing downstream breaks.
- Enricher sessions emit trace nodes like every other role, so prefetch work is visible in Mission Control and its cost is attributed to background runs, outside the timed edition run.
- Only public, non-paywalled pages are read, at polite rates, with no bypass of logins or anti-bot protections. Published stories carry attribution to the canonical source.

This stage exists for latency and reliability. When the edition cron fires, the editor selects from clusters whose content is already in Convex, so the timed run contains no research wait.

### Verification layer: Linkup

Linkup sits where trust is decided.

- The Judge corroborates claims against live Linkup results, always for high-impact claims and by sampling for the rest, in addition to checking the enrichment receipts. This is the power-up evidence: live search doing real work on every edition, visible in the judge's verdict trail.
- Reporters carry Linkup as a fallback tool only, used when their cluster is thin or a needed fact is missing from the stored content.
- The breaking-news sentinel, if built, uses Linkup to confirm corroboration before requesting a flash.
- Article pages cite the canonical publisher URLs, which come from enrichment first and Linkup second.

### Dynamic Hermes agent organisation

Only the Editor-in-Chief is a stable role. No reporters, writers, or other workers are pre-registered.

At the start of every edition, the Editor-in-Chief receives candidate clusters, prior coverage, newsroom policy, quality thresholds, and a run budget. It creates an execution plan and a set of ephemeral RoleSpec records. Each role spec states the role name and beat, why the role is needed for this edition, the assigned story ids, the mission and required output, allowed tools, factual and editorial guardrails, success criteria, the parent trace id, and a token and time budget.

The runtime launches fresh Hermes one-shot sessions from those role specs. Role definitions are generated from the task, not selected from a maintained worker list. A qualifying run must show that different source batches create different role graphs, and at least one run should derive a specialist not named in the manager instructions. The manager can accept, reject, or request a revision from any worker, and that loop is recorded. A stuck worker escalates with the concrete blocker instead of looping.

This section is the org structure score. If time pressure tempts a shortcut here, cut elsewhere.

### Editorial planning

The Editor-in-Chief reads the fresh clusters, uses outlet count and source diversity as importance signals, consults prior coverage, and selects a compact rundown of 3 stories at about 250 words total. Each story records a selection reason and one label: new, developing, follow-up, correction, or breaking. Story order, anchor turns, and target duration are part of the plan. Unchanged duplicate clusters are suppressed.

### Fact gate and evaluation

The Judge decomposes the script into atomic claims and returns one verdict per claim: approved, revise, block, or escalate. Approval requires a source receipt and sufficient evidence. The pipeline is fail-closed. Voice generation and publication cannot start until all publishable claims are approved.

Every blocked claim becomes a durable evaluation case containing the input, evidence, expected safe outcome, actual verdict, failure category, and prompt version. Prompts and role instructions are version-controlled in git. The eval set runs before a prompt change is accepted, and a pass rate below the configured threshold rejects the change. Mission Control shows the pass rate trend across versions. A public corrections ledger records any post-publication correction with the old text, the corrected text, the reason, the source, and the timestamp.

### Story memory and continuity

Memory is implemented as the rubric's three layers, by name:

1. Now. The current edition's state machine, stories, claims, and receipts in Convex.
2. The past. Story memory of prior coverage. Before planning, the manager retrieves related prior stories and decides whether a candidate is new, unchanged, or a follow-up. A later edition may say "as we reported earlier" only when it cites the previous edition and states the new development.
3. Business rules. The newsroom policy document with sourcing rules, blocked topics, escalation logic, and quality thresholds, injected into every role spec.

All three survive every handoff because each role spec carries its bundle. Hermes memory additionally stores high-signal editorial lessons and reusable role patterns.

### Audio model

The writer produces structured anchor turns. ElevenLabs renders one clip per story, and FFmpeg assembles the full edition and extracts each segment's start offset. The website exposes both a story clip and a "listen from here" control that seeks the full player to the offset. Audio generation happens only after fact approval. Voice and language are configurable. Hindi is preferred if the two selected voices pass the pre-event quality test. Otherwise English is the launch language.

### Newspaper website

An original, lightweight editorial design with a newspaper hierarchy: serif headlines, strong section labels, multi-column desktop layout, single-column mobile, clear timestamps, restrained monochrome styling. The site includes the current front page, an edition archive, article pages with source receipts and "why this story" notes, the audio players and controls, developing and follow-up and correction badges, the public corrections ledger, the Telegram QR code and waitlist, and a masthead showing newsroom health and the last successful autonomous publish time.

### Publishing and idempotency

The Publisher writes an immutable edition record, publishes the web edition and media, then posts to Telegram through the Hermes gateway. Every surface returns a receipt stored against the edition. An idempotency key based on the edition window and content version prevents duplicates. Publication state follows planned, reporting, drafted, judging, approved, rendering, publishing, published, with failed and escalated exits. A partial publish is visible and retried, never silently reported as successful.

### Scheduling and the overflow plan

Hermes cron is the authoritative scheduler and starts as early in the day as the pipeline allows, because every timestamp is proof. Each tick performs a short idempotent enqueue. The OCI runtime consumes the request and runs the edition. Each edition has a lock, a bounded budget, a retry policy, and an exception path.

During the judging window, editions run every 30 to 45 minutes. One published edition is one real task for the overflow clause, so 2 to 3 editions landing during judging is 40 to 60 extra points. A breaking-news sentinel that can trigger a short flash between editions is a stretch goal, gated on novelty, importance, confidence, and corroboration thresholds all passing.

### Convex data domains

Sources config, source items and clusters, editions, edition stories, role specs, agent runs, trace nodes, claims, judge verdicts, eval cases, prompt versions, audio segments, publication receipts, corrections, waitlist entries, and engagement events. The model optimizes for two views: the public edition experience and the judge-facing evidence view.

### Observability and Mission Control

Every agent and tool step emits a structured trace node with run id, edition id, parent node, role, task, status, start and end time, latency, token counts, estimated cost, redacted input and output summaries, and error details.

Mission Control is a projection of one canonical Convex event stream. Required event families are edition state changed, role spawned, role status changed, handoff created, draft reviewed, claim judged, audio rendered, publication attempted, publication succeeded, publication failed, and exception escalated. The dashboard has three panes plus a drawer:

1. Live roster. The Editor-in-Chief and only the ephemeral roles spawned for the selected edition, each with role, beat, assignment, state, latency, and cost. Completed roles move to the edition archive.
2. Edition stage board. Cards move through Discovered, Planned, Reporting, Drafting, Fact Check, Voice, Publish, and Done, projected from the real state machine.
3. Live event feed. Append-only events for spawns, handoffs, rejections, revisions, blocks, renders, publishes, and exceptions.
4. Detail drawer. The generated role spec, parent-child trace, evidence links, tokens, cost, and artifacts for any agent, story, or event.

A compact top bar shows active agents, edition state, editions today, next cron run, latency, cost, and dependency health. The L5 stretch adds a side-by-side run diff, a cost spike alert wired to actually fire, and search across runs. Secrets and full provider responses are never exposed publicly.

### Engagement and cross-track evidence

The website records privacy-minimal page views, player starts, seeks, and completions, with analytics installed in the first hour so the numbers are verifiable. Telegram subscriber count and waitlist signups are captured where available. Engagement may adjust story ordering only after the core loop is reliable, and it can never override source confidence or a judge decision.

## Delivery phases

### Pre-event, infrastructure only

Configure credentials, the Telegram bot and channel, empty Convex and Cloudflare projects, the Hermes gateway, model access, and Wispr Flow. Test all six feed URLs and the parser against both feed shapes. Run one Hermes enricher session against a real news.google.com link from the OCI VM and record whether it resolved the redirect directly or needed the headline-search fallback, because that decides the enricher's default path. Run the two-voice ElevenLabs quality test and lock the language. Confirm FFmpeg on the OCI VM, R2 CORS and byte-range playback, a Telegram audio post to the channel, one successful Linkup call from a Hermes skill, and that the runtime service survives an SSH disconnect. Do not build the product before the sprint.

### Six-hour execution budget

| Elapsed | Required milestone | Rubric row served |
|---|---|---|
| 0:00 to 0:35 | Workspace, Convex schema, Pages deployment, R2 smoke test, analytics snippet live | Real output, cross-track |
| 0:35 to 1:15 | Worker polls the six feeds, parses both shapes, hash dedup, clusters in Convex; enricher sessions filling fresh clusters | Real output, cost and latency |
| 1:15 to 2:10 | Editor-in-Chief derives ephemeral reporters from a live enriched batch and emits real-time events | Org structure, observability |
| 2:10 to 3:00 | Reporters draft from enriched content, Judge corroborates via Linkup, one claim approved and one blocked | Real output, evaluation |
| 3:00 to 3:40 | ElevenLabs chapter clips, FFmpeg assembly, R2 upload, working offsets | Real output, power-ups |
| 3:40 to 4:20 | Telegram publish, cron enqueue, runtime consumer, first unattended edition | Real output, overflow |
| 4:20 to 5:10 | Mission Control roster, stage board, event feed, and drawer | Observability |
| 5:10 to 5:40 | Two more autonomous runs, duplicate suppression, pass rate chart if stable | Overflow, memory, evaluation |
| 5:40 to 6:00 | Backup recording, proof export, timed rehearsal, submission | Everything |

### Cut order if behind schedule

1. Breaking flashes
2. Side-by-side run comparison
3. Corrections UI and rich evidence mode
4. Advanced continuity beyond duplicate suppression
5. Engagement feedback
6. Operator controls beyond pause and resume

Never cut: the claim-level fact gate, two-anchor audio on a real public URL, website and Telegram receipts, three repeated autonomous runs, dynamic role derivation, and the live Mission Control roster, stage board, and event feed.

## Testing decisions

### Primary testing seam

The highest seam is one autonomous edition run. Given a controlled set of candidate clusters and prior memory, the system must derive roles, produce a fact-approved script, render chaptered audio, publish web and Telegram output exactly once, and store a complete evidence trace. Tests assert observable behavior and durable records, not prompt wording or call order.

### Required end-to-end scenarios

1. A normal mixed-news edition creates only the relevant beat specialists and publishes.
2. A markets-heavy batch produces a different role graph from a general-news batch.
3. A weak draft is rejected, revised, re-judged, and published.
4. An unsupported claim is blocked and never reaches voice generation.
5. A blocked claim becomes an evaluation case tied to a prompt version.
6. A repeated unchanged story is suppressed by the title hash and story memory.
7. A developing story cites prior coverage and states what changed.
8. A transient Telegram failure retries without duplicating the web edition.
9. Two overlapping cron triggers produce one edition because the lock and idempotency key hold.
10. Every article's "listen from here" control seeks to the correct offset.
11. Three repeated live runs reach at least 85% success and leave verifiable receipts.

### Adapter contract tests

Contract-test each boundary independently: the Google News parser against recorded fixtures of both feed shapes, including a malformed description; the enricher against one resolvable link, one dead link, and one paywalled page, asserting that failures mark the cluster thin without raising; Linkup; ElevenLabs; Convex; R2 publishing; the Telegram gateway; and analytics. Fixtures make CI deterministic, but demo proof must include live calls. Add one degraded-mode test: when Google News is unreachable, the editor plans from the last known candidates and the health masthead shows the degradation.

### Evaluation tests

Maintain a versioned set of supported claims, unsupported claims, conflicting-source claims, stale updates, and duplicates. A prompt or policy change must not reduce the pass rate below the release threshold.

### Non-functional validation

- A successful standard edition completes in under 150 seconds, with actual latency recorded. The cron enqueue finishes in seconds.
- Total and per-role model cost is tracked, with a target under $0.50 per edition.
- Mobile readability and audio controls work.
- No secret appears in public traces.
- The pipeline degrades gracefully when one feed or one specialist fails.
- The website and Telegram URLs work from a judge's device.

## Success metrics

### Buildathon proof metrics

- Three or more autonomous published editions, with 2 or more landing during the judging window.
- 85% or better success over three or more repeated runs.
- Two visibly different dynamic role graphs.
- One manager rejection and revision cycle.
- One judge-blocked unsupported claim, traced into the eval set.
- One follow-up story using prior memory.
- A complete trace tree with token and cost data.
- Website and Telegram receipts for every claimed edition.
- Five power-up receipts: ElevenLabs, Cloudflare, Convex, Linkup, Wispr Flow.

### Audience metrics

Unique visitors, Telegram joins, waitlist signups, audio starts and completion rate, and "listen from here" usage. These are cross-track evidence and do not gate the core product.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Google News changes the feed format or rate limits the Worker | Parser fixtures tested the night before, both shapes handled, 15 minute polling with a normal user agent, two direct publisher feeds config-ready and disabled |
| A plain server fetch of a news.google.com link fails | Only the enricher attempts links, with browser-grade fetching, and a failure degrades to a headline search |
| Enrichment failed or is thin for a picked story | The reporter falls back to a Linkup search, one repair attempt, then the editor swaps the story |
| Enrichment volume gets expensive on a heavy news hour | Per-hour enrichment budget, freshest clusters per beat first, thin clusters stay selectable through the fallback |
| Hindi voices sound flat | Pre-event voice test decides the language, English fallback configured |
| Hallucinated claims | Atomic claim gate, fail-closed publication, receipts on every fact, judge corroboration |
| Dynamic agents get slow or expensive | Strict per-role budgets, only needed beats spawned, 250 word editions |
| Hermes cron exceeds its window | Cron only enqueues, the OCI runtime does the long run |
| Duplicate posts | Lock, edition-window idempotency key, stored receipts |
| Telegram or venue network fails during demo | Retry policy, visible partial state, backup recording, exported proof pack |
| Public trace leaks a secret | Redacted summaries and receipts only, never raw tool output |
| Too much scope for six hours | The cut order above, and the never-cut list |

## Out of scope

- Fetching or republishing publisher article pages.
- Original investigative journalism.
- Social posting beyond Telegram.
- Listener accounts and personalization.
- Native mobile apps and payments.
- Long-form bulletins if 90 second editions run more reliably.

## Further notes

- The scoring root is real output on live surfaces. The cadence and the publication receipts are product requirements, not demo polish.
- Dynamic role derivation is the org score. A fixed monitor, editor, writer, judge, publisher sequence caps that parameter at L3.
- The public newspaper is a second real output surface and a trust interface, not a landing page.
- Every status shown in Mission Control must come from a real Convex event or state transition.
- Keep Wispr Flow screenshots and partner dashboard receipts separate from the product trace.
- Design read: a dense operational newsroom dashboard for judges, light neutral surfaces, one amber accent, thin dividers, compact typography, motion only for real state transitions.
