---
id: ONR-015
number: 15
title: Assemble the demo, proof pack, and failure recovery path
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-010
  - ONR-011
blocks: []
labels:
  - ready-for-agent
  - demo
  - verification
  - buildathon-submission
prd: ../PRD.md
---

# 015 — Assemble the demo, proof pack, and failure recovery path

## What to build

Package the completed newsroom into a reliable four-minute stage demonstration and verifiable proof set. The proof must survive a live network or provider failure and map every beat to the AI as Agency rubric and partner power-ups.

## Acceptance criteria

- [ ] The first 20 seconds explain who the product serves and which human function it replaces.
- [ ] The live two-minute demo plays approximately 30 seconds of the latest real bulletin.
- [ ] The demo shows at least three unattended publication timestamps and public receipts.
- [ ] The demo shows two different dynamic role graphs and one unexpected specialist.
- [ ] The demo shows a manager-rejected draft and successful revision.
- [ ] The demo shows one blocked claim with evidence; if ONR-012 is complete, it also shows the resulting eval case and improvement trend.
- [ ] The demo opens the live Telegram post and newspaper page from real URLs.
- [ ] The demo uses “listen from here” on one article.
- [ ] The proof minute shows root-output count, run success rate, cost/latency, power-up receipts, and any audience metrics available from ONR-013.
- [ ] A backup recording is captured before the final rehearsal.
- [ ] A static proof export contains edition receipts, trace screenshots, partner dashboard evidence, analytics, and source-control prompt versions.
- [ ] A recovery script explains how to narrate and switch to backup if a live run fails.
- [ ] The complete demo is rehearsed twice under four minutes.
- [ ] The public submission URL works from a clean browser on another device.
- [ ] The likely Q&A weakness—voice quality, source reliability, or staged autonomy—has a concise evidence-backed answer.

## Verification

Run the full timed demo once with services healthy and once with a simulated live failure that requires the backup path. Both must complete within four minutes.
