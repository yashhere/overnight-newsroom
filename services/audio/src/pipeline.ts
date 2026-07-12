// ---------------------------------------------------------------------------
// Audio pipeline — two-anchor script assembly, ElevenLabs generation,
// clip stitching, chapter offset tracking (ONR-006)
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  WorkerResult,
  AnchorTurn,
  AudioScript,
  AudioSegment,
  EditionAudio,
  JudgeResult,
} from "../../ingestion/src/types.js";

// ---------------------------------------------------------------------------
// Script assembly — build two-anchor script from gated worker results
// ---------------------------------------------------------------------------

const ANCHOR_A_INTRO = "Good morning. I'm your anchor.";
const ANCHOR_B_INTRO = "And I'm your co-anchor. Here are today's top stories.";
const SIGN_OFF = "That's all for this edition. See you next time.";

/**
 * Assemble a two-anchor audio script from gated (judge-approved) worker results.
 * Alternates A/B anchor turns with chapter starts at story boundaries.
 * Targets ~250 words and 60-90 seconds.
 */
export function assembleScript(
  gatedResults: WorkerResult[],
  editionKey: string,
  language: "en" | "hi" = "en"
): AudioScript {
  const turns: AnchorTurn[] = [];
  let anchor: "A" | "B" = "A";
  const chapterMap: Record<string, number> = {};
  let totalWords = 0;

  // Intro
  turns.push({ anchor: "A", text: ANCHOR_A_INTRO, isChapterStart: false });
  turns.push({ anchor: "B", text: ANCHOR_B_INTRO, isChapterStart: false });
  totalWords += ANCHOR_A_INTRO.split(/\s+/).length + ANCHOR_B_INTRO.split(/\s+/).length;

  // Story turns
  for (const result of gatedResults) {
    if (result.validationStatus === "invalid") continue;
    if (result.story.summaryBullets.length === 0) continue;

    const storyKey = `${editionKey}-${result.roleId}`;

    // Chapter start
    const headline = `${result.story.title}.`;
    turns.push({
      anchor,
      text: headline,
      isChapterStart: true,
      storyKey,
      pronunciation: undefined,
    });
    chapterMap[storyKey] = turns.length - 1;
    totalWords += headline.split(/\s+/).length;
    anchor = flipAnchor(anchor);

    // Bullet points — alternate anchors per bullet
    for (const bullet of result.story.summaryBullets) {
      const words = bullet.split(/\s+/).length;
      if (totalWords + words > 280) break; // cap at ~280 words total

      turns.push({
        anchor,
        text: bullet,
        isChapterStart: false,
        storyKey,
      });
      totalWords += words;
      anchor = flipAnchor(anchor);
    }
  }

  // Sign-off
  turns.push({ anchor: "A", text: SIGN_OFF, isChapterStart: false });
  totalWords += SIGN_OFF.split(/\s+/).length;

  return {
    editionKey,
    language,
    turns,
    wordCount: totalWords,
    chapterMap,
  };
}

function flipAnchor(current: "A" | "B"): "A" | "B" {
  return current === "A" ? "B" : "A";
}

// ---------------------------------------------------------------------------
// Pronunciation hints for common problematic terms
// ---------------------------------------------------------------------------

const PRONUNCIATION_HINTS: Record<string, string> = {
  Sensex: "SEN-sex",
  Nifty: "NIF-tee",
  RBI: "R B I",
  Crore: "krore",
  Lakh: "lack",
  GDP: "G D P",
  FY: "F Y",
  QoQ: "Q on Q",
  OPEC: "O-pec",
  TSMC: "T S M C",
  IPCC: "I P C C",
  SCOTUS: "SCO-tus",
  Brent: "brent",
  "₹": "rupees",
  "%": "percent",
};

/**
 * Add pronunciation hints to turns where the text contains known terms.
 */
export function addPronunciationHints(
  script: AudioScript
): AudioScript {
  return {
    ...script,
    turns: script.turns.map((turn) => {
      for (const [term, hint] of Object.entries(PRONUNCIATION_HINTS)) {
        if (turn.text.includes(term)) {
          return { ...turn, pronunciation: hint };
        }
      }
      return turn;
    }),
  };
}

// ---------------------------------------------------------------------------
// ElevenLabs client interface
// ---------------------------------------------------------------------------

export interface ElevenLabsClient {
  /** Generate speech from text, returns audio buffer, duration, and cost. */
  generateSpeech(params: {
    text: string;
    voiceId: string;
    language?: string;
  }): Promise<{
    audioBuffer: Buffer;
    durationMs: number;
    costCents: number;
    latencyMs: number;
  }>;
}

/**
 * Create an ElevenLabs client using the REST API.
 * Requires ELEVENLABS_API_KEY environment variable.
 */
export function createElevenLabsClient(config?: {
  apiKey?: string;
  voiceIdA?: string;
  voiceIdB?: string;
}): ElevenLabsClient & { voiceIdA: string; voiceIdB: string } {
  const apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || "";
  const voiceIdA = config?.voiceIdA || process.env.ELEVENLABS_VOICE_ID_A || "21m00Tcm4TlvDq8ikWAM"; // Rachel
  const voiceIdB = config?.voiceIdB || process.env.ELEVENLABS_VOICE_ID_B || "AZnzlk1XvdvUeBnXmlld"; // Domi

  async function generateSpeech(params: {
    text: string;
    voiceId: string;
    language?: string;
  }): Promise<{ audioBuffer: Buffer; durationMs: number; costCents: number; latencyMs: number }> {
    const start = Date.now();

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: params.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`ElevenLabs error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const latencyMs = Date.now() - start;

    // Estimate duration from character count (~15 chars/sec for TTS)
    const estimatedDurationMs = Math.ceil(params.text.length / 15) * 1000;
    // ElevenLabs pricing: ~$0.30 per 1000 chars
    const costCents = Math.ceil((params.text.length / 1000) * 30);

    return {
      audioBuffer,
      durationMs: estimatedDurationMs,
      costCents,
      latencyMs,
    };
  }

  return { generateSpeech, voiceIdA, voiceIdB };
}

// ---------------------------------------------------------------------------
// R2 upload interface
// ---------------------------------------------------------------------------

export interface R2Uploader {
  /** Upload a file to R2, returns the public URL. */
  upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<string>;
}

/**
 * Generate a single segment clip using ElevenLabs.
 */
export async function generateSegment(
  text: string,
  turnIndex: number,
  editionKey: string,
  anchor: AnchorTurn["anchor"],
  voiceId: string,
  audioBuffer: Buffer,
  uploader: R2Uploader,
  durationMs: number,
  costCents: number,
  latencyMs: number,
  retryCount = 0
): Promise<AudioSegment> {
  const segmentId = randomUUID();

  try {
    const key = `audio/${editionKey}/${segmentId}.mp3`;
    const clipUrl = await uploader.upload({
      key,
      body: audioBuffer,
      contentType: "audio/mpeg",
      metadata: {
        editionKey,
        turnIndex: String(turnIndex),
        anchor,
      },
    });

    return {
      segmentId,
      editionKey,
      anchor,
      turnIndex,
      text,
      voiceId,
      durationMs,
      clipUrl,
      costCents,
      latencyMs,
      createdAt: Date.now(),
    };
  } catch (err: any) {
    if (retryCount < 1) {
      console.warn(`[audio] Segment ${turnIndex} upload failed, retrying: ${err.message}`);
      return generateSegment(text, turnIndex, editionKey, anchor, voiceId, audioBuffer, uploader, durationMs, costCents, latencyMs, retryCount + 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Full edition audio assembly
// ---------------------------------------------------------------------------

export interface AudioAssemblyResult {
  segments: AudioSegment[];
  editionAudio: EditionAudio;
}

/**
 * Generate all segments for an edition, then assemble the full bulletin.
 * Segments are generated sequentially to preserve ElevenLabs rate limits.
 * Chapter offsets are computed from cumulative segment durations.
 */
export async function produceEditionAudio(
  script: AudioScript,
  elevenlabs: ReturnType<typeof createElevenLabsClient>,
  uploader: R2Uploader
): Promise<AudioAssemblyResult> {
  const segments: AudioSegment[] = [];
  const audioBuffers: Buffer[] = [];
  let totalCostCents = 0;
  let totalLatencyMs = 0;
  let cumulativeMs = 0;
  const chapters: EditionAudio["chapters"] = [];

  for (let i = 0; i < script.turns.length; i++) {
    const turn = script.turns[i];
    const voiceId = turn.anchor === "A" ? elevenlabs.voiceIdA : elevenlabs.voiceIdB;

    const textWithHint = turn.pronunciation
      ? `${turn.text} (${turn.pronunciation})`
      : turn.text;

    // Generate speech via ElevenLabs (retried once on failure)
    let audioBuffer: Buffer;
    let durationMs: number;
    let costCents: number;
    let latencyMs: number;

    try {
      const speech = await elevenlabs.generateSpeech({ text: textWithHint, voiceId });
      audioBuffer = speech.audioBuffer;
      durationMs = speech.durationMs;
      costCents = speech.costCents;
      latencyMs = speech.latencyMs;
    } catch (err: any) {
      console.warn(`[audio] Turn ${i} speech failed, retrying: ${err.message}`);
      const speech = await elevenlabs.generateSpeech({ text: textWithHint, voiceId });
      audioBuffer = speech.audioBuffer;
      durationMs = speech.durationMs;
      costCents = speech.costCents;
      latencyMs = speech.latencyMs;
    }

    audioBuffers.push(audioBuffer);

    // Upload segment to R2
    const segment = await generateSegment(
      textWithHint,
      i,
      script.editionKey,
      turn.anchor,
      voiceId,
      audioBuffer,
      uploader,
      durationMs,
      costCents,
      latencyMs,
    );

    segments.push(segment);
    totalCostCents += segment.costCents;
    totalLatencyMs += segment.latencyMs;

    // Record chapter start offsets
    if (turn.isChapterStart && turn.storyKey) {
      chapters.push({
        storyKey: turn.storyKey,
        startMs: cumulativeMs,
        title: textWithHint.slice(0, 80),
      });
    }

    cumulativeMs += segment.durationMs;
  }

  // Assemble full bulletin by concatenating buffers sequentially
  const fullBuffer = Buffer.concat(audioBuffers);
  const fullKey = `audio/${script.editionKey}/full-edition.mp3`;
  const fullAudioUrl = await uploader.upload({
    key: fullKey,
    body: fullBuffer,
    contentType: "audio/mpeg",
    metadata: { editionKey: script.editionKey },
  });

  const editionAudio: EditionAudio = {
    editionKey: script.editionKey,
    totalDurationMs: cumulativeMs,
    fullAudioUrl,
    chapters,
    segments,
    totalCostCents,
    totalLatencyMs,
  };

  return { segments, editionAudio };
}

// ---------------------------------------------------------------------------
// Validation: gate check before audio pipeline
// ---------------------------------------------------------------------------

export function validateGatedInput(
  results: WorkerResult[],
  judgeResult: JudgeResult
): { valid: boolean; blocked: string[] } {
  const blocked = judgeResult.verdicts
    .filter((v) => v.verdict === "block" || v.verdict === "escalate")
    .map((v) => `${v.claimId}: ${v.reason}`);

  if (blocked.length > 0) {
    return { valid: false, blocked };
  }

  const hasApproved = judgeResult.verdicts.some((v) => v.verdict === "approved");
  if (!hasApproved && results.length > 0) {
    return { valid: false, blocked: ["No claims approved — cannot produce audio"] };
  }

  return { valid: true, blocked: [] };
}
