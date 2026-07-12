---
id: ONR-004
number: 4
title: Make Hermes derive and run a dynamic newsroom organisation
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-002
blocks:
  - ONR-005
  - ONR-011
labels:
  - ready-for-agent
  - hermes
  - dynamic-agents
  - agent-organisation
prd: ../PRD.md
---

# 004 — Make Hermes derive and run a dynamic newsroom organisation

## What to build

Turn Hermes into the Editor-in-Chief. For every edition, it must inspect current candidates and prior context, create an editorial plan, derive only the specialist roles required, launch fresh ephemeral Hermes workers, review their output, and request revisions when needed. No worker role is manually registered.

## Acceptance criteria

- [ ] The stable manager instructions contain newsroom policy and a role-derivation contract, not a static list of workers.
- [ ] Each generated role spec records why the role exists, assigned stories, mission, allowed tools, guardrails, success criteria, parent trace, and budget.
- [ ] Fresh Hermes child sessions are launched from generated role specs.
- [ ] Each child uses a unique newsroom source tag and a quiet one-shot Hermes invocation.
- [ ] Every child returns one structured result that is schema-validated before it can update Convex.
- [ ] Invalid output receives at most one bounded repair attempt before the role fails visibly.
- [ ] Independent reporter roles run concurrently within the configured concurrency limit.
- [ ] A general-news input and a markets-heavy input produce different role graphs.
- [ ] At least one run derives a specialist role not named in the initial manager instructions.
- [ ] Irrelevant beats are not spawned.
- [ ] The manager can reject a weak draft and send concrete revision notes back to a worker.
- [ ] At least one revision loop is persisted and visible.
- [ ] Worker outputs use structured, validated results and fail clearly when invalid.
- [ ] Hermes memory stores newsroom lessons and successful role patterns without requiring persistent worker registration.
- [ ] Per-role token/time budgets prevent unbounded fan-out.

## Verification

Compare two edition plans and traces. They must show different role graphs and one visible reject → revise → accept path.
