// ---------------------------------------------------------------------------
// Shared types for the OCI ingestion service
// ---------------------------------------------------------------------------

export interface FeedConfig {
  url: string;
  beat: string;
}

export interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  guid?: string;
  pubDate?: string;
}

export interface CandidateCluster {
  titleHash: string;
  leadTitle: string;
  normalizedTitle: string;
  alternateHeadlines: string[];
  outletNames: string[];
  outletCount: number;
  beat: string;
  language: string;
  country: string;
  publishedAt?: number;
  // Receipt fields
  feedUrl: string;
  googleNewsUrl: string;
  rssGuid?: string;
  rssPublishedAt?: number;
  rssTitle: string;
  rssDescriptionText?: string;
  retrievedAt: number;
}

export interface StoryBundle {
  leadTitle: string;
  alternateHeadlines: string[];
  outletNames: string[];
  googleNewsUrl: string;
  beats: string[];
}

export interface HermesSource {
  sourceName: string;
  url: string;
  accessed: boolean;
  accessedAt: string;
  notes: string;
  content: string;
  contentKind: "article_text" | "snippet" | "search_result" | "rss_description" | "other";
  confidence: number;
}

export interface HermesResponse {
  summaryBullets: string[];
  whyItMatters: string;
  suggestedBeat: string;
  confidence: number;
  missingContext: string[];
  sources: HermesSource[];
}

export interface HermesCallResult {
  status: "success" | "timeout" | "parse_error" | "failed";
  latencyMs: number;
  httpStatus?: number;
  response?: HermesResponse;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  usageSource: "provider" | "estimated" | "none";
  estimatedCostCents: number;
}

export type FeedFetchOutcome =
  | {
      status: "ok";
      feed: FeedConfig;
      httpCode: number;
      byteCount: number;
      latencyMs: number;
      itemCount: number;
      candidates: CandidateCluster[];
    }
  | {
      status: "error";
      feed: FeedConfig;
      error: string;
      errorClass: string;
      latencyMs: number;
      httpCode?: number;
    };

export interface IngestionRunAggregate {
  feedsSucceeded: number;
  feedsFailed: number;
  itemsSeen: number;
  clustersCreated: number;
  clustersUpdated: number;
  duplicatesSkipped: number;
}
