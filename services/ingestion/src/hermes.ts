// ---------------------------------------------------------------------------
// Hermes API client — OpenAI-compatible chat/completions
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { HermesCallResult, HermesResponse, StoryBundle } from "./types.js";

// ---------------------------------------------------------------------------
// Enricher system prompt (verbatim from spec)
// ---------------------------------------------------------------------------
export const SYSTEM_PROMPT = `You are a news content enricher. You receive one story: a lead headline,
alternate headlines from other outlets, outlet names, and a Google News
discovery link.

0. Before reading or searching, check your long-term memory for previously
   enriched newsroom runs. Compare this story's lead headline, alternate
   headlines, source URLs, and key entities against remembered articles. If you
   find that this is a duplicate or near-duplicate of a story already processed,
   do not process the article again. Return duplicate: true, duplicateOf with
   the remembered title/URL/run if available, duplicateReason explaining the
   match, summaryBullets: [], confidence: 1, and sources: [].
1. If it is not a duplicate, try to read the article at the link. If it
   redirects, follow it. If it fails, is paywalled, or shows a consent page,
   search the web for the headline instead and read one public article covering
   the same story.
2. Never bypass a paywall, login, or anti-bot protection.
3. Output ONLY a JSON object matching the schema you have been given. No
   prose, no markdown fences.
4. Every fact in summaryBullets must come from what you read. If you could
   not read enough, return summaryBullets: [] and confidence: 0.
5. After a non-duplicate enrichment, store a concise memory of this run for
   future duplicate checks: normalized title, canonical/source URL, key named
   entities, 2-3 core facts, suggested beat, timestamp, and that it was
   processed by the Overnight Newsroom enricher.`;

// ---------------------------------------------------------------------------
// Zod schema for Hermes response validation
// ---------------------------------------------------------------------------
const ContentKindSchema = z.enum([
  "article_text",
  "snippet",
  "search_result",
  "rss_description",
  "other",
]);

const HermesSourceSchema = z
  .object({
    sourceName: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    accessed: z.boolean().optional(),
    accessedAt: z.string().optional(),
    notes: z.string().optional(),
    content: z.string().optional(),
    contentKind: ContentKindSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .transform((source) => ({
    sourceName: source.sourceName ?? source.name ?? source.title ?? "Unknown source",
    url: source.url ?? "",
    accessed: source.accessed ?? false,
    accessedAt: source.accessedAt ?? new Date().toISOString(),
    notes: source.notes ?? "",
    content: source.content ?? "",
    contentKind: source.contentKind ?? "other",
    confidence: source.confidence ?? 0,
  }));

export const HermesResponseSchema = z
  .object({
    duplicate: z.boolean().default(false),
    duplicateOf: z.string().optional().default(""),
    duplicateReason: z.string().optional().default(""),
    summaryBullets: z.array(z.string()).default([]),
    whyItMatters: z.string().default(""),
    suggestedBeat: z.string().default("general"),
    confidence: z.number().min(0).max(1).default(0),
    missingContext: z
      .union([z.array(z.string()), z.string()])
      .default([])
      .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
    sources: z.array(HermesSourceSchema).default([]),
  })
  .transform((response) => ({
    ...response,
    sources: response.duplicate
      ? []
      : response.sources.filter((source) => source.url || source.content || source.notes),
  }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences from a string that might contain a JSON block.
 */
function stripMarkdownFences(text: string): string {
  let t = text.trim();
  // Strip ```json ... ``` fences
  t = t.replace(/^```(?:json)?\s*\n?/i, "");
  t = t.replace(/\n?```\s*$/, "");
  return t.trim();
}

function redactPotentialSecrets(text: string): string {
  return text
    .replace(/(api key:\s*)\*{0,8}[A-Za-z0-9_-]+/gi, "$1<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>")
    .replace(/[A-Za-z0-9_-]{24,}/g, "<redacted>");
}

function extractJsonObject(text: string): string {
  const stripped = stripMarkdownFences(text);
  const firstBrace = stripped.indexOf("{");
  if (firstBrace < 0) return stripped;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < stripped.length; i++) {
    const char = stripped[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return stripped.slice(firstBrace, i + 1);
    }
  }

  return stripped.slice(firstBrace);
}

function parseHermesJson(rawContent: string): HermesResponse {
  return HermesResponseSchema.parse(JSON.parse(extractJsonObject(rawContent)));
}

/**
 * Build the story bundle JSON that gets sent as the user message.
 */
export function buildUserMessage(bundle: StoryBundle): string {
  return JSON.stringify({
    ...bundle,
    memoryDirective: {
      checkBeforeProcessing: true,
      skipIfDuplicate: true,
      storeAfterNonDuplicate: true,
      duplicateResponseShape: {
        duplicate: true,
        duplicateOf: "remembered title, URL, or run id if available",
        duplicateReason: "why this matches memory",
        summaryBullets: [],
        confidence: 1,
        sources: [],
      },
    },
  });
}

// ---------------------------------------------------------------------------
// LLM call — OpenAI by default, Hermes fallback via LLM_PROVIDER env
// ---------------------------------------------------------------------------

export async function callHermes(
  bundle: StoryBundle
): Promise<HermesCallResult> {
  const provider = process.env.LLM_PROVIDER || "openai";
  const baseUrl =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : process.env.HERMES_BASE_URL || "http://localhost:8642/v1";
  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY || ""
      : process.env.HERMES_API_KEY || "";
  const model =
    provider === "openai"
      ? process.env.LLM_MODEL || "gpt-5.5"
      : process.env.HERMES_MODEL || "hermes-agent";
  const useMaxCompletionTokens = provider === "openai";
  const timeoutMs = Number(
    process.env.LLM_TIMEOUT_MS || process.env.HERMES_TIMEOUT_MS || "120000"
  );

  const userMessage = buildUserMessage(bundle);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(timeoutMs, 1000)
  );

  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...(useMaxCompletionTokens
          ? { max_completion_tokens: 450 }
          : { temperature: 0.2, max_tokens: 450 }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await res.json();

    // Extract usage if present
    const usage = body.usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined;

    // Parse the response content
    let rawContent = "";
    try {
      rawContent =
        body.choices?.[0]?.message?.content || JSON.stringify(body);
    } catch {
      rawContent = JSON.stringify(body);
    }

    if (!res.ok || body?.hermes?.failed === true || body?.choices?.[0]?.finish_reason === "error") {
      return {
        status: "failed",
        latencyMs,
        httpStatus: res.status,
        usage,
        error: redactPotentialSecrets(rawContent || JSON.stringify(body)).slice(0, 500),
      };
    }

    // Attempt to parse and normalize JSON. Hermes sometimes returns fenced JSON,
    // a prose prefix, string missingContext, or source title/name instead of
    // sourceName; normalize those variants here.
    let parsed: HermesResponse;
    try {
      parsed = parseHermesJson(rawContent);
    } catch (parseError) {
      return {
        status: "parse_error",
        latencyMs,
        httpStatus: res.status,
        error: `Failed to parse Hermes response as JSON: ${redactPotentialSecrets(rawContent).slice(0, 200)} (${parseError instanceof Error ? parseError.message : "unknown parse error"})`,
      };
    }

    // Check confidence threshold
    if (parsed.confidence < 0.3) {
      // Push as success but caller should check and call markThin
      return {
        status: "success",
        latencyMs,
        httpStatus: res.status,
        response: parsed,
        usage,
      };
    }

    return {
      status: "success",
      latencyMs,
      httpStatus: res.status,
      response: parsed,
      usage,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (err?.name === "AbortError") {
      return {
        status: "timeout",
        latencyMs,
        error: `Hermes call timed out after ${timeoutMs}ms`,
      };
    }

    return {
      status: "failed",
      latencyMs,
      error: redactPotentialSecrets(err?.message || String(err)),
    };
  }
}
