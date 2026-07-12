// ---------------------------------------------------------------------------
// Google News RSS parsing, title normalization, and cluster extraction
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { CandidateCluster, ParsedRssItem } from "./types.js";

// Match " - SourceName" at the end of a title
const TRAILING_SOURCE_RE = /\s+-\s+[^-]+$/;

// Escape HTML entities in text
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// RSS parsing
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  processEntities: true,
  htmlEntities: true,
});

/**
 * Parse a Google News RSS XML string into an array of items.
 * Handles both top-stories (cluster) and topic (single-article) feed shapes
 * by returning the raw item data. Shape detection happens in extractCluster.
 */
export function parseRss(xml: string): ParsedRssItem[] {
  if (!xml || xml.trim().length === 0) {
    return [];
  }

  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    return []; // Malformed XML → empty
  }

  const channel = parsed?.rss?.channel;
  if (!channel) return [];

  const items = channel.item;
  if (!items) return [];

  // RSS may have a single item as an object instead of an array
  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray
    .filter((item: any) => item?.title)
    .map((item: any) => ({
      title: String(item.title ?? ""),
      link: String(item.link ?? ""),
      description: String(item.description ?? ""),
      guid: item.guid ? String(item.guid["#text"] ?? item.guid) : undefined,
      pubDate: item.pubDate ? String(item.pubDate) : undefined,
    }));
}

// ---------------------------------------------------------------------------
// Title normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a news title for deduplication:
 * 1. Strip trailing source suffix (" - The Hindu")
 * 2. Lowercase
 * 3. Remove non-alphanumeric+space characters
 * 4. Collapse whitespace
 * 5. Unicode NFC normalization
 */
export function normalizeTitle(title: string): string {
  let t = title;
  // Strip trailing source suffix
  t = t.replace(TRAILING_SOURCE_RE, "");
  // Unicode normalization
  t = t.normalize("NFC");
  // Lowercase
  t = t.toLowerCase();
  // Remove non-alphanumeric+space characters
  t = t.replace(/[^a-z0-9\s]/g, "");
  // Collapse whitespace
  t = t.replace(/\s+/g, " ");
  // Trim
  t = t.trim();
  return t;
}

/**
 * Hash a normalized title using SHA-256.
 */
export function hashTitle(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

// ---------------------------------------------------------------------------
// Description anchor parsing
// ---------------------------------------------------------------------------

/**
 * Extract anchor texts from an HTML description string.
 * Returns an array of { text: string, href: string }.
 */
export function extractAnchors(html: string): { text: string; href: string }[] {
  // First unescape HTML entities that may be in the description
  const decoded = unescapeHtml(html);

  const anchors: { text: string; href: string }[] = [];
  const regex = /<a[^>]*href=["']([^"']*)["'][^>]*>\s*(.*?)\s*<\/a>/gi;

  let match;
  while ((match = regex.exec(decoded)) !== null) {
    const href = match[1];
    // Strip any inner HTML from the anchor text
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    if (text.length > 0) {
      anchors.push({ text, href });
    }
  }

  return anchors;
}

/**
 * Extract outlet/source names from text that follows anchors.
 * Google News descriptions often have patterns like:
 *   <a>Headline</a>&nbsp;<font>Outlet Name</font>
 * or simply outlet names appearing after anchor clusters.
 */
export function extractOutletNames(html: string): string[] {
  const decoded = unescapeHtml(html);

  // Match text between </a> and the next <a> or end of string that looks like an outlet
  // Also try to catch <font> elements containing outlet names
  const fontMatches = decoded.match(
    /<font[^>]*>([^<]+)<\/font>/gi
  );
  if (fontMatches) {
    return fontMatches
      .map((fm) => fm.replace(/<[^>]*>/g, "").trim())
      .filter((n) => n.length > 0 && n.length < 50);
  }

  // Fallback: extract text nodes after </a> tags
  const afterAnchors = decoded.split(/<\/a>/);
  const names: string[] = [];
  for (let i = 0; i < afterAnchors.length - 1; i++) {
    const rest = afterAnchors[i + 1];
    const textMatch = rest.match(/^([^<]*)/);
    if (textMatch) {
      const text = textMatch[1].trim();
      // Filter out common separators and empty strings
      if (
        text.length > 0 &&
        text.length < 50 &&
        !/^(,|&|·|\||-|•|·|and|&amp;|&nbsp;|\s)+$/i.test(text)
      ) {
        names.push(text);
      }
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Cluster extraction
// ---------------------------------------------------------------------------

/**
 * Extract a CandidateCluster from a parsed RSS item.
 *
 * For top-stories feeds: parses anchor texts from the description as
 * alternate headlines with outlet names.
 * For topic/search feeds: treats the item as a cluster of one.
 */
export function extractCluster(
  item: ParsedRssItem,
  beat: string,
  feedUrl: string,
  retrievedAt: number
): CandidateCluster {
  const anchors = extractAnchors(item.description);

  let leadTitle: string;
  let alternateHeadlines: string[];
  let outletNames: string[];

  if (anchors.length >= 2) {
    // Multi-anchor description → top-stories style cluster
    leadTitle = anchors[0].text;
    alternateHeadlines = anchors.slice(1).map((a) => a.text);
    outletNames = extractOutletNames(item.description);
  } else if (anchors.length === 1) {
    // Single anchor → use item title as lead, anchor as alternate
    leadTitle = item.title;
    alternateHeadlines = [anchors[0].text];
    outletNames = extractOutletNames(item.description);
  } else {
    // No anchors → single-article shape (topic/search feed)
    leadTitle = item.title;
    alternateHeadlines = [];
    outletNames = [];
  }

  // Ensure we never have zero outlet names from a top feed
  if (outletNames.length === 0 && anchors.length > 0) {
    // Use the hostname from anchor hrefs as a fallback
    const hostnames = new Set<string>();
    for (const a of anchors) {
      try {
        const u = new URL(a.href);
        hostnames.add(u.hostname.replace(/^www\./, ""));
      } catch {
        // ignore invalid URLs
      }
    }
    outletNames = Array.from(hostnames);
  }

  const normalizedTitle = normalizeTitle(leadTitle);
  const titleHash = hashTitle(normalizedTitle);

  // Parse pubDate if available
  let publishedAt: number | undefined;
  if (item.pubDate) {
    const parsed = Date.parse(item.pubDate);
    if (!isNaN(parsed)) {
      publishedAt = parsed;
    }
  }

  return {
    titleHash,
    leadTitle,
    normalizedTitle,
    alternateHeadlines,
    outletNames,
    outletCount: outletNames.length,
    beat,
    language: "en",
    country: "IN",
    publishedAt,
    // Receipt fields
    feedUrl,
    googleNewsUrl: item.link,
    rssGuid: item.guid,
    rssPublishedAt: publishedAt,
    rssTitle: item.title,
    rssDescriptionText: item.description || undefined,
    retrievedAt,
  };
}

// ---------------------------------------------------------------------------
// Dedup helpers
// ---------------------------------------------------------------------------

/**
 * Build a dedup map from candidate clusters. When two clusters have the same
 * titleHash, they are merged (outlets and headlines merged, beats unioned).
 * Returns a map of titleHash → merged CandidateCluster.
 */
export function deduplicateClusters(
  candidates: CandidateCluster[]
): Map<string, CandidateCluster> {
  const map = new Map<string, CandidateCluster>();

  for (const c of candidates) {
    const existing = map.get(c.titleHash);
    if (existing) {
      // Merge
      existing.alternateHeadlines = Array.from(
        new Set([...existing.alternateHeadlines, ...c.alternateHeadlines])
      );
      existing.outletNames = Array.from(
        new Set([...existing.outletNames, ...c.outletNames])
      );
      existing.outletCount = existing.outletNames.length;
      // Keep the earliest retrievedAt
      if (c.retrievedAt < existing.retrievedAt) {
        existing.googleNewsUrl = c.googleNewsUrl;
        existing.rssGuid = c.rssGuid;
        existing.rssPublishedAt = c.rssPublishedAt;
        existing.rssTitle = c.rssTitle;
        existing.rssDescriptionText = c.rssDescriptionText;
        existing.retrievedAt = c.retrievedAt;
        existing.feedUrl = c.feedUrl;
        existing.beat = c.beat;
      }
    } else {
      map.set(c.titleHash, c);
    }
  }

  return map;
}
