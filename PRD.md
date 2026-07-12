---
id: ONR-PRD-001
title: Overnight Newsroom
slug: overnight-newsroom
type: prd
status: ready-for-agent
version: 1.0.0
created_at: 2026-07-11
updated_at: 2026-07-11
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

# Overnight Newsroom — Product Requirements Document

## Problem Statement

People following Indian news face a fragmented stream of articles, live blogs, social posts, and video clips. A commuter cannot quickly understand what matters, what changed since the previous update, or which claims are properly sourced. Existing news summaries are usually text-only, manually triggered, repetitive, and opaque about how stories were selected or verified.

For the Hermes Buildathon, the product must also prove something stronger than summarisation: a complete newsroom function operated by an autonomous, observable organisation of agents. It must publish real output to real public surfaces without a human triggering each edition. It must show dynamic management, durable memory, fact-gating, measurable evaluation, and repeated autonomous runs.

The builder is solo and does not have a pre-existing repository backlog, inbox, customer list, or audience to use as a live surface. The solution therefore must create its own legitimate public surface from public news inputs, without requiring cold outreach or fabricated activity.

## Solution

Overnight Newsroom is an autonomous Indian-news operation powered by Hermes. A scheduled Editor-in-Chief session collects normalized stories from direct RSS feeds and a Cloudflare-based public-page ingestion gateway. It examines the current news mix, creates a different editorial plan for each edition, derives the specialist roles required for that plan, and launches ephemeral Hermes workers dynamically. No worker roles are manually registered in Hermes.

Specialists research and draft only the beats needed for the current edition. The Editor-in-Chief reviews their work and can return weak drafts with revision notes. A Judge verifies every factual claim against source material and Linkup results. Unsupported claims are blocked before publication and become regression cases. Approved stories are converted into two-anchor audio with ElevenLabs, published as a full bulletin and chapter-level clips, rendered on a newspaper-style public website, and posted to a Telegram channel through the Hermes gateway.

Hermes cron triggers standard editions every 30–45 minutes during the buildathon and can trigger short breaking-news flashes when a high-confidence major update appears. Convex stores newsroom state, story memory, decisions, traces, costs, prompt versions, evaluation cases, publication receipts, and engagement events. Cloudflare hosts the public site, audio assets, analytics endpoint, and the optional source-ingestion Worker.

The core proof is a scrollable public history of editions that published while the builder was doing something else, with timestamps, source receipts, dynamic agent trees, judge decisions, and links to the exact Telegram and website output.

## Product Principles

1. **Real output over simulated workflows.** A published edition on the public website and Telegram is the unit of value.
2. **No source, no claim.** Unsupported factual claims are blocked rather than softened or guessed.
3. **Dynamic organisation over a fixed chain.** The Editor-in-Chief derives specialists from the current news mix and records why each role exists.
4. **Public receipts over private assertions.** Every edition exposes sources, timestamps, corrections, and publication receipts.
5. **Continuity over repetition.** Later editions recognize prior coverage, avoid duplication, and explain what changed.
6. **Exception-only human involvement.** Normal editions publish automatically; only policy, confidence, or infrastructure exceptions require escalation.
7. **Fast, short editions.** Target approximately 250 words and 60–90 seconds so repeated autonomous output stays cheap and reliable.
8. **Respectful acquisition.** Consume official feeds first; scrape only public, non-paywalled pages with attribution, rate limits, and domain allowlists.

## Goals

- Publish at least three successful autonomous editions on real public surfaces during the event.
- Achieve at least 85% successful end-to-end runs across three or more repeated runs.
- Show at least two editions with visibly different plans and specialist-role graphs.
- Show at least one draft rejected and revised by the Editor-in-Chief.
- Block every unsupported factual claim before voice generation or publication.
- Produce a two-anchor bulletin plus chapter-level audio links for every published story.
- Preserve story continuity across editions without repeating unchanged stories.
- Provide a trace tree with parent-child relationships, tokens, latency, and estimated cost per step.
- Turn failed or blocked claims into a growing, versioned evaluation set.
- Operate without any preconfigured worker agents or manual trigger per edition.
- Qualify for ElevenLabs, Cloudflare, Convex, Linkup, and Wispr Flow power-ups.
- Collect verifiable website visits, listens, channel joins, and waitlist signups for cross-track evidence.

## Non-Goals

- Replacing professional reporters or claiming original reporting.
- Scraping paywalled pages, defeating anti-bot controls, or bypassing publisher restrictions.
- Publishing unverified social-media rumours as news.
- Building a generalized no-code multi-agent platform during the eight-hour sprint.
- Supporting every Indian language at launch.
- Personalizing every listener’s bulletin in the MVP.
- Running advertisements, subscriptions, payments, or Dodo checkout in the MVP.
- Operating a 24/7 production newsroom after the event.
- Training or fine-tuning a model.

## Primary Users

### Commuter / Listener
Wants a short, credible audio update and a readable front page, with the ability to jump directly to the audio for a particular story.

### Judge / Mentor
Wants to verify that output is real, autonomous, sourced, repeated, observable, and produced by a dynamic agent organisation rather than a fixed script.

### Newsroom Operator
Wants to pause or resume publication, adjust cadence and language, inspect failures, and understand why the system selected or rejected a story without editing code.

## User Stories

1. As a commuter, I want a short audio bulletin at predictable intervals, so that I can catch up without reading many sites.
2. As a commuter, I want a newspaper-style front page, so that I can scan the edition visually.
3. As a commuter, I want each article to show its publication and update time, so that I know how fresh it is.
4. As a commuter, I want a “listen from here” control on each story, so that I can jump to the matching section of the bulletin.
5. As a commuter, I want each story to have a standalone audio clip, so that I can share or replay only that story.
6. As a commuter, I want a full-edition audio player, so that I can listen continuously.
7. As a commuter, I want source links on every story, so that I can inspect the original reporting.
8. As a commuter, I want a “why this story” note, so that I understand the editor’s selection reasoning.
9. As a commuter, I want follow-up stories labelled with what changed, so that repeated coverage remains useful.
10. As a commuter, I want corrections to be public, so that trust does not depend on silent edits.
11. As a commuter, I want Telegram posts to link to the corresponding web edition, so that I can move between audio and text.
12. As a commuter, I want Telegram audio to arrive without me requesting it, so that the newsroom feels autonomous.
13. As a listener, I want the voices and language to be understandable, so that audio is genuinely usable.
14. As a listener, I want each edition to remain around 60–90 seconds, so that it fits a commute break.
15. As a listener, I want obvious play, pause, skip, and seek controls, so that I can control playback.
16. As a visitor, I want a QR code to the Telegram channel, so that I can subscribe quickly at the event.
17. As a visitor, I want a simple waitlist form, so that I can follow the project without joining Telegram.
18. As an Editor-in-Chief, I want normalized candidate stories from RSS and public-page adapters, so that source differences do not leak into editorial work.
19. As an Editor-in-Chief, I want duplicate and near-duplicate stories clustered, so that multiple publishers covering the same event do not consume the rundown.
20. As an Editor-in-Chief, I want source diversity and corroboration signals, so that selection does not over-rely on a single publisher.
21. As an Editor-in-Chief, I want to see prior coverage before planning, so that later editions can continue rather than repeat stories.
22. As an Editor-in-Chief, I want to derive beat specialists from the current candidate set, so that the organisation changes with the news.
23. As an Editor-in-Chief, I want to skip irrelevant beats, so that a fixed pipeline does not waste time or tokens.
24. As an Editor-in-Chief, I want to create an unexpected specialist when a story requires it, so that emergent work is handled explicitly.
25. As an Editor-in-Chief, I want every generated role to include a mission, inputs, tools, guardrails, and success criteria, so that ephemeral workers remain controlled.
26. As an Editor-in-Chief, I want weak drafts returned with concrete revision notes, so that review is visible and quality improves before publication.
27. As an Editor-in-Chief, I want the publication plan to include story order, anchor assignment, and target length, so that the bulletin is coherent.
28. As a beat reporter, I want only the relevant story bundle and source receipts, so that I can work in a focused context.
29. As a beat reporter, I want an explicit prohibition on inventing facts or quotes, so that speed does not undermine credibility.
30. As a writer, I want approved reporter notes and the edition plan, so that the final script reflects editorial intent.
31. As a writer, I want anchor turns and pronunciation hints, so that the audio sounds deliberate.
32. As a Judge, I want the script decomposed into atomic factual claims, so that each claim can be evaluated independently.
33. As a Judge, I want primary article text, corroborating sources, and Linkup results, so that decisions have evidence.
34. As a Judge, I want unsupported claims blocked, so that no uncertain line reaches ElevenLabs.
35. As a Judge, I want disputed claims escalated with full context, so that exceptions do not restart the entire run.
36. As a Judge, I want each verdict to include evidence links and a reason, so that the decision is auditable.
37. As an evaluator, I want every blocked claim stored as a regression case, so that failures improve the system.
38. As an evaluator, I want prompts and role instructions versioned, so that improvements can be connected to specific changes.
39. As an evaluator, I want pass rate and failure categories tracked by version, so that progress is measurable.
40. As a publisher, I want generation to stop when the Judge has not approved the script, so that publication is fail-closed.
41. As a publisher, I want per-story audio clips generated before the full edition is assembled, so that timestamps remain reliable.
42. As a publisher, I want publication to be idempotent, so that retries do not create duplicate Telegram posts or web editions.
43. As a publisher, I want website and Telegram receipts recorded, so that every output is verifiable.
44. As a publisher, I want failed deliveries retried within a bounded policy, so that transient failures do not lose an edition.
45. As a publisher, I want partial publication rolled back or clearly marked, so that surfaces do not disagree silently.
46. As an operator, I want standard editions triggered by Hermes cron every 30–45 minutes, so that autonomy is proved by timestamps.
47. As an operator, I want a breaking-news sentinel, so that major high-confidence updates can trigger a short flash between editions.
48. As an operator, I want a distributed lock per edition window, so that overlapping cron runs cannot double-publish.
49. As an operator, I want pause and resume controls, so that I can stop output without killing infrastructure.
50. As an operator, I want cadence, language, source allowlist, and quality thresholds configurable without code changes.
51. As an operator, I want a visible health status for acquisition, model, voice, web, and Telegram dependencies, so that failures are quick to diagnose.
52. As an operator, I want exceptions delivered to Telegram with run context, so that I can intervene only when required.
53. As an operator, I want English as a fallback if Hindi voice quality is poor, so that language does not sink the demo.
54. As a mentor, I want to select an edition and see the entire agent tree, so that I can verify who called whom.
55. As a mentor, I want tokens, latency, and cost per trace node, so that efficiency claims are verifiable.
56. As a mentor, I want to filter traces by agent or task, so that I can investigate a particular specialist.
57. As a mentor, I want to compare two editions side by side, so that different editorial plans and role graphs are obvious.
58. As a mentor, I want to see a rejected draft and its revision, so that manager review is proven.
59. As a mentor, I want to inspect a blocked claim and its evidence, so that the fact gate is proven.
60. As a mentor, I want to see at least three autonomous publication receipts, so that repeated success is proven.
61. As a mentor, I want to open the public Telegram posts and website pages myself, so that output is not a screenshot-only claim.
62. As a mentor, I want a cost and latency summary per edition, so that the newsroom’s operating economics are credible.
63. As a mentor, I want a public corrections ledger, so that trust behaviour is visible rather than claimed.
64. As a mentor, I want a run-diff view, so that prompt and planning changes can explain quality improvements.
65. As an event participant, I want analytics consent and minimal data collection, so that engagement proof is responsible.
66. As a builder, I want Wispr Flow usage captured separately, so that the partner power-up can be proven without coupling it to product runtime.
67. As a builder, I want a backup recording and exported proof pack, so that a stage-network failure does not erase the project’s evidence.
68. As a builder, I want a clean recovery procedure, so that a failed live run can be narrated and resumed quickly.
69. As a mentor, I want a live roster of the Editor-in-Chief and every ephemeral specialist, so that dynamic spawning is visible rather than claimed.
70. As a mentor, I want each specialist’s current assignment and state, so that I can see real work moving through the newsroom.
71. As a mentor, I want a stage board for the selected edition, so that I can follow stories from discovery through publication.
72. As a mentor, I want a real-time event feed, so that handoffs, revisions, blocks, renders, and publication appear as they happen.
73. As a mentor, I want to open an agent or story detail drawer, so that I can inspect the role spec, evidence, costs, and output without leaving the dashboard.
74. As an operator, I want finished ephemeral agents archived under their edition, so that the live roster stays truthful and readable.

## Implementation Decisions

### System Boundaries

The product has six major boundaries:

1. **Source Gateway** — obtains and normalizes public news items.
2. **Newsroom Runtime** — Hermes Editor-in-Chief and dynamically derived ephemeral specialists.
3. **Trust Gate** — claim extraction, Linkup verification, judge verdicts, evaluation capture, and corrections.
4. **Media Pipeline** — script segmentation, ElevenLabs rendering, concatenation, and timestamp metadata.
5. **Publishing Surfaces** — newspaper website, public RSS/JSON feed, Telegram channel, waitlist, and analytics.
6. **Evidence Plane** — Convex-backed traces, costs, prompt versions, run diffs, health, and proof exports.

### Chosen Technology Stack

Use one TypeScript-first workspace to reduce context switching during the six-hour sprint:

- **Public site and Mission Control:** React, Vite, TypeScript, Tailwind CSS, and Convex React subscriptions.
- **Backend/state:** Convex functions and schemas for normalized sources, editions, traces, claims, receipts, memory, and live dashboard events.
- **Source gateway:** Cloudflare Worker in TypeScript, with scheduled triggers and `HTMLRewriter` only for allowlisted public-page adapters.
- **Media storage:** Cloudflare R2 for story clips, complete bulletin audio, and exported proof artifacts.
- **Newsroom runtime:** Node.js and TypeScript on the existing OCI VM. It validates every agent result before changing edition state.
- **Agent execution:** quiet one-shot Hermes CLI sessions launched from generated role specifications. Each session gets a unique newsroom source tag and bounded tools, time, and token budget.
- **Scheduling:** Hermes cron enqueues edition requests. A lightweight OCI runtime worker consumes requests and performs the longer multi-agent run.
- **Audio:** ElevenLabs for speech generation and FFmpeg on OCI for deterministic concatenation and duration/offset extraction.
- **Search/fact checks:** Linkup skills available to Hermes reporter and Judge sessions.
- **Messaging:** Hermes Telegram gateway for publication and exception alerts.
- **Validation:** Zod for runtime contracts, Vitest for unit/contract tests, and Playwright for the highest-seam publication and dashboard checks.

Avoid Next.js, a second backend framework, a generic agent framework, and a third-party dashboard template. They add integration work without improving the proof.

### Deployment Topology

The deployment has five intentionally small pieces:

1. **Cloudflare Pages:** serves one React application with the newspaper routes, edition archive, article pages, and `/mission-control` dashboard.
2. **Cloudflare Worker:** polls official feeds and, if needed, one allowlisted public-page adapter every five minutes, then writes normalized candidates to Convex.
3. **Cloudflare R2:** serves immutable audio clips and full-edition audio through stable public URLs.
4. **Convex Cloud:** stores all shared state and pushes real-time updates to the public site and Mission Control.
5. **OCI VM:** runs Hermes gateway plus the newsroom runtime that launches ephemeral Hermes sessions, calls FFmpeg, uploads media, and records receipts.

The public app reads live data from Convex; it is deployed once and does not redeploy for every edition. Edition publication means writing approved state and media receipts, not rebuilding the site.

### Runtime and Dashboard Contract

The newsroom runtime emits one canonical event stream to Convex. Mission Control is a projection of those events, so it never invents status. Required event families are edition state changed, role spawned, role status changed, handoff created, draft reviewed, claim judged, audio rendered, publication attempted, publication succeeded, publication failed, and exception escalated.

Every event includes edition ID, run ID, timestamp, event type, actor role, related story/task IDs, parent trace ID, status, and a redacted payload. The dashboard uses Convex subscriptions to update its roster, stage board, metrics, and feed without a separate WebSocket service.

### Source Acquisition Strategy

Use a hybrid strategy rather than assuming Indian publishers lack RSS:

- Prefer official RSS feeds where publishers provide them.
- Use a Cloudflare Worker with scheduled triggers for explicitly allowlisted public, non-paywalled pages that lack usable feeds.
- Poll at most every five minutes, use conditional requests when available, identify the crawler, isolate failures by domain, and cache results.
- Never bypass paywalls, authentication, robots restrictions, or anti-bot protections.
- Store source attribution, canonical URL, publisher, published time, retrieved time, content hash, and extraction confidence.
- Publish original newsroom summaries and short attributed excerpts only; do not republish full source articles or unlicensed images.
- Expose one normalized JSON contract to the newsroom. An RSS representation may also be exposed for interoperability, but the monitor consumes normalized records rather than parsing every publisher format itself.
- Begin the buildathon with several working official feeds and add only one or two scraper adapters after the thin slice works.

Current source candidates to validate include publisher RSS pages from NDTV, India Today, Times of India, and India TV. Availability must be tested on the event day; no feed is assumed healthy.

### Canonical News Item Contract

Every candidate item includes a stable source identifier, canonical URL, publisher, title, excerpt or public article text, publication time, retrieval time, content hash, language, topic hints, and source receipt. Items without enough public text for verification may be linked but must not become unsupported scripted claims.

### Dynamic Hermes Agent Organisation

Only the **Editor-in-Chief** is a stable role. No beat reporters, writers, or other workers are pre-registered as Hermes agents.

At the start of every edition, the Editor-in-Chief receives candidate clusters, prior coverage, newsroom policy, quality thresholds, and run budget. It creates an execution plan and a set of ephemeral `RoleSpec` records. Each role spec states:

- role name and beat;
- why the role is needed for this edition;
- assigned source and story identifiers;
- mission and required output;
- allowed tools;
- factual and editorial guardrails;
- success criteria;
- parent trace identifier;
- token and time budget.

The runtime launches fresh Hermes one-shot child sessions from those role specs. Role definitions are generated from the task, not selected from a manually maintained worker list. Hermes memory stores newsroom policies, prior outcomes, useful role patterns, and editorial lessons, but persistent worker configuration is not required.

A qualifying run must show that different source batches create different role graphs. At least one run should derive a specialist not named in the initial manager instructions. The manager can accept, reject, or request a revision from any worker, and that loop is recorded.

### Editorial Planning

The Editor-in-Chief clusters duplicates, assigns importance and confidence, checks source diversity, consults prior coverage, and selects a compact rundown. Each story includes a selection reason and one of: new, developing, follow-up, correction, or breaking.

Normal editions target three to five stories and approximately 250 words. Breaking flashes contain one major verified development and remain shorter. Story order, anchor turns, and target duration are part of the plan.

### Fact Gate and Evaluation

The Judge decomposes scripts into atomic claims and produces one verdict per claim: approved, revise, block, or escalate. Approval requires a source receipt and sufficient evidence. Linkup performs live corroboration where useful; it does not replace the original source.

The pipeline is fail-closed: voice generation and publication cannot start until all publishable claims are approved. Blocked claims become durable evaluation cases containing input, evidence, expected safe outcome, actual verdict, failure category, and prompt version. Evaluation cases run against later versions and can block publication when regression exceeds the configured threshold.

A public corrections ledger records any post-publication correction with the old text, corrected text, reason, source, and timestamp.

### Story Memory and Continuity

Convex is the durable source of truth for story clusters, prior edition coverage, claims, and corrections. Hermes memory carries high-signal editorial lessons and reusable policy knowledge. Before planning, the manager retrieves related prior stories and decides whether a candidate is new, unchanged, or a follow-up.

A later edition may say “as we reported earlier” only when it can cite the previous edition and explain the new development. Unchanged duplicate clusters are suppressed.

### Audio Model

The writer produces structured anchor turns. ElevenLabs generates one clip per story or segment, not only one monolithic file. The media pipeline stores duration and start offset for every segment and then assembles a full-edition audio file.

The website exposes both a story clip and a “listen from here” control that seeks the full-edition player to the segment offset. Audio generation happens only after fact approval. Voice and language are configurable. Hindi is preferred if the two selected voices pass a pre-event quality check; otherwise English is the launch language.

### Newspaper Website

The public website uses a lightweight original editorial design rather than taking an uncertain template dependency during the sprint. It uses a newspaper-like hierarchy: serif headlines, strong section labels, multi-column desktop layout, single-column mobile layout, clear timestamps, and restrained monochrome styling.

The site includes:

- current front page;
- edition archive;
- article pages;
- full-edition audio player;
- per-story audio and “listen from here” controls;
- source receipts and “why this story” notes;
- developing/follow-up/correction badges;
- public corrections ledger;
- Telegram QR code and waitlist;
- newsroom status and last successful autonomous publish time.

If a third-party template is considered, its license must be verified and attribution requirements preserved. Template evaluation must not block the thin slice.

### Publishing and Idempotency

The Publisher writes an immutable edition record, publishes the web edition and media, then posts to Telegram via the Hermes messaging gateway. Every surface returns a receipt stored against the edition. An idempotency key based on edition window and content version prevents duplicates.

Publication state follows: planned → reporting → drafted → judging → approved → rendering → publishing → published, with failed and escalated exits. A partial publish is visible and retried; it is never silently reported as successful.

### Scheduling

Hermes cron is the authoritative scheduler and starts early enough to accumulate real timestamps. Each tick performs only a short, idempotent enqueue operation so it remains well inside Hermes cron’s bounded run window. The OCI newsroom runtime consumes the queued request and performs the longer multi-agent edition run. During the judging window, normal editions run every 30–45 minutes. A breaking-news sentinel may request an additional flash when novelty, importance, source confidence, and corroboration thresholds are all met.

Each edition has a lock, a bounded execution budget, retry policy, health checks, and an exception path. Cron prompts are self-contained and enqueue work for a runtime that instructs Hermes to derive specialists dynamically; neither layer references static worker agents.

### Convex Data Domains

Convex stores sources, source items, story clusters, editions, edition stories, role specs, agent runs, trace nodes, claims, judge verdicts, eval cases, prompt versions, audio segments, publication receipts, corrections, waitlist entries, and engagement events.

The data model optimizes for two views: the public edition experience and the judge-facing evidence view.

### Observability

Every agent/tool step emits a structured trace node with run ID, edition ID, parent node, role, task, status, start/end time, latency, token counts, estimated cost, inputs/outputs or redacted summaries, and error details.

### Newsroom Mission Control

Adopt the useful coordination ideas from the referenced OpenClaw Mission Control, but model the actual newsroom rather than recreating a generic project-management product. Convex is the shared brain and its real-time subscriptions power one read-first judge dashboard.

The MVP uses three panes:

1. **Live newsroom roster:** Editor-in-Chief plus only the ephemeral roles spawned for the selected edition. Each row shows role, beat, assignment, state, latency, and cost. Completed roles move to the edition archive instead of pretending to remain always active.
2. **Edition stage board:** story and production cards move through Discovered, Planned, Reporting, Drafting, Fact Check, Voice, Publish, and Done. This is a projection of the real edition state machine, not a manually managed Kanban board.
3. **Live event feed:** append-only events for role spawned, handoff sent, draft rejected, revision accepted, claim blocked, audio rendered, publish succeeded, and exception raised.

A detail drawer opens from any agent, story, or event and shows the generated role spec, parent-child trace, evidence links, redacted input/output summaries, token use, cost, and artifacts. A compact top bar shows active ephemeral agents, current edition state, editions published today, next cron run, run latency, total cost, and dependency health.

The six-hour MVP intentionally excludes drag-and-drop, general task creation, comments, documents, @mentions, thread subscriptions, notification polling, daily standups, persistent named worker identities, per-agent SOUL files, and heartbeat crons. Those patterns solve long-lived team coordination; this product needs short-lived edition execution and proof.

The evidence UI therefore provides:

- a live ephemeral-agent roster;
- an edition stage board generated from real state;
- a real-time activity feed;
- trace tree per edition;
- filter by role or task;
- token/cost summary;
- manager rejection and revision trail;
- judge block and evidence trail;
- failure/cost alerts;
- search across runs.

Side-by-side run comparison is a stretch goal after the live three-pane dashboard works.

Secrets, private tokens, and full provider responses are never exposed publicly.

### Engagement and Learning

The website records privacy-minimal page views, player starts, segment seeks, completions, and skips. Telegram subscriber count and waitlist signups are captured as evidence where available. Early listener behavior may adjust editorial weighting only after the core publication loop is reliable.

The feedback loop must remain bounded: engagement can influence ordering and beat allocation, but cannot override source confidence or fact-gate decisions.

### Creative Differentiators

1. **Evidence mode:** every article claim can reveal source receipts and judge verdicts.
2. **Living story timeline:** developing stories show what changed across editions.
3. **Public blocked-claim/corrections ledger:** demonstrates trust work, not just polished output.
4. **Listen from here:** article-level audio deep links seek the full bulletin precisely.
5. **Dynamic beat desk:** the org chart changes by edition and is visible in the trace.
6. **Breaking sentinel:** high-confidence major changes can create an autonomous flash.
7. **Source diversity meter:** shows corroboration and concentration per story.
8. **Newsroom health masthead:** displays last autonomous publish and dependency health.

### Delivery Phases

#### Six-Hour Execution Budget

| Elapsed | Required milestone |
|---|---|
| 0:00-0:35 | TypeScript workspace, Convex schema, Pages deployment, R2 smoke test |
| 0:35-1:15 | Three official feeds normalized; one source-to-public-page slice live |
| 1:15-2:15 | Hermes Editor-in-Chief derives ephemeral reporters and emits real-time events |
| 2:15-3:00 | Writer plus claim-level Judge; one supported and one blocked claim demonstrated |
| 3:00-3:40 | ElevenLabs chapter clips, FFmpeg assembly, R2 upload, working audio offsets |
| 3:40-4:20 | Telegram publish, cron enqueue, OCI runtime consumer, first unattended edition |
| 4:20-5:10 | Mission Control roster, stage board, event feed, and detail drawer |
| 5:10-5:40 | Two additional autonomous runs; add basic duplicate suppression if stable |
| 5:40-6:00 | Backup recording, proof export, timed rehearsal, submission check |

If a milestone slips, cut in this order: breaking flashes, scraper adapters, run comparison, corrections UI, advanced memory, engagement feedback, and operator controls. Never cut the fact gate, public publication receipts, repeated cron runs, or the live dashboard.

#### Pre-event infrastructure only
Configure credentials, Telegram bot/channel, empty Convex and Cloudflare projects, Hermes gateway, model access, Wispr Flow, source availability checks, and a two-voice ElevenLabs quality test. Do not build the product before the on-site sprint.

#### Event-day P0 (six-hour build)
Deliver one end-to-end edition, then dynamic roles, fact gate, audio, web, Telegram, cron, basic continuity, and the three-pane Mission Control. Use official RSS first. Add at most one public-page scraper adapter only if source coverage requires it.

#### Event-day P1
Add more scraper adapters, richer chapter audio, eval growth, run diff, analytics, breaking sentinel, and management controls.

#### Stretch
Add breaking-news flashes, multilingual parallel editions, deeper personalization, advanced visualizations, and automated editorial weighting from engagement.

## Testing Decisions

### Primary Testing Seam

The highest and primary seam is **one autonomous edition run**. Given a controlled set of public source records and prior newsroom memory, the system must derive roles, produce a fact-approved script, render chaptered audio, publish web and Telegram output exactly once, and store a complete evidence trace.

Tests assert externally observable behavior and durable records, not internal prompt wording or function call order.

### Required End-to-End Scenarios

1. A normal mixed-news edition creates only relevant beat specialists and publishes successfully.
2. A markets-heavy edition produces a different role graph from a general-news edition.
3. A weak draft is rejected, revised, re-judged, and then published.
4. An unsupported claim is blocked and never reaches voice generation.
5. A blocked claim becomes an evaluation case tied to a prompt version.
6. A repeated unchanged story is suppressed.
7. A developing story references prior coverage and states what changed.
8. A transient Telegram failure retries without duplicating the web edition.
9. Two overlapping cron triggers produce one edition because the lock and idempotency key hold.
10. Every published article’s “listen from here” offset seeks to the correct audio segment.
11. A breaking flash publishes only when novelty, importance, confidence, and corroboration thresholds pass.
12. Three repeated live runs achieve at least 85% success and leave verifiable receipts.

### Adapter Contract Tests

Contract-test each external boundary independently: official RSS, each allowlisted scrape adapter, Linkup, ElevenLabs, Convex, Cloudflare asset publishing, Telegram gateway, and analytics. Recorded fixtures may be used for deterministic CI, but the demo proof must include live calls.

### Evaluation Tests

Maintain a versioned set of supported claims, unsupported claims, conflicting-source claims, stale updates, duplicates, and correction cases. A prompt or policy change must not reduce pass rate below the configured release threshold.

### Non-Functional Validation

- Target a successful standard edition in under 150 seconds and record actual latency. The cron enqueue itself should finish in seconds.
- Track total and per-role model cost.
- Confirm mobile readability and audio controls.
- Confirm no secret or private token appears in public traces.
- Confirm scraper rate limits and public-page-only policy.
- Confirm graceful degradation when one source or one specialist fails.
- Confirm the website and Telegram URLs work from a judge’s device.

## Success Metrics

### Buildathon Proof Metrics

- Three or more autonomous published editions.
- 85%+ success over three or more repeated runs.
- Two visibly different dynamic role graphs.
- One manager rejection/revision cycle.
- One judge-blocked unsupported claim.
- One follow-up story using prior memory.
- Complete trace tree with token and cost data.
- Website and Telegram receipts for every claimed edition.
- Five power-up receipts: ElevenLabs, Cloudflare, Convex, Linkup, Wispr Flow.

### Audience Metrics

- Unique website visitors.
- Telegram channel joins or subscriber count.
- Waitlist signups.
- Audio starts and completion rate.
- Story-level “listen from here” usage.

Audience metrics are valuable cross-track proof but do not gate the core product.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Hindi voices sound flat | Test before event; switch to English immediately if quality is weak |
| Publisher feeds are unavailable | Validate multiple official feeds; use allowlisted scraper adapters only after thin slice |
| Scraping consumes sprint time | Start with feeds; limit custom adapters to one or two high-value sources |
| Hallucinated claims | Atomic claim gate, fail-closed publication, source receipts, Linkup corroboration |
| Dynamic agents become slow or expensive | Strict per-role budgets, only spawn needed beats, short editions |
| Hermes cron run exceeds its window | Keep each edition bounded; separate acquisition polling from edition generation |
| Duplicate posts | Lock + edition-window idempotency key + stored publication receipts |
| Telegram or network fails during demo | Retry policy, visible partial state, backup recording and proof export |
| Website template licensing uncertainty | Use an original minimal editorial CSS system |
| Public trace leaks secrets | Redact tool output and expose summaries/receipts, not raw credentials |
| Engagement loop rewards sensationalism | Engagement never overrides confidence, source diversity, or judge approval |
| Too much scope for six hours | P0 order is thin slice → dynamic org → fact gate → audio → publish → cron → Mission Control; defer generic collaboration features and extra scrapers |

## Out of Scope

- Paywall bypassing or unauthorized content republication.
- Original investigative journalism.
- Automated posting to social networks beyond Telegram for MVP.
- Listener accounts and per-user recommendation models.
- Full CMS authoring tools.
- Native mobile apps.
- Payment processing.
- Long-form four-minute bulletins if 90-second editions produce more reliable autonomous runs.
- Human recruitment or customer outreach as a dependency for product validity.

## Further Notes

- The GrowthX scoring root is real output on live surfaces. The edition cadence and publication receipts are therefore product requirements, not demo polish.
- Dynamic role derivation is essential. A fixed monitor → editor → writer → judge → publisher sequence alone is insufficient for the intended L4/L5 org score.
- The public newspaper is not merely a landing page; it is a second real output surface and a trust interface.
- The source gateway may expose RSS, but internal newsroom logic should consume a richer normalized contract.
- The site should prominently show the last autonomous publish time and make the evidence path easy for judges to inspect.
- The builder must retain screenshots/receipts for Wispr Flow and partner dashboards separately from the product trace.
- The dashboard should borrow the reference’s information architecture, not its persistent-agent architecture. Every status shown must come from a real Convex event or state transition.
- Design read: a dense operational newsroom dashboard for judges, with restrained editorial tooling language. Use light neutral surfaces, one amber accent, thin dividers, compact typography, and motion only for real state transitions.
