---
id: ONR-010
number: 10
title: Run autonomous editions on Hermes cron
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-007
  - ONR-008
blocks:
  - ONR-014
  - ONR-015
labels:
  - ready-for-agent
  - hermes-cron
  - autonomy
  - overflow
prd: ../PRD.md
---

# 010 — Run autonomous editions on Hermes cron

## What to build

Make Hermes cron the authoritative trigger for repeated unattended publication. Run short editions every 30–45 minutes during the high-value window through a fast enqueue operation and the OCI newsroom runtime.

## Acceptance criteria

- [ ] A self-contained Hermes cron tick enqueues an edition request without a human message and exits within seconds.
- [ ] The OCI newsroom runtime consumes the queued request and starts the complete edition.
- [ ] The OCI runtime runs as a supervised user service, survives an SSH disconnect, and exposes a health state to Convex.
- [ ] The prompt instructs the Editor-in-Chief to derive ephemeral specialists rather than reference static workers.
- [ ] Standard cadence is configurable between 30 and 45 minutes.
- [ ] A distributed lock prevents overlapping runs from publishing twice.
- [ ] Edition-window idempotency survives process retries.
- [ ] At least three cron-triggered editions publish successfully during a real test window.
- [ ] The three runs achieve at least 85% end-to-end success.

- [ ] Run timeout, retry, and exception policies are visible and bounded.
- [ ] A standard edition finishes in under 150 seconds during the repeated-run test.
- [ ] Every autonomous run records start time, trigger type, end state, and public receipts.

## Verification

Leave the system unattended for a multi-run window. The public surfaces and evidence view must show repeated cron-triggered output with no duplicate editions.

## Stretch criteria that do not block repeated publication

- [ ] A breaking flash triggers only when novelty, importance, confidence, and corroboration thresholds pass.
- [ ] A low-confidence “breaking” candidate does not publish.
