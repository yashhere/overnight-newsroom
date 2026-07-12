---
id: ONR-012
number: 12
title: Turn newsroom failures into a closed-loop evaluation system
type: issue
status: ready-for-agent
priority: P1
phase: event-day
blocked_by:
  - ONR-005
  - ONR-011
blocks: []
labels:
  - ready-for-agent
  - evaluation
  - prompt-versioning
  - quality-gate
prd: ../PRD.md
---

# 012 — Turn newsroom failures into a closed-loop evaluation system

## What to build

Make every blocked claim, bad draft, duplicate, and correction improve the system. Persist failures as named evaluation cases, associate them with versioned prompts and role policies, rerun them automatically, and display measurable quality trends.

## Acceptance criteria

- [ ] Every blocked claim can become an evaluation case with expected safe outcome.
- [ ] Manager-rejected drafts and post-publication corrections can also become cases.
- [ ] Eval cases record failure category, evidence, originating edition, and prompt version.
- [ ] Prompt and manager-policy versions are tied to source-control identifiers.
- [ ] The eval suite can run against the current version without publishing output.
- [ ] A quality regression below threshold blocks release/publication and creates an alert.
- [ ] The UI shows pass rate by prompt version and failure category.
- [ ] At least one real failure from the day is captured and later passes after a change.
- [ ] The run comparison links the improvement to the relevant version.
- [ ] Eval execution cost and latency are recorded separately from production editions.

## Verification

Show one blocked claim entering the eval set, failing an old version, passing a newer version, and contributing to a visible pass-rate increase.
