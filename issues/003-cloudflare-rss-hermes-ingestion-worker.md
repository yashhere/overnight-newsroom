---
id: ONR-003
number: 3
title: Superseded by ONR-016 OCI ingestion service
type: issue
status: superseded
priority: superseded
phase: event-day-frontier
blocked_by: []
blocks: []
labels:
  - superseded
  - ingestion
prd: ../overnight-newsroom-prd-v2.md
superseded_by:
  - ONR-016
---

# 003 — Superseded by ONR-016 OCI ingestion service

The old ONR-003 source gateway / Cloudflare Worker ingestion plan is superseded by [ONR-016](./016-oci-ingestion-service.md).

Reason:

- The ingestion slice now runs entirely on the OCI VM as two small systemd services:
  - RSS poller every 15 minutes
  - long-running Hermes enricher loop
- The Worker is no longer needed for this slice.
- Cloudflare points are earned later through Pages and R2, which are visible product surfaces.

Keep this file only as a historical pointer so old references to ONR-003 do not silently rot.
