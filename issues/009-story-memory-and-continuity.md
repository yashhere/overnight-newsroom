---
id: ONR-009
number: 9
title: Add story memory, deduplication, and cross-edition continuity
type: issue
status: ready-for-agent
priority: P1
phase: event-day
blocked_by:
  - ONR-002
  - ONR-005
blocks:
  - ONR-013
labels:
  - ready-for-agent
  - convex
  - hermes-memory
  - continuity
prd: ../PRD.md
---

# 009 — Add story memory, deduplication, and cross-edition continuity

## What to build

Give the newsroom durable awareness of what it already covered. Suppress unchanged repeats, identify meaningful updates, label follow-ups, and let the Editor-in-Chief cite earlier editions when continuity adds value.

## Acceptance criteria

- [ ] Story clusters persist across acquisition and publication runs.
- [ ] Exact and near-duplicate candidates map to an existing cluster when appropriate.
- [ ] Prior coverage is retrieved before the manager plans a new edition.
- [ ] An unchanged previously covered story is suppressed.
- [ ] A materially updated story is labelled developing or follow-up.
- [ ] A follow-up records what changed and links the prior edition.
- [ ] “As we reported earlier” is used only when a valid prior receipt exists.
- [ ] Hermes memory receives concise editorial lessons and continuity guidance.
- [ ] Convex remains the durable source of truth for story history.
- [ ] Wiping Hermes memory degrades editorial continuity in a demonstrable test without destroying durable records.
- [ ] Memory retrieval latency and selected context are visible in the trace.

## Verification

Run two editions with the same story plus one changed fact. The second edition must suppress unchanged material and publish only the verified update with a prior-edition link.
