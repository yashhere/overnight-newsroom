---
id: ONR-REVIEW-001
title: Overnight Newsroom Final PRD and Ticket Review
type: review
status: complete
created_at: 2026-07-11
prd: ./PRD.md
labels:
  - architecture
  - scope-review
  - six-hour-build
---

# Overnight Newsroom Final Review

## Verdict

The PRD and ticket graph are implementation-ready. The product architecture, dashboard approach, runtime boundary, storage, deployment topology, critical path, and cut order are now explicit.

## Locked Stack

- React + Vite + TypeScript + Tailwind CSS for the newspaper and Mission Control
- Convex for schemas, functions, durable state, and real-time subscriptions
- Cloudflare Pages for the single public React deployment
- Cloudflare Worker for official-feed polling and an optional allowlisted public-page adapter
- Cloudflare R2 for chapter clips, full bulletin audio, and proof artifacts
- Node.js + TypeScript newsroom runtime on the OCI VM
- Hermes quiet one-shot sessions for the Editor-in-Chief and generated ephemeral specialists
- Hermes cron for fast idempotent enqueue ticks
- ElevenLabs for two-anchor speech
- FFmpeg for audio assembly and offset extraction
- Linkup Hermes skills for corroboration
- Hermes Telegram gateway for publishing and exception alerts
- Zod, Vitest, and Playwright for validation

## Locked Deployment

1. Cloudflare Pages serves `/`, edition/archive routes, and `/mission-control`.
2. Cloudflare Worker writes normalized candidates into Convex.
3. R2 serves immutable audio with CORS and byte-range support.
4. Convex pushes live state to the public site and dashboard.
5. The OCI VM runs Hermes gateway and a supervised newsroom runtime service.
6. Hermes cron enqueues edition requests quickly; the runtime performs the longer multi-agent run.

The public site deploys once. Publishing an edition writes Convex state and R2 media; it does not rebuild the website.

## Dashboard Construction

Mission Control is a projection of one canonical Convex event stream:

- Left: live roster of Editor-in-Chief and ephemeral specialists
- Center: Discovered → Planned → Reporting → Drafting → Fact Check → Voice → Publish → Done
- Right: append-only live activity feed
- Drawer: role spec, trace, evidence, costs, outputs, and artifacts
- Top bar: active agents, edition state, editions today, next run, latency, cost, and health

No second WebSocket service is needed. Convex subscriptions update all panes.

## Six-Hour Critical Path

The core path is:

`ONR-001 → ONR-002 → ONR-004 → ONR-005 → ONR-006 → (ONR-007 + ONR-008) → ONR-010 → ONR-015`

`ONR-011` starts immediately after `ONR-004` and runs alongside the content pipeline because all later stages emit events into it.

P1 tickets do not block the core demo:

- ONR-003: scraper fallback
- ONR-009: advanced continuity
- ONR-012: full closed-loop evaluation trend
- ONR-013: audience analytics and feedback
- ONR-014: non-engineer controls

## Required Cut Order

If behind schedule, cut:

1. Breaking flashes
2. Public-page scraper adapters
3. Side-by-side run comparison
4. Corrections UI and rich evidence mode
5. Advanced continuity
6. Engagement feedback
7. Operator controls

Never cut:

- Claim-level fact gate
- Two-anchor audio on a real public URL
- Website and Telegram receipts
- Three repeated autonomous runs
- Dynamic role derivation
- Live Mission Control roster, stage board, and event feed

## Remaining Pre-Event Checks

These are environment decisions, not PRD gaps:

- Test Hindi and English ElevenLabs voice pairs and lock one language
- Verify at least three official publisher feeds are healthy
- Confirm FFmpeg is installed on the OCI VM
- Confirm R2 CORS and byte-range playback
- Confirm the Telegram bot can publish audio to the target channel
- Confirm the Linkup API key is present and one Hermes skill call succeeds
- Confirm the runtime service survives SSH disconnect

## Final Risk

The largest risk is not the dashboard. It is the latency of multiple sequential Hermes and ElevenLabs calls. Keep the edition to three stories, fan reporters out concurrently, allow one repair attempt only, and target a complete edition under 150 seconds.
