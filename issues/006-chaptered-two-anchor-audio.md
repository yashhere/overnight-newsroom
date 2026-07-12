---
id: ONR-006
number: 6
title: Produce fact-approved two-anchor audio with chapter timestamps
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-005
blocks:
  - ONR-007
  - ONR-008
labels:
  - ready-for-agent
  - elevenlabs
  - audio
  - media-pipeline
prd: ../PRD.md
---

# 006 — Produce fact-approved two-anchor audio with chapter timestamps

## What to build

Convert an approved edition script into clear two-anchor audio. Generate segment-level clips first, assemble a full bulletin, and persist accurate start offsets so each article can link directly to its matching audio.

## Acceptance criteria

- [ ] Only Judge-approved text enters the audio pipeline.
- [ ] The script contains structured anchor turns and pronunciation hints where required.
- [ ] ElevenLabs performs real voice generation for two distinct anchors.
- [ ] Each story or segment has a standalone audio clip.
- [ ] A complete edition audio file is assembled in rundown order.
- [ ] Segment duration and full-edition start offset are stored in milliseconds.
- [ ] The target edition remains approximately 250 words and 60–90 seconds.
- [ ] Hindi is used only if the pre-event voice check passed; otherwise English is used consistently.
- [ ] A failed segment render retries safely and does not corrupt the full edition.
- [ ] Audio assets have stable public URLs and content types.
- [ ] R2 delivery supports CORS and byte-range requests so browser seeking works reliably.
- [ ] Cost and latency are recorded per segment and edition.

## Verification

Play each story clip and seek the full-edition audio to the stored offset. Both must begin at the same spoken segment.
