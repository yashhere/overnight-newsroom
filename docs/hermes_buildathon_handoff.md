# Hermes Buildathon — AI as Agency: Complete Handoff
## GrowthX Hermes Buildathon · Builder Handbook Extraction
### Prepared for chandamama · July 11, 2026

---

## 1. TRACK OVERVIEW: AI as Agency (Track 03)

**Core concept:** A team of AI agents replaces a full human function. Manager plans, specialists execute, handoffs pass work between them, memory persists across tasks, and a control surface lets a non-engineer assign work.

**Base: 164 points** | **Overflow: uncapped** | **Power-ups: +150 max**

---

## 2. SCORING RUBRIC (L1–L5, points = (L-1) × weight)

| # | Parameter | Weight | Max L5 | What L5 looks like |
|---|-----------|--------|--------|-------------------|
| 1 | **Working product shipping real output** | **20x** | **80** | End to end on real live surfaces, 85%+ success across 3+ repeated runs, escalates by exception only. **Overflow: +1pt × 20x per additional real task completed autonomously during judging** |
| 2 | Agent org structure | 5x | 20 | Emergent org: manager spawns sub-specialists on the fly, agents escalate when stuck, roles self-adjust |
| 3 | Observability | 7x | 28 | Production-grade: diff two runs side by side, alerts on failure/cost spike, search across runs |
| 4 | Evaluation and iteration | 5x | 20 | Closed-loop: failed runs feed growing eval set, version-controlled prompts, measurable gains across versions |
| 5 | Agent handoffs & memory | 2x | 8 | Full relevant history: now + user's past + business rules, survives all handoffs |
| 6 | Cost & latency per task | 1x | 4 | Under 1 min AND under $0.10 per task |
| 7 | Management UI | 1x | 4 | Non-eng volunteer onboards a new agent role in < 10 minutes unassisted |

---

## 3. PARTNER POWER-UPS (Flat +25 each, no cap)

| Partner | Points | What counts |
|---------|--------|-------------|
| **OpenAI** | — | $200 credits + 1 month Codex Pro (no power-up points) |
| **ElevenLabs** | +25 | Voice does real work in the product |
| **Cloudflare** | +25 | Hosting, Workers, or any CF product doing real work |
| **Convex** | +25 | Stores real product state or is the main backend |
| **Linkup** | +25 | Live search doing real work in the product |
| **Wispr Flow** | +25 | 500+ words dictated during the event |
| **Dodo Payments** | +25 | Live checkout in the product |
| **All six** | **+150** | Stack them all |

---

## 4. CROSS-TRACK BONUS (capped at 50)

Your track = AI as Agency. Wins outside it still pay at half weight:
- Virality Signups: 12.5x → max 50
- Virality Visitors: 5x → max 20
- Revenue Signups: 10x → max 40
- Revenue Product Quality: 4x → max 16
- Revenue Generated: 6x → max 24

---

## 5. ALL 23 AI AS AGENCY IDEAS (FROM IDEA LIBRARY)

### MEDIUM DIFFICULTY

---

#### 5.1 Community Ops Agency
Create moderation rules, event calendar, member onboarding, weekly digest, and engagement loops.

**Why it can win:** Winnable: bots, crons, and templates on a community you already have access to. Wedge is running it live in a real server during the event, not a policy PDF. Most teams write docs; the digest that actually posted and a real member onboarded is what judges remember.

**Build steps:**
1. Post announcement — first impressions = first signups
2. Waitlist page on Cloudflare Pages
3. Crew skeleton: community director → moderator, onboarding guide, digest writer, QA subagents
4. Bot inside real Discord/Slack via gateway on day one
5. Run log: every mod flag, welcome, digest showing the agent and trigger
6. Full end-to-end: real new member joins, onboarding greets and routes, digest composes
7. Post digest into live community — the moment output is public
8. Overflow: cron Friday digest + daily engagement prompts, memory with member profiles
9. Demo: join server, catch new member onboarding in run log, trigger digest, close on member reactions

**Persona:** "As the one-person ops team for a 3,000-member builder Discord, I lose 11 hours a week to digests, onboarding, and mod calls."

**Agent org:** Community director → moderator, onboarding guide, digest writer, QA subagents
**Real surface:** Discord/Slack bot via gateway, live digest posted
**Power-ups:** Convex (+25), Cloudflare (+25)
**Memory L4:** Digests auto-personalize to member's remembered interests
**Memory L5:** Wipe memory and moderation loses all context, repeat offenders look new
**Demo moment:** Join live server. New member arrives, onboarding agent greets. Trigger digest cron. Members react.

---

#### 5.2 Competitive Intelligence Agency
Track competitors, claims, pricing, positioning, and sales objections.

**Why it can win:** Scheduled research + synthesis is exactly what cron + web search do. Wedge: judges care what CHANGED, not a static profile. Wire the cron so mentors see two real sweeps land in Slack.

**Build steps:**
1. Post announcement
2. Waitlist on Cloudflare Pages
3. Intel chief → per-competitor researcher subagents + analyst + QA
4. Battlecard dashboard (CF Pages) + daily digest into real Slack via gateway
5. Run log: researcher findings with Linkup source links, analyst diff, QA source check
6. Day-one snapshot of every competitor's pricing/changelogs/news into Convex memory
7. Full sweep: researchers fan out, analyst diffs vs snapshot, QA checks sources, digest lands in Slack
8. Overflow: 8am cron, multiple sweeps
9. Demo: yesterday's snapshot, trigger cron live, narrate fan-out, digest lands in Slack, rep replies

**Persona:** "As a PMM at a Noida HR-tech firm, sales keeps losing to two rivals whose pricing changed twice this quarter without us noticing."

**Agent org:** Intel chief → per-competitor researchers + analyst + QA
**Real surface:** Battlecard dashboard + daily Slack digest
**Power-ups:** Linkup (+25), Convex (+25), Cloudflare (+25)
**Demo moment:** Show yesterday's snapshot. Trigger cron live: researchers fan out with sources. Analyst produces diff. Digest lands in real Slack.

---

#### 5.3 Customer Support Agency
Upload tickets. Build macros, escalation tree, FAQ, and response quality rubric.

**Why it can win:** Clustering + writing over real data fits 8 hours. Wedge: real tickets (even 200 rows from a friend's startup) beats synthetic data.

**Build steps:**
1. Post announcement
2. Waitlist on CF Pages
3. Support director → clusterer, macro writer, escalation designer, QA subagents
4. Push macros into live helpdesk or Slack bot via gateway
5. Run log: each cluster, macro, QA rubric score tagged to agent
6. Full pass on real 1,400-ticket CSV: 12 issues, 25 macros, escalation tree, pushed live
7. Answer one real incoming ticket with macro — the moment it's real
8. Overflow: weekly re-cluster cron, Slack digest, memory of product quirks
9. Demo: upload tickets, clusters form, macro-writer-to-QA handoff, push live, close on answered ticket

**Persona:** "As support lead at a 10-person Jaipur SaaS drowning in 60 tickets a day, I export 1,400 tickets. Hermes clusters 12 issues, writes 25 macros."

**Agent org:** Support director → clusterer, macro writer, escalation designer, QA
**Real surface:** Slack bot + macros pushed to live helpdesk
**Power-ups:** Convex (+25), Cloudflare (+25)
**Memory L4:** New tickets auto-map to remembered clusters and reuse tuned macros
**Demo moment:** Upload 1,400 tickets. Clusters form. Push macros live. Answer one real ticket with macro 7.

---

#### 5.4 Deal Desk Agency
Upload proposal notes → quote, scope, risk memo, negotiation lines, handoff docs.

**Why it can win:** Notes-to-packet is one clean pipeline across sales/finance/legal/delivery. Wedge: scope exclusions and risk memo (the parts founders skip). Packet sent with live payment link = shipped proof.

**Build steps:**
1. Post announcement
2. Waitlist on CF Pages
3. Deal desk lead → scoper, pricer, risk reviewer, negotiation coach, QA
4. Packet-email pipeline with live Dodo payment link on every quote
5. Run log: each packet section shows agent + call note it derived from
6. Full pass on real call notes: scope vs rate card, risk memo, negotiation lines, QA catches exclusion conflict
7. Email finished packet with Dodo link to real prospect
8. Overflow: two more deals, memory accumulates rate card and past deals
9. Demo: paste call notes, narrate scoper-pricer-risk-QA handoffs, close on sent packet with live payment link

**Persona:** "As a services founder closing a Rs 6 lakh retainer, proposals take 3 evenings. Hermes drafts quote, scope, risk memo, negotiation lines, and Dodo link. Client signs before budget meeting."

**Agent org:** Deal desk lead → scoper, pricer, risk reviewer, negotiation coach, QA
**Real surface:** Packet emailed to real prospect with live Dodo link
**Power-ups:** Dodo Payments (+25), Convex (+25)
**Memory L4:** New quotes auto-anchor to what similar remembered deals closed at
**Demo moment:** Paste call notes. Run log shows agents assembling. QA catches scope conflict. Email packet to prospect with Dodo link.

---

#### 5.5 Event Ops Agency
For an event: venue checklist, speaker notes, host script, sponsor posts, attendee comms, recap pack.

**Why it can win:** Self-referential — run it on a real event, even this buildathon. Wedge: live Telegram bot answering REAL attendee questions, not the document pack.

**Build steps:**
1. Post announcement
2. Waitlist on CF Pages
3. Event director → logistics, comms, sponsor, speaker-ops agents + QA
4. Telegram attendee bot on gateway answering logistics from event brief
5. Run log: every attendee answer and comms draft traced to agent
6. Full pass on real upcoming event: venue checklist, host script, sponsor posts, attendee comms, QA review
7. Send real comms: T-minus reminder to real speaker, real attendee asks Telegram bot
8. Overflow: T-minus cron ladder, venue/speaker facts stored as memory skills
9. Demo: four agents assembling pack in run log, attendee bot answering, speaker reminder landing

**Persona:** "As a city lead running a 200-person buildathon in Indore, my ops live in six chats. Hermes produces venue checklist, speaker runbook, host script, and a Telegram bot answers 'where do I park at 7am.'"

**Agent org:** Event director → logistics, comms, sponsor, speaker-ops + QA
**Real surface:** Telegram attendee bot, comms sent to real people
**Power-ups:** Convex (+25), Linkup (+25)
**Demo moment:** Brief event. Run log shows four agents building pack. Live: attendee messages Telegram bot a logistics question and gets right answer. Speaker reminder fires into real chat.

---

#### 5.6 Knowledge Base Agency
Upload docs, transcripts, FAQs. Build knowledge base + Q&A bot with source citations.

**Why it can win:** Structure, gap-fill, and cited Q&A over real docs. Wedge: citations — every answer must link its source file or trust dies. The agent that WRITES what's undocumented is the agency move.

**Build steps:**
1. Post announcement
2. Waitlist on CF Pages
3. KB director → doc structurer, gap detector, doc writer, retrieval QA
4. Public chat page on CF Pages where answers cite sources
5. Run log: each KB article shows source files or gap interview
6. Full pass: taxonomy built, gap detector lists missing docs, writer fills them, retrieval QA tests 25 questions
7. Three real teammates query live chat page, answer rate logged
8. Overflow: new docs ingested, freshness tracked, answer rate re-measured
9. Demo: upload docs, structurer → gap detector → writer in run log, teammates get cited answers

**Persona:** "As ops lead at a 25-person Chennai startup, the same 30 questions hit me weekly. Hermes structures a KB, writes 9 missing docs it detected, ships a chat page."

**Agent org:** KB director → doc structurer, gap detector, doc writer, retrieval QA
**Real surface:** Public chat page with cited answers
**Power-ups:** Convex (+25), Cloudflare (+25)
**Memory L4:** Repeat askers get answers shaped by remembered role and past asks
**Demo moment:** Upload docs. Run log: structurer, gap detector listing 9 missing, writer filling. Live chat: 3 teammates ask, every answer with source link, answer rate on screen.

---

#### 5.7 Landing Page Conversion Agency
Audit site, rewrite copy, design section order, create test plan, deploy preview.

**Why it can win:** Audit-rewrite-redeploy = tight 8-hour loop with visible before/after. Wedge: shipping preview LIVE, not a report. Anchor every change to named conversion principle + rival evidence.

**Build steps:**
1. Post announcement
2. Waitlist on CF Pages
3. Conversion lead → browser auditor, copywriter, section architect, coder, QA
4. Deploy pipeline to public CF Pages preview URL
5. Run log: every change lists agent, principle, evidence (screenshots + Linkup rivals)
6. Full pass on real client URL: audit → copywriter/coder rebuild → QA diffs before/after
7. Deploy rebuilt page to public preview URL, real owner opens on phone
8. Overflow: two more pages, Worker A/B split, click events into Convex
9. Demo: paste client URL, audit-rebuild-QA in run log, deploy on camera, owner opens preview

**Persona:** "As an indie hacker whose landing page converts 0.8%, I paste my URL. Hermes audits, rewrites every section, reorders narrative, deploys preview. I A/B the headline and see 2.1% by the weekend."

**Agent org:** Conversion lead → browser auditor, copywriter, section architect, coder, QA
**Real surface:** Rebuilt page deployed to public preview URL
**Power-ups:** Cloudflare (+25), Linkup (+25), Convex (+25)
**Demo moment:** Paste client's live URL. Auditor screenshots issues. Copywriter/coder rebuild. QA diffs. Deploy on camera. Owner opens preview on phone.

---

#### 5.8 Overnight Newsroom (⭐ YOUR PICK)
An autonomous newsroom shipping broadcast-quality audio bulletins from live Indian feeds with NO human trigger: monitor watches the wires, editor picks rundown, writer scripts, judge fact-gates every line, anchor voices read, publisher posts to public feed + Telegram channel.

**Why it can win:** RSS in, audio out is achievable fast. Cron makes autonomy provable with timestamps. The wedge: fact-gate judge — one hallucinated headline kills trust. Most teams demo one hand-run edition; the unattended schedule is the entire score.

**Full build plan (8 hours):**

| Hour | Task |
|------|------|
| H1 | Find 3-5 Indian news RSS feeds (The Hindu, Indian Express, PTI). Set up Telegram channel. Deploy empty Cloudflare Pages site. |
| H2 | Build Monitor agent (RSS reader → raw story list). Build Editor agent (picks rundown from stories). |
| H3 | Build Writer agent (stories → English bulletin script). Add ElevenLabs voice rendering (2 voices trading segments). |
| H4 | Wire pipeline end-to-end in terminal: RSS in → audio file out. Test 2 bulletins. |
| H5 | Build Judge agent — fact-gates every line against Linkup search. Block any unsourced claim. |
| H6 | Wire Publisher (Telegram bot + Cloudflare Pages post). Add Convex logging for every agent decision. Set up cron. |
| H7 | Add story memory in Convex (covered stories list). Run 2 full editions. Fix bugs. Collect publish log. |
| H8 | Let it run UNATTENDED for afternoon. Rehearse demo. Recruit a few subscribers from the room (optional). |

**Demo script (2 min):**
```
0:00 — "5 agents, no human touch since noon."
0:20 — Play 30 sec of latest Hindi bulletin (ElevenLabs voices, live news, fact-gated)
0:50 — Open publish log (Convex dashboard):
       - 10:00 AM: Edition 1 (monitor → editor → writer → judge → publisher)
       - 1:00 PM: Edition 2 (judge blocked 1 claim: "unsourced")
       - 4:00 PM: Edition 3 (referenced morning story from memory)
       "Editions 2 and 3 shipped while we were building. Nobody touched it."
1:30 — Open Telegram channel: 3 bulletins posted on schedule.
       "12 subscribers joined during the event — people from this room."
1:50 — Show fact-gate catching a hallucination in judge log. 
       "This is evaluation — the judge blocked a claim it couldn't source."
2:00 — "Real output, running on schedule, no human needed."
       → Transition to proof minute (publish log, decision log, subscriber count)
```

**Agent org:** Editor (manager) → Monitor, Writer, Judge, Publisher (5-agent pipeline with real handoffs)
**Real surface:** Telegram channel + Cloudflare Pages episode site
**Memory:** Story memory prevents repeats; afternoon editions reference morning stories
**Power-ups:** ElevenLabs (+25), Cloudflare (+25), Convex (+25), Linkup (+25) = **+100**
**Scoring:** Bulletins publishing on schedule to public surface = 20x root. Newsroom org = textbook structure (5x). Per-edition decision log = observability (7x). Fact-gate = evaluation (5x).

**No outreach needed.** Telegram channel auto-populates from the cron. You don't need subscribers — the proof is the timestamps proving unattended runs.

---

#### 5.9 Sponsorship Sales Agency
For an event/community: sponsor list, custom pitch, deliverables, pricing, follow-up emails.

**Why it can win:** Self-referential — sell sponsorships for a real event. Wedge: relevance evidence — each pitch cites sponsor's past event bets.

**Build steps:** Similar pattern — sponsor lead → researcher, pitch writer, pricing analyst, QA. Linkup finds 40 sponsors via past event bets. Send 3 real pitches from organizer's email. Live pipeline board in Convex.

**Persona:** "As a community lead funding a 300-person buildathon in Kochi, I need Rs 4 lakh in sponsorships. Hermes builds list of 40 sponsors, drafts custom pitches, prices 3 tiers."

**Power-ups:** Linkup (+25), Convex (+25)

---

### HARD DIFFICULTY

---

#### 5.10 AI Implementation Agency
Audit workflows → propose 5 automations with ROI, tools, setup steps, risks. Build the TOP automation live.

**Why it can win:** Deliverable includes one WORKING automation, not just audit. Wedge: live build. Interview a real operator for 5 minutes.

**Agent org:** Engagement lead → interviewer, workflow mapper, architect, builder, QA
**Power-ups:** Linkup (+25), Convex (+25), Cloudflare (+25)
**Demo moment:** Interview operator, roadmap assembles in run log, trigger real automation on stage.

---

#### 5.11 Finance Ops Agency
Invoice collection, vendor tracker, cashflow view, reimbursement prep, monthly finance memo.

**Why it can win:** Parsing + matching + memo writing are agent-safe while judgment stays human. Wedge: approval gate — reminders drafted, human taps send.

**Agent org:** Finance controller → invoice parser, reconciler, collections writer, QA
**Real surface:** Approved reminders emailed; monthly memo to founder's inbox
**Power-ups:** Convex (+25), Cloudflare (+25)
**Demo moment:** Upload invoices + bank CSV. Parser matches 34/38. QA recomputes totals. Send reminder to real overdue client. Cashflow memo lands in founder inbox.

---

#### 5.12 Inbox Zero Mercenary (⭐ BACKUP PICK)
Point at YOUR Gmail inbox: triages thousands, unsubscribes junk via browser, archives dead threads, drafts replies. You approve from Telegram — nothing auto-sends.

**Why it can win:** Gmail access takes 15 minutes. Volume is instant proof. Wedge: visible action log. Judges want thousands processed, not 20 emails.

**Agent org:** Orchestrator → triage, unsubscribe, archive, reply subagents
**Real surface:** Real Gmail inbox + Telegram approval gateway
**Power-ups:** Convex (+25), Cloudflare (+25), ElevenLabs (+25) = **+75**
**Scoring note:** Root 20x = real output at volume (actual inbox visibly handled). Agent org 5x from triage crew, observability 7x from per-agent action log.
**Demo moment:** Open 10,000-unread inbox. Start crew. Dashboard climbs past 3,000. Approve 2 replies from Telegram. Show unsubscribe executing in browser. ElevenLabs voice recap.

**No outreach.** Your own Gmail. Zero humans needed.

---

#### 5.13 Maintainer Desk (⭐ STRONGEST PICK)
Agent ops desk for real open source repo: triager labels + reproduces issues, reviewer does first-pass PR review, docs agent patches stale pages, community agent drafts replies, manager routes, judge gates everything before it posts to GitHub.

**Why it can win:** GitHub is the rare surface where agents can ship VISIBLE PUBLIC WORK in hours. Wedge: judge gate — quality control separates this from spam. One bad comment kills the demo.

**Agent org:** Manager → triager, reviewer, docs, community agents + judge gate on ALL output
**Real surface:** Real GitHub repo (labels, comments, reviews, PRs)
**Power-ups:** Cloudflare (+25), Convex (+25), Linkup (+25) = **+75**
**Demo moment:** Open live repo, walk trail of labels/repro comments/review/docs PR. Dashboard of routing, judge decisions, cost per action. Real output on real surface — the 20x root.
**Scoring note:** Merged PRs on real repos = strongest 20x root. Manager-judge org = structure (5x). Action log with costs = observability (7x) + evaluation.

**No outreach.** Point at YOUR repos. Hermes Agent itself is open source — use that.

---

#### 5.14 Microsite Factory
Paste 20 target accounts → personalized microsite for each: researcher digs, strategist picks angle, builder generates, QA screenshots/gates, deployer pushes to live URL.

**Agent org:** Manager → researcher, strategist, builder, QA, deployer (per account)
**Real surface:** 20 live URLs on Cloudflare Pages
**Power-ups:** Cloudflare (+25), Linkup (+25), Convex (+25) = **+75**
**Scoring:** Fleet of 20 live sites = real output at volume (20x root). Pipeline = org structure. Fleet dashboard = observability.

---

#### 5.15 On-Call Autopilot
AI on-call engineer: diagnose logs → name root cause → patch → redeploy → verify fix → open PR. Narrated over ElevenLabs voice.

**Agent org:** Diagnoser → fixer → verifier (3-agent handoff)
**Real surface:** Demo app on Cloudflare Workers with 3 scripted failure modes
**Power-ups:** ElevenLabs (+25), Cloudflare (+25), Convex (+25), Linkup (+25) = **+100**
**Demo moment:** Break live app to 500. Phone autopilot: "fix it." Diagnoser → fixer → verifier timeline. App returns 200. PR appears. Real outage closed end-to-end.
**⚠️ Concern:** Needs a scripted failure demo app. Risk of looking staged.

---

#### 5.16 Podcast Clips Agency
Drop podcast episode → transcriber, moment scorer, parallel clip cutters, captioner, thumbnail artist, publisher posts to real social accounts.

**Agent org:** Manager → transcriber, scorer, fan-out cutters, captioner, artist, publisher + in-crew judge panel
**Real surface:** Real Instagram/TikTok post to consenting creator's account
**Power-ups:** Convex (+25), Cloudflare (+25), Linkup (+25)
**⚠️ Needs outreach:** Recruit one consenting podcaster.

---

#### 5.17 PR Factory (⭐ STRONG PICK)
Drop GitHub issue → planner decomposes → parallel coder agents race in isolated worktrees → judge picks winning diff → QA runs tests → real PR lands with decision trail.

**Agent org:** Planner → coder A vs coder B (racing) → judge → QA
**Real surface:** Real PR on real GitHub repo
**Power-ups:** Cloudflare (+25), Convex (+25) = **+50**
**Demo moment:** Paste issue. Kanban shows coders racing. Judge picks winner. QA green. PR lands. "2 minutes, 47 seconds. Real PR, real repo."
**Scoring:** Merged PRs on real repos = strongest 20x root. Race-plus-judge org = legible structure (5x). Kanban = observability (7x). Picking winners by tests = evaluation.

**No outreach.** Your own repos. Your own issues.

---

#### 5.18 Recruiting Agency
JD rewrite, sourcing strategy, screening rubric, first outreach, interview plan, candidate summary.

**Agent org:** Head of talent → role strategist, sourcer, outreach writer, QA
**Real surface:** Founder hiring workspace, outreach from founder's own account
**Power-ups:** Linkup (+25), Convex (+25)
**⚠️ Needs:** One real open role to work on. Best if a friend has a hiring need.

---

#### 5.19 Sales Development Agency
ICP, account list, lead enrichment, email sequence, call script, CRM import file. No auto-send — QA gate holds everything.

**Agent org:** Head of sales → account researcher, qualifier, copywriter, QA
**Real surface:** CSV imported into real HubSpot, drafts in AE's Gmail
**Power-ups:** Linkup (+25), Convex (+25), Cloudflare (+25)
**⚠️ Needs:** Real ICP. No outreach required (output is pack, not sent emails).

---

#### 5.20 Security Review Agency
Scan repo for secrets, risky dependencies, missing controls. Every finding ships with exact fix.

**Agent org:** Security lead → secrets scanner, dependency auditor, remediation writer, QA
**Real surface:** Draft issues filed in real GitHub repo
**Power-ups:** Linkup (+25), Convex (+25) = **+50**
**Demo moment:** Point at repo. Scanner finds hardcoded key. Auditor cites live CVE via Linkup. Remediation writer attaches fix. QA validates. 5 issues filed, first fix merged.

**No outreach.** Scan YOUR repos.

---

#### 5.21 SEO Agency Crew
Full SEO agency: pillar strategy, articles (not slop), internal links, backlink outreach with real cold emails, Reddit seeding, AEO. Publishes to WordPress, promotes, and wins links.

**Agent org:** Manager → strategist, writer, internal-linker, link-outreach, community specialists
**Real surface:** Live WordPress post, real outreach emails sent, Reddit answer seeded
**Power-ups:** Linkup (+25), Convex (+25), Cloudflare (+25)
**⚠️ Needs:** Real domain with WordPress. Outreach emails sent to real prospects but you control the list.

---

#### 5.22 User Research Agency
Research question → recruiter screens respondents → parallel interviewer agents run 10-min interviews → analyst clusters transcripts → writer publishes findings with real quotes.

**Agent org:** Manager → recruiter, parallel interviewers, analyst, writer
**Real surface:** Findings report on Cloudflare Pages with verbatim quotes
**Power-ups:** ElevenLabs (+25), Convex (+25), Linkup (+25), Cloudflare (+25) = **+100**
**Demo moment:** Kick off study live. 3 interviews running in parallel. Jump into transcript. Judge clicks theme → lands on quote. Real respondents, real output.
**⚠️ Needs:** Recruit 5-10 people from the room. Not cold outreach — people at the buildathon.

---

#### 5.23 Winback Agency
Segment lapsed customers → draft per-segment offers → send WhatsApp/email campaign → reply handler books orders/logs objections.

**Agent org:** Manager → segmenter, copywriter, sender, reply handler
**Real surface:** Real WhatsApp/email sends to real lapsed customers
**Power-ups:** Convex (+25), Linkup (+25), Cloudflare (+25)
**⚠️ Needs:** Real lapsed customer list from a business. Hardest to source.

---

## 6. YOUR TOP PICKS — RANKED FOR CHANDAMAMA

### 1. 🥇 Overnight Newsroom (Your Current Pick)
**Why for you:** 5-agent pipeline is textbook L5 org structure. RSS → audio pipeline is achievable. 4 power-ups. Self-contained — no humans needed for the demo.
**Risk:** Audio quality of ElevenLabs voices. Mitigate by testing early.
**No outreach needed. ✅**
**Power-ups: +100** (ElevenLabs, CF, Convex, Linkup)

### 2. 🥈 Maintainer Desk
**Why for you:** You run open-source tooling, you code, you have repos. Zero outreach. The GitHub surface is PUBLIC and visible — judges can open the PRs themselves.
**No outreach needed. ✅**
**Power-ups: +75** (CF, Convex, Linkup)

### 3. 🥉 PR Factory
**Why for you:** Racing coders + judge = visually impressive demo. Your own repos. Same advantages as Maintainer Desk but flashier demo.
**No outreach needed. ✅**
**Power-ups: +50** (CF, Convex)

### 4. Inbox Zero Mercenary
**Why for you:** Most universal demo. Everyone relates to a drowning inbox. Volume = overflow potential.
**No outreach needed. ✅**
**Power-ups: +75** (CF, Convex, ElevenLabs)

### 5. Security Review Agency
**Why for you:** Clean agent org. Your repos. Every finding = verifiable output.
**No outreach needed. ✅**
**Power-ups: +50** (Linkup, Convex)

---

## 7. KEY DECISION FACTORS FOR YOUR FINAL PICK

| Factor | Overnight Newsroom | Maintainer Desk | PR Factory |
|--------|-------------------|----------------|------------|
| No outreach | ✅ | ✅ | ✅ |
| Real surface | Telegram + CF Pages | GitHub | GitHub |
| Agent org L4-L5 | 5-agent pipeline | Manager + 4 specialists + judge | Racing coders + judge |
| Power-up ceiling | +100 | +75 | +50 |
| Demo wow factor | Audio bulletin playing live | Walking real GitHub action trail | PR landing in 2 min |
| Reliability risk | ElevenLabs quality | Low | Judge accuracy |
| Overflow potential | 3+ editions | Multiple PRs/issues | Multiple PRs |

---

## 8. PREVIOUS HACKATHON ANALYSIS

We cross-referenced OpenClaw hackathon projects against current sponsors:
- **Minara** (AI Financial Assistant) → Maps to Finance Ops Agency
- **ClawShield** (Security Skill) → Maps to Security Review Agency  
- **Clawshi** (Prediction Market) → Maps to Competitive Intelligence Agency
- **MoltDAO** (AI Governance) → Niche crypto play, harder to demo

---

## 9. NEXT STEPS

1. **Before the event:** Set up ElevenLabs, get RSS feeds tested, wire Convex, deploy CF Pages, test the full pipeline end-to-end
2. **Day of buildathon:** Follow the 8-hour plan. Ship the loop early (H1-H4), polish after (H5-H8)
3. **Demo prep:** Record a backup run before going on stage. Practice the full 4 minutes twice.
4. **Claude Code:** Feed this document + the full handbook to Claude Code for further brainstorming

**Files in this VM:**
- `~/hermes_buildathon_handbook.txt` — Full 13-page handbook (rules, scoring, prizes, setup)
- `~/hermes_buildathon_agency_briefs.txt` — Index of all 23 briefs

---

---

## 10. CLAUDE CODE REVIEW — STRATEGIC IMPROVEMENTS (July 11)

### Why Newsroom Wins (over Maintainer/PR/Inbox)

The other picks need a surface you already own — a GitHub repo with real backlog or an inbox with thousands of unread. You have none ready. You *could* stage one, but the rubric caps staged surfaces at L3 on the 20x root parameter. A repo filled with issues this morning reads as staged. The Newsroom's inputs are public RSS feeds, and outputs go to a Telegram channel and CF Pages site you create fresh — that's a real public surface, not a sandbox.

### Four Weaknesses to Engineer Out

#### 1. Make the Editor a Real Manager (Org Structure → L4-L5, +15-20 pts)

A fixed pipeline (monitor → editor → writer → judge → publisher) scores L3 = 10pts. Instead:

- Have the editor read the day's stories and **plan each edition differently**
- Spawn **beat reporters on the fly** (e.g., a markets reporter only when there's market news, a tech reporter when there's tech news)
- **Bounce a weak draft back** to the writer with revision notes
- A mentor comparing two run traces should see two different plans and at least one rejected draft → L4 (15pts)
- Spawning roles mid-run argues for L5 (20pts)

#### 2. Shorten the Cadence for Overflow (+40-60 pts)

Overflow on the root pays **20 points per additional edition** shipping autonomously during judging. An edition every 3 hours = maybe one during judging.

**Fix:** Run editions every **30-45 minutes** in the afternoon. Add a **breaking news flash** when the monitor sees a big story. Keep bulletins short (~250 words, ~90 seconds of audio) so cost and latency stay low. Three editions landing while judges walk the floor = 40-60 extra points.

#### 3. Close the Evaluation Loop (→ L5, +5-10 pts)

The judge agent fact-checking every line against Linkup is your evaluation story. Go further:

- Every claim the judge blocks gets **written to Convex as a new eval case**
- **Tag prompts in git** (version-controlled)
- Show a small chart of the judge **pass rate rising across the day**
- The rubric names this exact pattern at L5 on a 5x parameter

#### 4. Build the Trace Tree in Convex (Observability → L4, +21 pts)

Observability is 7x — the second heaviest parameter. Don't just log. Build:

- Log every step with: agent name, parent step, tokens, cost
- Render a **simple tree per edition** with dollars on each node
- Add a **filter by agent**
- That's L4 = 21 points. Plain print statements are worth 0.

### Two Cheap Add-Ons

1. **QR code** for the Telegram channel + waitlist page on screen during demo and around your table all day. Channel joins and waitlist emails pay through cross-track bonus at half weight (up to 50pts).

2. **Wispr Flow** — dictate 500+ words during the event, screenshot the stats page. That's +25 for near-zero effort. With ElevenLabs, CF, Convex, Linkup, and Wispr you're at +125 without touching Dodo.

### Score Projection

| Component | Points |
|-----------|--------|
| Root parameter L5 | 80 |
| Overflow (3+ editions during judging) | 40-60 |
| Org structure L4-L5 | 15-20 |
| Observability L4 | 21 |
| Evaluation L4-L5 | 15-20 |
| Memory L4 | 6 |
| Cost, latency, UI | ~5 |
| **Base subtotal** | **~180-210** |
| Power-ups (5 partners) | +125 |
| Cross-track bonus (waitlist + channel joins) | up to +50 |
| **Total** | **~300+** |

300+ should contend for podium in this track.

### Tonight's Prep (Infra Only — This Is Not Pre-Building)

The handbook confirms: "Wiring up infra is not pre-building." The product itself gets built on the floor.

- [ ] Install Hermes, wire the Telegram gateway, confirm DM round-trip works
- [ ] Create Telegram bot + channel, note the tokens
- [ ] Redeem ElevenLabs coupon through their Discord
- [ ] Add Linkup credits with code HERMES
- [ ] Sign up for Wispr Flow through the promo link
- [ ] Create empty Convex and Cloudflare projects
- [ ] Test OpenAI credits are live, Hermes talks to the model
- [ ] Pick 4-5 RSS feeds, confirm each returns items (dead feed at H2 = wasted hour)
- [ ] **Test one ElevenLabs render with two voices trading lines** — voice quality is your single biggest risk

### Day-Of Changes to the Build Plan

| Original | Revised | Why |
|----------|---------|-----|
| Cron in H6 | **Cron in H4** | Unattended runs are your whole proof; every hour it runs adds timestamps |
| Fixed pipeline in H2 | **Dynamic editor in H2-H3** | Score L4-L5 org structure by spawning beat reporters and bouncing drafts |
| Backup recording in H8 | **Record backup in H7** | Give yourself buffer before the demo |

### Language Decision

Your handoff mentions Hindi bulletins in the demo script but an English writer agent in the build plan. **Pick one language before you start** and test the ElevenLabs voice for it specifically tonight.

- If Hindi voices sound good → Hindi bulletin = stronger stage moment for an Indian judging room
- If they sound flat → Ship English, don't look back

---

*Updated with Claude Code review · July 11, 2026*
*Generated by Hermes Agent (Podrick Azure) for chandamama · Good luck at the buildathon 🚀*
