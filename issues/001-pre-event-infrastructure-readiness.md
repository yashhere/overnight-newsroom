---
id: ONR-001
number: 1
title: Prove pre-event infrastructure readiness without building the product
type: issue
status: ready-for-agent
priority: P0
phase: pre-event
blocked_by: []
blocks:
  - ONR-002
labels:
  - ready-for-agent
  - infrastructure
  - buildathon-compliance
prd: ../PRD.md
---

# 001 — Prove pre-event infrastructure readiness without building the product

## What to build

Prepare only the infrastructure and credentials the handbook permits before the sprint. Produce a readiness report proving that Hermes, Telegram, model access, ElevenLabs, Linkup, Convex, Cloudflare, and Wispr Flow are available, while leaving all newsroom product logic unbuilt.

## Acceptance criteria

- [ ] Hermes answers through the configured model and the provider/credit state is confirmed.
- [ ] Telegram gateway completes a real round trip and the bot can post to the target channel.
- [ ] Empty Convex and Cloudflare projects exist and credentials are stored outside source control.
- [ ] Linkup credits are active and one live query succeeds.
- [ ] ElevenLabs renders a short two-voice Hindi sample and a short two-voice English sample.
- [ ] A documented language decision selects Hindi only if both voices are clear; otherwise English is selected.
- [ ] At least four candidate publisher feed or public-page URLs are checked for reachability and terms-safe use.
- [ ] Wispr Flow is activated and the 500-word power-up evidence procedure is documented.
- [ ] No monitor, editor, judge, publisher, website, or other product implementation exists before the sprint.
- [ ] The readiness report records timestamps and redacts all secrets.

## Verification

A mentor can inspect the readiness report and distinguish permitted infrastructure wiring from event-day product work.
