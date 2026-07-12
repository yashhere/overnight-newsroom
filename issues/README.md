---
id: ONR-ISSUES-INDEX
title: Overnight Newsroom Issue Index
type: issue-index
status: ready-for-agent
created_at: 2026-07-11
prd: ../PRD.md
labels:
  - ready-for-agent
  - issue-index
---

# Overnight Newsroom — Numbered Issues

These tracer-bullet issues implement the [Overnight Newsroom PRD](../PRD.md). Work the **frontier**: any issue whose blockers are complete.

| # | ID | Title | Priority | Blocked by |
|---|---|---|---|---|
| 1 | ONR-001 | Prove pre-event infrastructure readiness without building the product | P0 | None |
| 2 | ONR-002 | Ship the first source-to-public-page tracer bullet | P0 | ONR-001 |
| 3 | ONR-003 | Add the hybrid RSS and public-page source gateway | P1 | ONR-002 |
| 4 | ONR-004 | Make Hermes derive and run a dynamic newsroom organisation | P0 | ONR-002 |
| 5 | ONR-005 | Gate every publishable claim with evidence | P0 | ONR-004 |
| 6 | ONR-006 | Produce fact-approved two-anchor audio with chapter timestamps | P0 | ONR-005 |
| 7 | ONR-007 | Publish the newspaper front page with audio deep links and evidence mode | P0 | ONR-006 |
| 8 | ONR-008 | Publish approved editions through the Hermes Telegram gateway | P0 | ONR-006 |
| 9 | ONR-009 | Add story memory, deduplication, and cross-edition continuity | P1 | ONR-002, ONR-005 |
| 10 | ONR-010 | Run autonomous editions on Hermes cron | P0 | ONR-007, ONR-008 |
| 11 | ONR-011 | Build the live Newsroom Mission Control and trace view | P0 | ONR-004 |
| 12 | ONR-012 | Turn newsroom failures into a closed-loop evaluation system | P1 | ONR-005, ONR-011 |
| 13 | ONR-013 | Add verifiable audience evidence and bounded editorial feedback | P1 | ONR-007, ONR-008, ONR-009 |
| 14 | ONR-014 | Provide a non-engineer newsroom control surface | P1 | ONR-010, ONR-011 |
| 15 | ONR-015 | Assemble the demo, proof pack, and failure recovery path | P0 | ONR-010, ONR-011 |

## Suggested event-day frontier

1. Complete ONR-002 first to prove the deployment seam.
2. ONR-004 follows directly. ONR-003 is a P1 fallback only if official feeds are insufficient.
3. After ONR-004, start the thin ONR-011 dashboard immediately so every later event appears live.
4. ONR-005 unlocks audio and optional continuity work.
5. ONR-007 and ONR-008 converge at ONR-010, the autonomy milestone. ONR-009 improves continuity but does not block repeated publication.
6. In the six-hour build, prioritize ONR-010 and ONR-011 before every P1 issue. Live output and visible agent work dominate scoring.
7. ONR-012, ONR-013, and ONR-014 are score-improving P1 work, not blockers for the core demo.
8. ONR-015 is the final integration and demo gate.
