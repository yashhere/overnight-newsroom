---
id: ONR-011
number: 11
title: Build the live Newsroom Mission Control and trace view
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-004
  - ONR-016
blocks:
  - ONR-012
  - ONR-014
  - ONR-015
labels:
  - ready-for-agent
  - observability
  - convex
  - mission-control
  - evidence
prd: ../overnight-newsroom-prd-v2.md
---

# 011 - Build the live Newsroom Mission Control and trace view

## What to build

Create a read-first, real-time dashboard that lets judges watch the Editor-in-Chief and dynamically spawned Hermes specialists work on the selected edition. Borrow the reference Mission Control’s three-pane information architecture, but project actual newsroom state rather than building a generic task-management product.

## Acceptance criteria

- [ ] A compact top bar shows active ephemeral agents, current edition state, editions published today, next cron run, current latency, total cost, and dependency health.
- [ ] The left pane lists the Editor-in-Chief and only the ephemeral specialists spawned for the selected edition.
- [ ] Every agent row shows generated role, beat, current assignment, state, latency, and cost.
- [ ] Finished agents move into the selected edition’s history instead of remaining falsely active.
- [ ] The center pane projects real story and production state through Discovered, Planned, Reporting, Drafting, Fact Check, Voice, Publish, and Done.
- [ ] Cards move because Convex state changes, not because a user manually drags them.
- [ ] The dashboard is served from `/mission-control` in the same Cloudflare Pages React application as the newspaper.
- [ ] Convex subscriptions are the only live-update mechanism; no separate WebSocket or notification daemon is introduced.
- [ ] The right pane streams append-only events including role spawned, handoff, draft rejected, revision accepted, claim blocked, audio rendered, publish succeeded, and exception raised.
- [ ] Clicking an agent, card, or event opens a detail drawer with role spec, parent-child trace, evidence, redacted summaries, tokens, cost, and artifacts.
- [ ] Every agent and tool step writes a structured trace node with a parent relationship.
- [ ] Trace nodes record role, task, status, timing, tokens, estimated cost, and redacted input/output summary.
- [ ] Manager reject/revise/accept cycles are visually identifiable.
- [ ] Judge blocks link to claim evidence.
- [ ] The live view filters by role and reconstructs the selected edition.
- [ ] Failure states are visible.
- [ ] Secrets and raw credentials are redacted.
- [ ] The dashboard excludes drag-and-drop, comments, documents, mentions, thread subscriptions, notification polling, daily standups, persistent worker identities, SOUL files, and agent heartbeat crons.

## Stretch criteria that do not block the live dashboard

- [ ] Search can find arbitrary historical editions, stories, roles, or failures.
- [ ] Cost-spike alerts are configurable.
- [ ] Side-by-side run comparison highlights different role graphs.

## Verification

During a live run, a mentor watches a new specialist appear, sees its assignment cross the board, observes a rejection and revision in the activity feed, opens the detail drawer, and identifies the most expensive role without using terminal logs.
