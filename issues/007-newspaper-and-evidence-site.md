---
id: ONR-007
number: 7
title: Publish the newspaper front page with audio deep links and evidence mode
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-006
blocks:
  - ONR-010
  - ONR-013
labels:
  - ready-for-agent
  - cloudflare-pages
  - frontend
  - public-surface
prd: ../PRD.md
---

# 007 — Publish the newspaper front page with audio deep links and evidence mode

## What to build

Turn each approved edition into a polished public newspaper experience. Readers can scan stories, play the whole bulletin, listen from a specific article, inspect sources and selection reasons, and see developing-story and correction history.

## Acceptance criteria

- [ ] The public front page shows the latest edition with newspaper-style visual hierarchy.
- [ ] The design is responsive, readable, and based on an original lightweight CSS system or a verified-license theme.
- [ ] Edition archives are reachable by stable URLs; individual article routes are added only after the front page and player work.
- [ ] Every article shows publisher attribution, source links, publication time, and newsroom update time.
- [ ] Every article includes a standalone clip and a “listen from here” control for the full-edition player.
- [ ] “Listen from here” seeks to the correct stored offset.
- [ ] New, developing, follow-up, breaking, and correction badges render correctly.
- [ ] “Why this story” and source-diversity evidence are visible.
- [ ] Basic source receipts and judge verdict summaries are visible without requiring a separate evidence-mode interface.
- [ ] The masthead shows the last successful autonomous publish time and newsroom health.
- [ ] The site works from a judge’s mobile device without authentication.

## Stretch criteria that do not block autonomous publishing

- [ ] Individual article routes are reachable by stable URLs.
- [ ] A richer expandable evidence mode is available per claim.
- [ ] A public corrections ledger is reachable.
- [ ] Developing-story timelines render across editions.

## Verification

Open the latest edition on desktop and mobile, jump to audio from two different articles, and inspect the evidence and correction views.
