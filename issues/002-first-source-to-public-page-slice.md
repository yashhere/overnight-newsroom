---
id: ONR-002
number: 2
title: Ship the first source-to-public-page tracer bullet
type: issue
status: ready-for-agent
priority: P0
phase: event-day
blocked_by:
  - ONR-001
blocks:
  - ONR-003
  - ONR-004
labels:
  - ready-for-agent
  - tracer-bullet
  - cloudflare
  - convex
prd: ../PRD.md
---

# 002 — Ship the first source-to-public-page tracer bullet

## What to build

Create the narrowest complete path: retrieve one real item from one official public feed, normalize and store it, create one edition record, and publish one attributed article to a real Cloudflare URL with a Convex receipt. This is deliberately not yet a full autonomous newsroom.

## Acceptance criteria

- [ ] The TypeScript workspace boots the Vite/React app, Convex backend, and OCI runtime with one documented command per surface.
- [ ] The public React app is deployed once to Cloudflare Pages and reads live edition data from Convex without per-edition redeploys.
- [ ] At least three live official feeds produce normalized source items; one is used for the first published slice.
- [ ] The item records canonical URL, publisher, title, timestamps, content hash, language, and source receipt.
- [ ] One edition containing that item is visible at a public URL from a second device.
- [ ] The page visibly attributes and links the original publisher.
- [ ] Convex stores the source item, edition, article, and publication receipt.
- [ ] A placeholder media object can be uploaded to R2 and fetched from its stable public URL.
- [ ] Re-running the slice with the same edition key does not create a duplicate page.
- [ ] A highest-seam test proves source input → durable state → public page.
- [ ] Failure of the source produces a visible failed run rather than a false success.

## Verification

Open the public URL and corresponding Convex records side by side. The public article and receipt must agree.
