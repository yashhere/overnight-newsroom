---
id: ONR-003
number: 3
title: Add the hybrid RSS and public-page source gateway
type: issue
status: ready-for-agent
priority: P1
phase: event-day
blocked_by:
  - ONR-002
blocks: []
labels:
  - ready-for-agent
  - ingestion
  - cloudflare-worker
  - source-integrity
prd: ../PRD.md
---

# 003 — Add the hybrid RSS and public-page source gateway

## What to build

Expand the first slice into a resilient source gateway. Prefer official RSS feeds, add a five-minute Cloudflare scheduled fetch for one or two allowlisted public non-paywalled sites, and expose one normalized candidate stream to the newsroom.

## Acceptance criteria

- [ ] Multiple official RSS sources feed the same normalized contract.
- [ ] At least one allowlisted public-page adapter runs on a five-minute Cloudflare schedule.
- [ ] The gateway does not bypass paywalls, authentication, robots restrictions, or anti-bot controls.
- [ ] Requests are rate-limited, cached, attributed, and identifiable.
- [ ] One broken source does not fail the complete polling run.
- [ ] Exact duplicates are removed by canonical URL/content hash.
- [ ] Near-duplicate headlines are clustered for later editorial review.
- [ ] Every normalized record includes extraction confidence and a source receipt.
- [ ] Worker-to-Convex writes use a scoped server credential that is never shipped to the browser.
- [ ] The gateway exposes JSON for the newsroom and may additionally expose RSS for interoperability.
- [ ] Contract tests cover one RSS source, one public-page adapter, one malformed response, and one duplicate pair.

## Verification

Inspect a mixed batch containing feed and scraped records. Every record must have a common shape and traceable source.
