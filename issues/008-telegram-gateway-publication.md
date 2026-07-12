---
id: ONR-008
number: 8
title: Publish approved editions through the Hermes Telegram gateway
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
  - hermes-gateway
  - telegram
  - publishing
prd: ../PRD.md
---

# 008 — Publish approved editions through the Hermes Telegram gateway

## What to build

Publish every approved edition to the real Telegram channel using the Hermes messaging gateway. The post must include the audio bulletin, concise rundown, website link, source-aware wording, and a durable receipt.

## Acceptance criteria

- [ ] A real approved edition is posted to the target Telegram channel via Hermes gateway.
- [ ] The post includes edition timestamp, short rundown, public web URL, and audio.
- [ ] The channel message links back to the matching immutable edition.
- [ ] Telegram message ID, chat/channel ID, timestamp, and status are stored as a publication receipt.
- [ ] An edition-window idempotency key prevents duplicate posts.
- [ ] A simulated transient Telegram failure retries within a bounded policy.
- [ ] A partial web/Telegram publish is marked visibly and can recover.
- [ ] Unapproved or failed fact-gate editions cannot post.
- [ ] Exceptions are delivered to the operator with edition/run context.
- [ ] A judge can open the message directly from the evidence view.

## Verification

Trigger one publish, retry it, and confirm only one Telegram message exists with one durable receipt.
