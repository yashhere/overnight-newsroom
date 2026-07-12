// Live audio E2E: ElevenLabs → R2
// Run: npx tsx services/evals/live-audio.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { createElevenLabsClient, createR2Uploader } from "../audio/src/pipeline.js";

async function main() {
  console.log("══ Live Audio Test ══\n");

  // 1. Check env
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const r2Acct = process.env.R2_ACCOUNT_ID;
  if (!apiKey) { console.log("✗ ELEVENLABS_API_KEY not set"); process.exit(1); }
  if (!r2Acct) { console.log("✗ R2_ACCOUNT_ID not set"); process.exit(1); }

  console.log(`ElevenLabs: ${apiKey.slice(0, 8)}...`);
  console.log(`R2 account: ${r2Acct}`);
  console.log(`R2 bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`R2 public: ${process.env.R2_PUBLIC_URL}\n`);

  // 2. Test ElevenLabs TTS
  console.log("1. ElevenLabs TTS...");
  const start = Date.now();
  const elevenlabs = createElevenLabsClient();

  try {
    const speech = await elevenlabs.generateSpeech({
      text: "Good morning. This is Overnight Newsroom. Today's top story: the live audio pipeline is working.",
      voiceId: elevenlabs.voiceIdA,
    });
    console.log(`   ✓ Generated in ${speech.latencyMs}ms, ${speech.audioBuffer.length} bytes, ${speech.costCents}c`);

    // 3. Upload to R2
    console.log("\n2. R2 upload...");
    const uploader = createR2Uploader();
    const url = await uploader.upload({
      key: `test/live-test-${Date.now()}.mp3`,
      body: speech.audioBuffer,
      contentType: "audio/mpeg",
      metadata: { test: "true" },
    });
    console.log(`   ✓ Uploaded: ${url}`);

    console.log(`\n══ Done in ${Date.now() - start}ms ══`);
  } catch (err: any) {
    console.log(`   ✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
