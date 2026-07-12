// ---------------------------------------------------------------------------
// Unit tests for Google News RSS parsing, title normalization, dedup,
// Hermes response parsing, and cost estimation.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  parseRss,
  normalizeTitle,
  hashTitle,
  extractAnchors,
  extractOutletNames,
  extractCluster,
  deduplicateClusters,
} from "../src/googleNews.js";
import { HermesResponseSchema } from "../src/hermes.js";
import { estimateTokens, computeCostCents, buildCostEstimate } from "../src/cost.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  return readFileSync(
    join(__dirname, "fixtures", name),
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// RSS parsing
// ---------------------------------------------------------------------------

describe("parseRss", () => {
  it("parses a top-stories feed with multi-anchor descriptions", () => {
    const xml = loadFixture("top-stories.xml");
    const items = parseRss(xml);

    expect(items).toHaveLength(3);
    expect(items[0].title).toContain("PM Modi");
    expect(items[0].link).toContain("news.google.com");
    expect(items[0].description).toContain("The Hindu");
    expect(items[0].pubDate).toBeDefined();
  });

  it("parses a topic feed with single-article items", () => {
    const xml = loadFixture("topic-feed.xml");
    const items = parseRss(xml);

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("RBI keeps repo rate unchanged at 6.5%");
    expect(items[0].description).toBe(
      "RBI holds rates steady for fourth consecutive meeting"
    );
  });

  it("handles empty input gracefully", () => {
    expect(parseRss("")).toEqual([]);
  });

  it("returns empty array for malformed XML", () => {
    const items = parseRss("<not><valid>xml");
    expect(items).toEqual([]);
  });

  it("parses items with missing optional fields", () => {
    const items = parseRss(loadFixture("topic-feed.xml"));
    // Third item has no pubDate
    expect(items[2].pubDate).toBeUndefined();
    expect(items[2].title).toBe(
      "Budget 2026 expectations: What industry wants"
    );
  });

  it("returns empty array for null input", () => {
    expect(parseRss(null as unknown as string)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Title normalization
// ---------------------------------------------------------------------------

describe("normalizeTitle", () => {
  it("strips trailing source suffix", () => {
    const result = normalizeTitle(
      "PM Modi addresses nation on economic reforms - The Hindu"
    );
    expect(result).toBe("pm modi addresses nation on economic reforms");
  });

  it("strips trailing source with hyphenated outlet name", () => {
    const result = normalizeTitle(
      "India vs Australia Test match day 3 highlights - ESPN Cricinfo"
    );
    expect(result).toBe(
      "india vs australia test match day 3 highlights"
    );
  });

  it("lowercases the title", () => {
    const result = normalizeTitle("BREAKING NEWS: Market Rally");
    expect(result).toBe("breaking news market rally");
  });

  it("removes non-alphanumeric characters", () => {
    const result = normalizeTitle(" PM's 'special' announcement! ");
    expect(result).toBe("pms special announcement");
  });

  it("collapses whitespace", () => {
    const result = normalizeTitle("  RBI    keeps   rate   unchanged  ");
    expect(result).toBe("rbi keeps rate unchanged");
  });

  it("handles empty title", () => {
    const result = normalizeTitle("");
    expect(result).toBe("");
  });

  it("handles title that is only a source suffix", () => {
    // e.g., title is just "- The Hindu"
    const result = normalizeTitle(" - The Hindu");
    // Stripping suffix should leave empty, normalization yields empty
    expect(result).toBe("");
  });

  it("normalizes Unicode to NFC before stripping non-ASCII", () => {
    // NFD form of "café" — two code points for é
    // After normalizeTitle: NFC → "café report" → lowercase → strip non-[a-z0-9\s]
    // The accented 'é' is stripped, yielding "caf report"
    const nfd = "cafe\u0301 report";
    const result = normalizeTitle(nfd);
    // Same as NFC-normalized then stripped
    expect(result).toBe("caf report");
  });
});

// ---------------------------------------------------------------------------
// Title hashing
// ---------------------------------------------------------------------------

describe("hashTitle", () => {
  it("produces consistent SHA-256 hashes", () => {
    const h1 = hashTitle("test title");
    const h2 = hashTitle("test title");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it("different titles produce different hashes", () => {
    const h1 = hashTitle("title one");
    const h2 = hashTitle("title two");
    expect(h1).not.toBe(h2);
  });

  it("normalized then hashed produces consistent results", () => {
    const title1 = "PM Modi addresses nation - The Hindu";
    const title2 = "pm modi addresses nation";
    const hash1 = hashTitle(normalizeTitle(title1));
    const hash2 = hashTitle(normalizeTitle(title2));
    expect(hash1).toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// Description anchor parsing (top-stories feed)
// ---------------------------------------------------------------------------

describe("extractAnchors", () => {
  it("extracts anchor texts and hrefs from description HTML", () => {
    const items = parseRss(loadFixture("top-stories.xml"));
    const anchors = extractAnchors(items[0].description);

    expect(anchors.length).toBeGreaterThanOrEqual(3);
    expect(anchors[0].text).toContain("PM Modi");
    expect(anchors[0].href).toContain("news.google.com");
  });

  it("returns empty array for non-HTML description", () => {
    const items = parseRss(loadFixture("topic-feed.xml"));
    const anchors = extractAnchors(items[0].description);
    expect(anchors).toEqual([]);
  });

  it("handles empty string", () => {
    const anchors = extractAnchors("");
    expect(anchors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Outlet name extraction
// ---------------------------------------------------------------------------

describe("extractOutletNames", () => {
  it("extracts outlet names from font tags in top-stories description", () => {
    const items = parseRss(loadFixture("top-stories.xml"));
    const names = extractOutletNames(items[0].description);

    expect(names).toContain("The Hindu");
    expect(names).toContain("Times of India");
    expect(names).toContain("NDTV");
  });

  it("returns empty array for non-cluster description", () => {
    const items = parseRss(loadFixture("topic-feed.xml"));
    const names = extractOutletNames(items[0].description);
    expect(names).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cluster extraction
// ---------------------------------------------------------------------------

describe("extractCluster", () => {
  const feedUrl = "https://news.google.com/rss?hl=en-IN";
  const now = Date.now();

  it("extracts a multi-outlet cluster from top-stories item", () => {
    const items = parseRss(loadFixture("top-stories.xml"));
    const cluster = extractCluster(items[0], "top", feedUrl, now);

    expect(cluster.leadTitle).toContain("PM Modi addresses");
    expect(cluster.alternateHeadlines.length).toBeGreaterThanOrEqual(2);
    expect(cluster.outletNames.length).toBeGreaterThanOrEqual(2);
    expect(cluster.beat).toBe("top");
    expect(cluster.language).toBe("en");
    expect(cluster.country).toBe("IN");
    expect(cluster.titleHash).toHaveLength(64);
    expect(cluster.googleNewsUrl).toContain("news.google.com");
    expect(cluster.retrievedAt).toBe(now);
  });

  it("extracts a cluster-of-one from topic feed item", () => {
    const items = parseRss(loadFixture("topic-feed.xml"));
    const cluster = extractCluster(items[0], "business", feedUrl, now);

    expect(cluster.leadTitle).toBe(
      "RBI keeps repo rate unchanged at 6.5%"
    );
    expect(cluster.alternateHeadlines).toEqual([]);
    expect(cluster.outletNames).toEqual([]);
    expect(cluster.outletCount).toBe(0);
    expect(cluster.beat).toBe("business");
  });

  it("parses pubDate into a timestamp", () => {
    const items = parseRss(loadFixture("top-stories.xml"));
    const cluster = extractCluster(items[0], "top", feedUrl, now);

    expect(cluster.publishedAt).toBeGreaterThan(0);
    expect(cluster.rssPublishedAt).toBe(cluster.publishedAt);
  });

  it("handles item with no pubDate", () => {
    const items = parseRss(loadFixture("topic-feed.xml"));
    const cluster = extractCluster(items[2], "business", feedUrl, now);

    expect(cluster.publishedAt).toBeUndefined();
  });

  it("generates consistent titleHash for same normalized title", () => {
    const items = parseRss(loadFixture("top-stories.xml"));

    // Item 0 has lead title "PM Modi addresses nation on economic reforms" (anchor text)
    // But extractCluster uses anchor text as lead in multi-anchor context
    const cluster1 = extractCluster(items[0], "top", feedUrl, now);

    // Create a synthetic item with the same normalized title
    const hash2 = hashTitle(cluster1.normalizedTitle);
    expect(cluster1.titleHash).toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

describe("deduplicateClusters", () => {
  const base = {
    feedUrl: "https://example.com/feed",
    retrievedAt: Date.now(),
    language: "en",
    country: "IN",
  };

  it("merges duplicate titleHash clusters", () => {
    const title1 = "Test headline - The Hindu";
    const title2 = "Test headline - NDTV";
    const hash = hashTitle(normalizeTitle(title1));

    const candidates = [
      {
        ...base,
        titleHash: hash,
        leadTitle: title1,
        normalizedTitle: normalizeTitle(title1),
        alternateHeadlines: ["alt1"],
        outletNames: ["The Hindu"],
        outletCount: 1,
        beat: "top",
        googleNewsUrl: "https://news.google.com/1",
        rssTitle: title1,
      },
      {
        ...base,
        titleHash: hash,
        leadTitle: title2,
        normalizedTitle: normalizeTitle(title2),
        alternateHeadlines: ["alt2"],
        outletNames: ["NDTV"],
        outletCount: 1,
        beat: "nation",
        googleNewsUrl: "https://news.google.com/2",
        rssTitle: title2,
      },
    ];

    const deduped = deduplicateClusters(candidates);
    expect(deduped.size).toBe(1);

    const merged = deduped.get(hash)!;
    expect(merged.outletNames).toContain("The Hindu");
    expect(merged.outletNames).toContain("NDTV");
    expect(merged.outletCount).toBe(2);
    expect(merged.alternateHeadlines).toContain("alt1");
    expect(merged.alternateHeadlines).toContain("alt2");
  });

  it("preserves unique clusters", () => {
    const h1 = hashTitle("unique title one");
    const h2 = hashTitle("unique title two");

    const candidates = [
      {
        ...base,
        titleHash: h1,
        leadTitle: "unique title one",
        normalizedTitle: "unique title one",
        alternateHeadlines: [],
        outletNames: ["Outlet A"],
        outletCount: 1,
        beat: "top",
        googleNewsUrl: "https://news.google.com/1",
        rssTitle: "unique title one",
      },
      {
        ...base,
        titleHash: h2,
        leadTitle: "unique title two",
        normalizedTitle: "unique title two",
        alternateHeadlines: [],
        outletNames: ["Outlet B"],
        outletCount: 1,
        beat: "business",
        googleNewsUrl: "https://news.google.com/2",
        rssTitle: "unique title two",
      },
    ];

    const deduped = deduplicateClusters(candidates);
    expect(deduped.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Hermes response parsing (Zod validation)
// ---------------------------------------------------------------------------

describe("HermesResponseSchema", () => {
  it("parses a valid Hermes response", () => {
    const valid = {
      summaryBullets: [
        "RBI kept repo rate unchanged at 6.5%",
        "This marks the fourth consecutive hold",
      ],
      whyItMatters:
        "Monetary policy stability signals confidence in growth trajectory",
      suggestedBeat: "business",
      confidence: 0.85,
      missingContext: ["Inflation outlook for next quarter remains unclear"],
      sources: [
        {
          sourceName: "The Hindu",
          url: "https://example.com/story",
          accessed: true,
          accessedAt: "2026-07-12T06:30:00.000Z",
          notes: "Public page accessible",
          content: "Full article text here",
          contentKind: "article_text",
          confidence: 0.9,
        },
      ],
    };

    const parsed = HermesResponseSchema.parse(valid);
    expect(parsed.confidence).toBe(0.85);
    expect(parsed.summaryBullets).toHaveLength(2);
    expect(parsed.sources[0].sourceName).toBe("The Hindu");
  });

  it("normalizes partial Hermes responses with safe defaults", () => {
    const partial = {
      summaryBullets: [],
      // Hermes can omit optional metadata in degraded responses.
    };
    const parsed = HermesResponseSchema.parse(partial);
    expect(parsed.whyItMatters).toBe("");
    expect(parsed.suggestedBeat).toBe("general");
    expect(parsed.confidence).toBe(0);
    expect(parsed.missingContext).toEqual([]);
    expect(parsed.sources).toEqual([]);
  });

  it("rejects confidence outside [0,1]", () => {
    const invalid = {
      summaryBullets: ["test"],
      whyItMatters: "test",
      suggestedBeat: "general",
      confidence: 1.5,
      missingContext: [],
      sources: [],
    };
    expect(() => HermesResponseSchema.parse(invalid)).toThrow();
  });

  it("accepts response with empty summaryBullets and confidence 0", () => {
    // "could not read enough" case from spec
    const thin = {
      summaryBullets: [],
      whyItMatters: "Unable to access article content",
      suggestedBeat: "general",
      confidence: 0,
      missingContext: ["Paywall prevented access"],
      sources: [],
    };
    const parsed = HermesResponseSchema.parse(thin);
    expect(parsed.summaryBullets).toEqual([]);
    expect(parsed.confidence).toBe(0);
  });

  it("rejects confidence as string", () => {
    const invalid = {
      summaryBullets: ["test"],
      whyItMatters: "test",
      suggestedBeat: "general",
      confidence: "0.85",
      missingContext: [],
      sources: [],
    };
    expect(() => HermesResponseSchema.parse(invalid)).toThrow();
  });

  it("accepts valid contentKind values", () => {
    const valid = {
      summaryBullets: ["test"],
      whyItMatters: "test",
      suggestedBeat: "general",
      confidence: 0.5,
      missingContext: [],
      sources: [
        {
          sourceName: "Test",
          url: "https://test.com",
          accessed: true,
          accessedAt: "2026-07-12T06:30:00.000Z",
          notes: "test",
          content: "test",
          contentKind: "search_result",
          confidence: 0.5,
        },
      ],
    };
    const parsed = HermesResponseSchema.parse(valid);
    expect(parsed.sources[0].contentKind).toBe("search_result");
  });

  it("accepts duplicate responses from Hermes memory checks", () => {
    const duplicate = {
      duplicate: true,
      duplicateOf: "https://example.com/previous-story",
      duplicateReason: "Same canonical URL and headline found in memory",
      summaryBullets: [],
      confidence: 1,
      sources: [
        {
          sourceName: "Should be ignored for duplicate",
          url: "https://example.com/current-story",
        },
      ],
    };
    const parsed = HermesResponseSchema.parse(duplicate);
    expect(parsed.duplicate).toBe(true);
    expect(parsed.duplicateOf).toContain("previous-story");
    expect(parsed.sources).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  it("estimates tokens using chars/4 heuristic", () => {
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens("a".repeat(100))).toBe(25); // 100 / 4 = 25
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns positive integer for single char", () => {
    expect(estimateTokens("a")).toBe(1);
  });
});

describe("computeCostCents", () => {
  it("computes fractional cents for observability", () => {
    const cents = computeCostCents(1000, 500, 15, 60);
    // (1000/1M)*15 + (500/1M)*60 = 0.045 USD = 4.5 cents
    expect(cents).toBe(4.5);
  });

  it("preserves sub-cent costs", () => {
    const cents = computeCostCents(100, 100, 15, 60);
    // (100/1M)*15 + (100/1M)*60 = 0.0075 USD = 0.75 cents
    expect(cents).toBe(0.75);
  });

  it("returns 0 for zero tokens", () => {
    expect(computeCostCents(0, 0, 15, 60)).toBe(0);
  });

  it("returns 0 for zero rates", () => {
    expect(computeCostCents(1000, 500, 0, 0)).toBe(0);
  });
});

describe("buildCostEstimate", () => {
  it("uses provider tokens when available", () => {
    const estimate = buildCostEstimate(
      { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      "prompt text here",
      "response text here"
    );

    expect(estimate.inputTokens).toBe(200);
    expect(estimate.outputTokens).toBe(100);
    expect(estimate.totalTokens).toBe(300);
    expect(estimate.usageSource).toBe("provider");
  });

  it("falls back to estimation when no usage block", () => {
    const promptText = "short prompt";
    const responseText = "short response";
    const estimate = buildCostEstimate(
      undefined,
      promptText,
      responseText
    );

    expect(estimate.usageSource).toBe("estimated");
    expect(estimate.inputTokens).toBe(estimateTokens(promptText));
    expect(estimate.outputTokens).toBe(estimateTokens(responseText));
  });

  it("falls back when usage has no prompt_tokens", () => {
    const estimate = buildCostEstimate(
      { total_tokens: 50 } as any,
      "prompt",
      "response"
    );
    expect(estimate.usageSource).toBe("estimated");
  });

  it("handles undefined usage gracefully", () => {
    const estimate = buildCostEstimate(
      undefined,
      "prompt",
      "response"
    );
    expect(estimate.usageSource).toBe("estimated");
    expect(estimate.estimatedCostCents).toBeGreaterThanOrEqual(0);
  });
});
