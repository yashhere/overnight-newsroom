---
id: ONR-014
number: 14
title: Provide a non-engineer newsroom control surface
type: issue
status: ready-for-agent
priority: P1
phase: event-day
blocked_by:
  - ONR-010
  - ONR-011
blocks: []
labels:
  - ready-for-agent
  - management-ui
  - operations
  - guardrails
prd: ../PRD.md
---

# 014 — Provide a non-engineer newsroom control surface

## What to build

Give a non-engineer enough control to operate the newsroom without editing code: pause/resume, cadence, language, source allowlist, quality thresholds, budget, and a guarded way to define a new editorial need that the manager turns into an ephemeral role.

## Acceptance criteria

- [ ] An operator can pause and resume scheduled editions.
- [ ] An operator can change cadence within safe limits.
- [ ] An operator can select Hindi or English and see the active voice pair.
- [ ] An operator can enable or disable an allowlisted source.
- [ ] An operator can adjust minimum confidence, source diversity, and breaking thresholds within guardrails.
- [ ] An operator can inspect current dependency health and last successful publish.
- [ ] An operator can set edition token/cost budgets.
- [ ] A non-engineer can describe a new beat need in plain language; the Editor-in-Chief derives an ephemeral role spec from it.
- [ ] No persistent worker agent needs to be manually registered.
- [ ] Unsafe or incomplete role requests are rejected with an explanation.
- [ ] All management changes are audited with actor, time, old value, and new value.

## Verification

After one walkthrough, a non-engineer pauses the newsroom, changes cadence, disables a source, and requests a new guarded beat role without touching code.
