// ---------------------------------------------------------------------------
// Token and cost estimation helpers
// ---------------------------------------------------------------------------

import type { CostEstimate } from "./types.js";

/**
 * Estimate token count from text using the rough heuristic:
 * 1 token ≈ 4 characters for English text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Compute estimated cost in cents from token counts and per-million-token rates.
 */
export function computeCostCents(
  inputTokens: number,
  outputTokens: number,
  inputRatePerM?: number,
  outputRatePerM?: number
): number {
  const provider = process.env.LLM_PROVIDER || "openai";
  const inputEnv = provider === "openai"
    ? process.env.OPENAI_INPUT_USD_PER_1M_TOKENS
    : process.env.HERMES_INPUT_USD_PER_1M_TOKENS;
  const outputEnv = provider === "openai"
    ? process.env.OPENAI_OUTPUT_USD_PER_1M_TOKENS
    : process.env.HERMES_OUTPUT_USD_PER_1M_TOKENS;

  const inRate = inputRatePerM ?? Number(inputEnv || "0");
  const outRate = outputRatePerM ?? Number(outputEnv || "0");

  const costUsd =
    (inputTokens / 1_000_000) * inRate +
    (outputTokens / 1_000_000) * outRate;

  // Fractional cents for observability. Small LLM calls often cost <1 cent.
  return Math.round(costUsd * 100 * 10_000) / 10_000;
}

/**
 * Derive a complete CostEstimate from a Hermes usage block and fallback text.
 *
 * If usage contains provider token counts, use those and mark "provider".
 * Otherwise, estimate from prompt text and response text, mark "estimated".
 */
export function buildCostEstimate(
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  promptText: string,
  responseText: string,
  inputRateCentsPerM?: number,
  outputRateCentsPerM?: number
): CostEstimate {
  if (
    usage?.prompt_tokens !== undefined &&
    usage?.prompt_tokens !== null &&
    usage?.prompt_tokens >= 0 &&
    usage?.completion_tokens !== undefined &&
    usage?.completion_tokens !== null &&
    usage?.completion_tokens >= 0
  ) {
    // Provider-reported tokens
    const inputTokens = usage.prompt_tokens;
    const outputTokens = usage.completion_tokens;
    const totalTokens =
      usage.total_tokens ?? inputTokens + outputTokens;
    const estimatedCostCents = computeCostCents(
      inputTokens,
      outputTokens,
      inputRateCentsPerM,
      outputRateCentsPerM
    );

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      usageSource: "provider",
      estimatedCostCents,
    };
  }

  // Fallback: estimate from text
  const inputTokens = estimateTokens(promptText);
  const outputTokens = estimateTokens(responseText);
  const estimatedCostCents = computeCostCents(
    inputTokens,
    outputTokens,
    inputRateCentsPerM,
    outputRateCentsPerM
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    usageSource: "estimated",
    estimatedCostCents,
  };
}
