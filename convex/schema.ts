import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ingestionRuns: defineTable({
    runId: v.string(),
    trigger: v.union(v.literal("scheduled"), v.literal("manual")),
    serviceVersion: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("partial"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    feedCount: v.number(),
    feedsSucceeded: v.optional(v.number()),
    feedsFailed: v.optional(v.number()),
    itemsSeen: v.optional(v.number()),
    clustersCreated: v.optional(v.number()),
    clustersUpdated: v.optional(v.number()),
    duplicatesSkipped: v.optional(v.number()),
    errorSummary: v.optional(v.string()),
  })
    .index("by_startedAt", ["startedAt"])
    .index("by_status_startedAt", ["status", "startedAt"])
    .index("by_trigger_startedAt", ["trigger", "startedAt"]),

  storyClusters: defineTable({
    titleHash: v.string(),
    leadTitle: v.string(),
    normalizedTitle: v.string(),
    alternateHeadlines: v.array(v.string()),
    outletNames: v.array(v.string()),
    outletCount: v.number(),
    beats: v.array(v.string()),
    language: v.string(),
    country: v.string(),
    publishedAt: v.optional(v.number()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    status: v.union(
      v.literal("discovered"),
      v.literal("summarized"),
      v.literal("thin"),
      v.literal("selected"),
      v.literal("aired"),
      v.literal("suppressed")
    ),
    summaryStatus: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("summarized"),
      v.literal("thin"),
      v.literal("failed"),
      v.literal("duplicate")
    ),
    claimedAt: v.optional(v.number()),
    summaryBullets: v.optional(v.array(v.string())),
    whyItMatters: v.optional(v.string()),
    summaryConfidence: v.optional(v.number()),
    missingContext: v.optional(v.array(v.string())),
    summaryPromptVersion: v.optional(v.string()),
    latestHermesCallId: v.optional(v.string()),
    canonicalPublisherUrl: v.optional(v.string()),
    extractionConfidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // NOTE: Compound indexes in Convex are NOT unique.
    // Application-level upsert: query by titleHash+language, update if exists.
    .index("by_titleHash_language", ["titleHash", "language"])
    .index("by_status_lastSeenAt", ["status", "lastSeenAt"])
    .index("by_summaryStatus_lastSeenAt", ["summaryStatus", "lastSeenAt"])
    .index("by_language_lastSeenAt", ["language", "lastSeenAt"]),

  clusterReceipts: defineTable({
    clusterId: v.id("storyClusters"),
    runId: v.string(),
    feedUrl: v.string(),
    beat: v.string(),
    googleNewsUrl: v.string(),
    rssGuid: v.optional(v.string()),
    rssPublishedAt: v.optional(v.number()),
    rssTitle: v.string(),
    rssDescriptionText: v.optional(v.string()),
    outletNames: v.array(v.string()),
    retrievedAt: v.number(),
  })
    .index("by_clusterId_retrievedAt", ["clusterId", "retrievedAt"])
    .index("by_runId", ["runId"])
    .index("by_googleNewsUrl", ["googleNewsUrl"]),

  hermesCalls: defineTable({
    callId: v.string(),
    runId: v.optional(v.string()),
    clusterId: v.optional(v.id("storyClusters")),
    purpose: v.union(v.literal("rss_summary")),
    provider: v.union(v.literal("hermes_openai_compat")),
    baseUrlHost: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("parse_error"),
      v.literal("duplicate")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    httpStatus: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    usageSource: v.union(
      v.literal("provider"),
      v.literal("estimated"),
      v.literal("none")
    ),
    estimatedCostCents: v.optional(v.number()),
    requestSummary: v.string(),
    responseSummary: v.optional(v.string()),
    errorClass: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_clusterId_startedAt", ["clusterId", "startedAt"])
    .index("by_status_startedAt", ["status", "startedAt"])
    .index("by_model_startedAt", ["model", "startedAt"]),

  events: defineTable({
    eventId: v.string(),
    runId: v.optional(v.string()),
    clusterId: v.optional(v.id("storyClusters")),
    hermesCallId: v.optional(v.string()),
    family: v.union(
      v.literal("ingestion"),
      v.literal("enrichment"),
      v.literal("source"),
      v.literal("cost"),
      v.literal("health"),
      v.literal("exception")
    ),
    type: v.string(),
    severity: v.union(
      v.literal("debug"),
      v.literal("info"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    dataRedacted: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_runId_createdAt", ["runId", "createdAt"])
    .index("by_family_createdAt", ["family", "createdAt"])
    .index("by_severity_createdAt", ["severity", "createdAt"]),

  // ── Public read model ──────────────────────────────────────────

  editions: defineTable({
    editionKey: v.string(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"])
    .index("by_status_publishedAt", ["status", "publishedAt"])
    .index("by_createdAt", ["createdAt"]),

  editionStories: defineTable({
    editionId: v.id("editions"),
    clusterId: v.optional(v.id("storyClusters")),
    storyKey: v.string(),
    title: v.string(),
    summary: v.string(),
    summaryBullets: v.optional(v.array(v.string())),
    canonicalPublisherName: v.optional(v.string()),
    canonicalPublisherUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
    badges: v.optional(
      v.array(
        v.union(
          v.literal("new"),
          v.literal("developing"),
          v.literal("follow-up"),
          v.literal("breaking"),
          v.literal("correction")
        )
      )
    ),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionId_sortOrder", ["editionId", "sortOrder"])
    .index("by_storyKey", ["storyKey"]),

  publicationReceipts: defineTable({
    editionId: v.id("editions"),
    editionKey: v.string(),
    receiptType: v.union(
      v.literal("deploy"),
      v.literal("publish"),
      v.literal("media")
    ),
    receiptUrl: v.optional(v.string()),
    status: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_editionId", ["editionId"])
    .index("by_editionKey_receiptType", ["editionKey", "receiptType"]),

  // ── Newsroom organisation (ONR-004) ────────────────────────────

  editorialPlans: defineTable({
    planId: v.string(),
    editionKey: v.string(),
    editorialDirection: v.string(),
    sectionNames: v.array(v.string()),
    sectionDescriptions: v.array(v.string()),
    roleIds: v.array(v.string()),
    dormantBeats: v.array(v.string()),
    dormantRationale: v.string(),
    totalTokenBudget: v.number(),
    concurrencyLimit: v.number(),
    inputDigest: v.string(),
    rawHermesResponse: v.string(),
    costCents: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"])
    .index("by_createdAt", ["createdAt"]),

  roleSpecs: defineTable({
    planId: v.string(),
    editionKey: v.string(),
    roleId: v.string(),
    name: v.string(),
    rationale: v.string(),
    assignedClusterIds: v.array(v.string()),
    mission: v.string(),
    allowedTools: v.array(v.string()),
    guardrails: v.array(v.string()),
    successCriteria: v.array(v.string()),
    parentTrace: v.string(),
    tokenBudget: v.number(),
    timeBudgetMs: v.number(),
    wasNamed: v.boolean(),
    rawHermesResponse: v.string(),
    createdAt: v.number(),
  })
    .index("by_planId", ["planId"])
    .index("by_editionKey_roleId", ["editionKey", "roleId"]),

  workerResults: defineTable({
    editionKey: v.string(),
    resultId: v.string(),
    roleId: v.string(),
    title: v.string(),
    summary: v.string(),
    summaryBullets: v.array(v.string()),
    beat: v.string(),
    confidence: v.number(),
    sourceUrls: v.array(v.string()),
    sourceNames: v.array(v.string()),
    meetsCriteria: v.boolean(),
    selfAssessmentReasoning: v.string(),
    validationStatus: v.union(
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("repaired")
    ),
    validationErrors: v.array(v.string()),
    repairAttempted: v.boolean(),
    repairDetail: v.optional(v.string()),
    rawResponse: v.string(),
    tokensUsed: v.number(),
    estimatedCostCents: v.number(),
    latencyMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey_roleId", ["editionKey", "roleId"])
    .index("by_validationStatus", ["validationStatus"]),

  revisionLoops: defineTable({
    loopId: v.string(),
    editionKey: v.string(),
    roleId: v.string(),
    originalResultId: v.string(),
    revisedResultId: v.optional(v.string()),
    concerns: v.array(v.string()),
    suggestions: v.array(v.string()),
    severity: v.union(v.literal("required"), v.literal("optional")),
    disposition: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    round: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"])
    .index("by_disposition", ["disposition"]),

  newsroomMemory: defineTable({
    memoryId: v.string(),
    kind: v.union(
      v.literal("lesson"),
      v.literal("role_pattern"),
      v.literal("editorial_rule"),
      v.literal("guardrail")
    ),
    content: v.string(),
    tags: v.array(v.string()),
    provenance: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index("by_kind_createdAt", ["kind", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_provenance", ["provenance"]),

  // ── Evaluation (editorial + judge) ─────────────────────────────

  evalCases: defineTable({
    evalId: v.string(),
    category: v.union(
      v.literal("role-graph"),
      v.literal("novelty"),
      v.literal("dormancy"),
      v.literal("revision-loop"),
      v.literal("schema-validation"),
      v.literal("concurrency"),
      v.literal("budget"),
      v.literal("edge-case"),
      v.literal("assembly"),
      // judge categories (shared table for ONR-005 too)
      v.literal("unsupported"),
      v.literal("contradicted"),
      v.literal("stale"),
      v.literal("duplicate"),
      v.literal("supported"),
      v.literal("conflicting-sources"),
      v.literal("correction")
    ),
    description: v.string(),
    inputDigest: v.string(),
    expectedBehavior: v.string(),
    promptVersionAtCapture: v.string(),
    source: v.union(v.literal("seeded"), v.literal("captured")),
    provenanceEdition: v.optional(v.string()),
    provenanceRoleId: v.optional(v.string()),
    notes: v.string(),
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_source", ["source"])
    .index("by_provenanceEdition", ["provenanceEdition"]),

  evalRuns: defineTable({
    runId: v.string(),
    evalSet: v.string(),
    total: v.number(),
    passed: v.number(),
    failed: v.number(),
    passRate: v.number(),
    byCategoryJson: v.string(),
    promptVersion: v.string(),
    source: v.union(v.literal("manual"), v.literal("ci"), v.literal("pre-commit")),
    createdAt: v.number(),
  })
    .index("by_evalSet_createdAt", ["evalSet", "createdAt"]),

  // ── Mission Control traces (ONR-011) ───────────────────────────

  traceNodes: defineTable({
    editionKey: v.string(),
    nodeId: v.string(),
    parentNodeId: v.optional(v.string()),
    roleId: v.optional(v.string()),
    roleName: v.optional(v.string()),
    beat: v.optional(v.string()),
    assignment: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rejected"),
      v.literal("revised")
    ),
    kind: v.union(
      v.literal("agent_session"),
      v.literal("tool_step"),
      v.literal("manager_decision"),
      v.literal("judge_block")
    ),
    tokensUsed: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    evidence: v.optional(v.string()),
    artifacts: v.optional(v.array(v.string())),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_editionKey_nodeId", ["editionKey", "nodeId"])
    .index("by_editionKey_startedAt", ["editionKey", "startedAt"]),

  // ── Judge (ONR-005) ───────────────────────────────────────────

  claims: defineTable({
    claimId: v.string(),
    editionKey: v.string(),
    claim: v.string(),
    storyKey: v.string(),
    roleId: v.string(),
    sourceLines: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"])
    .index("by_storyKey", ["storyKey"]),

  verdicts: defineTable({
    claimId: v.string(),
    editionKey: v.string(),
    verdict: v.union(
      v.literal("approved"),
      v.literal("revise"),
      v.literal("block"),
      v.literal("escalate")
    ),
    reason: v.string(),
    evidenceJson: v.string(),
    receiptsCorroborated: v.boolean(),
    linkupCorroborated: v.boolean(),
    conflictDetail: v.optional(v.string()),
    confidence: v.number(),
    tokensUsed: v.number(),
    estimatedCostCents: v.number(),
    latencyMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"])
    .index("by_verdict", ["verdict"]),

  // ── Audio (ONR-006) ───────────────────────────────────────────

  audioSegments: defineTable({
    segmentId: v.string(),
    editionKey: v.string(),
    anchor: v.union(v.literal("A"), v.literal("B")),
    turnIndex: v.number(),
    text: v.string(),
    voiceId: v.string(),
    durationMs: v.number(),
    clipUrl: v.string(),
    costCents: v.number(),
    latencyMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey_turnIndex", ["editionKey", "turnIndex"]),

  editionAudio: defineTable({
    editionKey: v.string(),
    totalDurationMs: v.number(),
    fullAudioUrl: v.string(),
    chaptersJson: v.string(),
    segmentIds: v.array(v.string()),
    totalCostCents: v.number(),
    totalLatencyMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_editionKey", ["editionKey"]),
});
