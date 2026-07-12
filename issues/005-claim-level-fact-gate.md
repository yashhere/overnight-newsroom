---
id: ONR-005
number: 5
title: Gate every publishable claim with evidence
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-004
blocks:
  - ONR-006
  - ONR-009
  - ONR-012
labels:
  - ready-for-agent
  - fact-checking
  - linkup
  - safety
prd: ../PRD.md
---

# 005 — Gate every publishable claim with evidence

## What to build

Add a Judge that decomposes reporter and writer output into atomic claims, checks original source receipts and live Linkup corroboration, and prevents unsupported content from entering the media or publication pipeline.

## Acceptance criteria

- [ ] Every script line maps to one or more atomic claims.
- [ ] Every factual claim has a verdict: approved, revise, block, or escalate.
- [ ] Every approval includes evidence links and a concise reason.
- [ ] Linkup performs real corroboration for claims that require an external check.
- [ ] An intentionally unsupported claim is blocked in a live test.
- [ ] Blocked or escalated claims cannot reach ElevenLabs or the publisher.
- [ ] The manager receives blocked claims with enough context to revise without restarting the run.
- [ ] Conflicting sources are surfaced rather than silently resolved.
- [ ] Judge latency, cost, verdict, and evidence are persisted.
- [ ] The public evidence view can show claim receipts without exposing secrets.

## Verification

Inject one supported claim and one fabricated claim. Only the supported claim may appear in the approved script; the fabricated claim must be visible in the judge trail.
