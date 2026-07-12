---
id: ONR-013
number: 13
title: Add verifiable audience evidence and bounded editorial feedback
type: issue
status: ready-for-agent
priority: P1
phase: event-day
blocked_by:
  - ONR-007
  - ONR-008
  - ONR-009
blocks: []
labels:
  - ready-for-agent
  - analytics
  - cross-track
  - waitlist
prd: ../PRD.md
---

# 013 — Add verifiable audience evidence and bounded editorial feedback

## What to build

Collect privacy-minimal, verifiable proof that real people opened, joined, and listened. Add a Telegram QR code and waitlist, measure article/audio behavior, and allow engagement to influence future ordering without weakening fact or source standards.

## Acceptance criteria

- [ ] The website displays a scannable QR code for the real Telegram channel.
- [ ] A one-field waitlist stores consented signups with timestamps.
- [ ] The public site records unique visits through a verifiable analytics surface.
- [ ] Audio starts, completions, skips, and “listen from here” actions are recorded.
- [ ] Telegram channel subscriber or join evidence is captured where the platform permits it.
- [ ] A dashboard shows visits, waitlist signups, listens, completion, and chapter seeks.
- [ ] Editorial weighting can use engagement only after a minimum sample threshold.
- [ ] Engagement cannot override source confidence, diversity, or Judge verdicts.
- [ ] The manager can explain when engagement changed story ordering or beat allocation.
- [ ] Data collection is minimal and does not store unnecessary personal information.
- [ ] Wispr Flow 500-word usage and screenshot evidence are tracked as a separate power-up checklist item.

## Verification

Scan the QR code, join or open the channel, submit one waitlist entry, play and seek audio, then verify every event in the evidence dashboard.
