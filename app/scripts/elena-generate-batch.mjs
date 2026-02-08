#!/usr/bin/env node
/**
 * Elena Content Pipeline — Batch Image Generation
 *
 * Generates Elena images using intelligence layers + ZiT NSFW pipeline on Vast.ai.
 *
 * Flow:
 *   1. Check Supabase history (avoid scene/outfit repetition)
 *   2. Check Perplexity trends (ride what's trending)
 *   3. Claude builds image prompts (Elena persona + history + trends)
 *   4. Generate on Vast.ai pod via SSH (ZiT NSFW v3.0 + Elena LoRA v2)
 *   5. Download to elena_content/generated/
 *
 * Usage:
 *   node app/scripts/elena-generate-batch.mjs                    # Generate 10 images (default)
 *   node app/scripts/elena-generate-batch.mjs --count 5          # Generate 5 images
 *   node app/scripts/elena-generate-batch.mjs --count 3 --dry    # Preview prompts only
 *   node app/scripts/elena-generate-batch.mjs --pod-host ssh4.vast.ai --pod-port 12345
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

dotenv.config({ path: join(__dirname, '..', '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { fetchHistory, formatHistoryForPrompt } from './lib/history-layer.mjs';
import { fetchContext, formatContextForPrompt } from './lib/context-layer.mjs';
import { fetchTrendingExperiment, fetchTrendingSafe } from './lib/trending-layer.mjs';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.Claude_key || process.env.CLAUDE_KEY;

const OUTPUT_DIR = join(PROJECT_ROOT, 'elena_content', 'generated');

// Vast.ai pod defaults (override with --pod-host / --pod-port)
const DEFAULT_POD_HOST = 'ssh1.vast.ai';
const DEFAULT_POD_PORT = '10238';

// ZiT generation settings
const STEPS = 30;
const CFG = 1.0;
const HEIGHT = 1024;
const WIDTH = 768;

// ═══════════════════════════════════════════════════════════════
// ELENA CHARACTER (for X — suggestive but SFW)
// ═══════════════════════════════════════════════════════════════

const ELENA_X_PERSONA = `## Elena Visconti — For X/Twitter Content

Elena is a 24yo French woman living in Paris 8e. Married to a wealthy businessman who's always traveling.
She's gleeful, free, flirty — loves her situation (freedom + money).

### Physical Description (MUST include in every prompt):
- Face: Oval/heart shape, high cheekbones, hazel-green eyes with golden tones
- Beauty mark on right cheek (signature)
- Lips: Full, defined cupid's bow
- Hair: Bronde (dark roots + golden blonde balayage), mid-length beach waves
- Skin: Golden tan, sun-kissed
- Body: Athletic but curvy, slim waist, wide hips, natural D cup breasts
- Accessories: Layered gold necklaces, gold chain bracelet

### Trigger Token:
Always start prompts with: <elena>

### Content Types for X (suggestive SFW):
- Bikini, lingerie teasing (covered but suggestive)
- Morning in bed (oversized shirt, messy hair)
- Post-gym (sports bra, yoga pants)
- Evening getting ready (slip dress, mirror selfie)
- Beach/pool (swimwear, golden hour)
- Casual selfie (crop top, jeans, flirty angle)

### Content Types for Fanvue (NSFW explicit):
- Nude in bed, shower, couch
- Masturbation scenes (explicit)
- Topless, bottomless
- Lingerie pulled aside
- Amateur selfie style, iPhone quality

### Photo Style:
- Amateur/iPhone quality (NOT professional studio)
- Natural lighting preferred (golden hour, window light, warm lamp)
- Realistic skin texture (pores, freckles, imperfections)
- Angles: selfie, mirror, from above, candid`;

// ═══════════════════════════════════════════════════════════════
// PARSE ARGS
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || !args[idx + 1]) return defaultVal;
  return args[idx + 1];
}

const COUNT = parseInt(getArg('count', '10'), 10);
const DRY_RUN = args.includes('--dry');
const POD_HOST = getArg('pod-host', DEFAULT_POD_HOST);
const POD_PORT = getArg('pod-port', DEFAULT_POD_PORT);
const PLATFORM = getArg('platform', 'both'); // 'x', 'fanvue', or 'both'

// ═══════════════════════════════════════════════════════════════
// STEP 1: GATHER INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

async function gatherIntelligence() {
  console.log('\n🧠 Gathering intelligence layers...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch history and context in parallel
  const [history, context] = await Promise.all([
    fetchHistory(supabase, 'elena').catch(err => {
      console.log(`   ⚠️ History fetch failed: ${err.message}`);
      return { recentPosts: [], narrative: { storyContext: 'No history' }, avoidList: [] };
    }),
    fetchContext('paris').catch(err => {
      console.log(`   ⚠️ Context fetch failed: ${err.message}`);
      return null;
    }),
  ]);

  // Fetch trending in parallel
  const avoidLocations = history?.avoidList || [];
  const [trendingExp, trendingSafe] = await Promise.all([
    fetchTrendingExperiment(avoidLocations).catch(() => null),
    fetchTrendingSafe(avoidLocations).catch(() => null),
  ]);

  console.log(`   ✅ History: ${history.recentPosts.length} recent posts`);
  console.log(`   ✅ Avoid list: ${avoidLocations.join(', ') || 'none'}`);
  console.log(`   ✅ Context: ${context?.source || 'fallback'}`);
  console.log(`   ✅ Trending exp: ${trendingExp?.location?.name || 'fallback'}`);
  console.log(`   ✅ Trending safe: ${trendingSafe?.location?.name || 'fallback'}`);

  return { history, context, trendingExp, trendingSafe };
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: CLAUDE GENERATES PROMPTS
// ═══════════════════════════════════════════════════════════════

async function generatePrompts(intelligence, count, platform) {
  console.log(`\n🤖 Asking Claude to generate ${count} image prompts...\n`);

  const anthropic = new Anthropic({ apiKey: CLAUDE_KEY });

  const { history, context, trendingExp, trendingSafe } = intelligence;

  let platformInstruction = '';
  if (platform === 'x') {
    platformInstruction = `Generate ONLY SFW/suggestive content for X/Twitter.
- Bikini, lingerie, crop tops, morning bed, post-gym — suggestive but covered
- NO nudity, NO explicit poses
- Tag each prompt with "platform": "x"`;
  } else if (platform === 'fanvue') {
    platformInstruction = `Generate ONLY NSFW explicit content for Fanvue.
- Nude, topless, explicit masturbation, shower nude, lingerie pulled aside
- Amateur selfie style, realistic
- Tag each prompt with "platform": "fanvue"`;
  } else {
    platformInstruction = `Generate a MIX of content:
- ~60% SFW/suggestive for X (bikini, lingerie, morning bed, post-gym — covered but hot)
- ~40% NSFW explicit for Fanvue (nude, topless, masturbation, shower)
- Tag each with "platform": "x" or "platform": "fanvue"`;
  }

  const prompt = `You are a content strategist for Elena Visconti's social media.

${ELENA_X_PERSONA}

═══════════════════════════════════════
INTELLIGENCE DATA
═══════════════════════════════════════

### Recent Post History (avoid repetition):
${formatHistoryForPrompt(history)}

### Real-Time Context:
${formatContextForPrompt(context)}

### Trending Content:
${trendingExp ? `Experiment: ${trendingExp.location?.name} — ${trendingExp.outfit?.name}` : 'No trending data'}
${trendingSafe ? `Classic: ${trendingSafe.location?.name} — ${trendingSafe.outfit?.name}` : 'No trending data'}

═══════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════

Generate exactly ${count} image prompts for Elena.

${platformInstruction}

### Rules:
1. EVERY prompt MUST start with "<elena>"
2. Include physical descriptors: golden tan skin, beauty mark right cheek, bronde beach waves, hazel-green eyes
3. Specify: lighting, angle, setting, clothing/state, pose, expression
4. Use VARIETY: different scenes, outfits, angles, lighting conditions
5. DON'T repeat locations/outfits from recent history
6. USE trending context when relevant (weather, events, season)
7. Amateur/iPhone photo style — NOT professional studio
8. Each prompt should be 1-3 sentences, descriptive and specific

### Output format (JSON only):
{
  "prompts": [
    {
      "prompt": "<elena> ...",
      "platform": "x" or "fanvue",
      "scene": "brief scene description (3-5 words)",
      "seed": random number 100-9999
    }
  ]
}

Return ONLY valid JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Parse JSON
  let jsonStr = text;
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    jsonStr = codeBlock[1];
  } else {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr.trim());
  return parsed.prompts;
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: GENERATE IMAGES ON VAST.AI
// ═══════════════════════════════════════════════════════════════

function generateOnPod(prompts) {
  console.log(`\n🎨 Generating ${prompts.length} images on Vast.ai pod (${POD_HOST}:${POD_PORT})...\n`);

  // Build Python script to run on pod
  const promptsJson = JSON.stringify(prompts.map(p => ({
    prompt: p.prompt,
    seed: p.seed || Math.floor(Math.random() * 9999),
    scene: p.scene || 'unnamed',
  })));

  const pythonScript = `
import torch
import safetensors.torch as st
from diffusers import ZImagePipeline
from diffusers.models import ZImageTransformer2DModel
import json, re

print("Loading NSFW checkpoint...")
nsfw_sd = st.load_file("/workspace/zImageTurboNSFW_30BF16.safetensors")

print("Converting keys...")
converted = {}
for k, v in nsfw_sd.items():
    k = k.replace("model.diffusion_model.", "")
    if ".qkv.weight" in k:
        q, kk, vv = v.chunk(3, dim=0)
        bp = k.replace(".qkv.weight", "")
        converted[f"{bp}.to_q.weight"] = q
        converted[f"{bp}.to_k.weight"] = kk
        converted[f"{bp}.to_v.weight"] = vv
        continue
    if ".attention.out.weight" in k:
        converted[k.replace(".attention.out.weight", ".attention.to_out.0.weight")] = v
        continue
    if ".q_norm.weight" in k:
        converted[k.replace(".q_norm.weight", ".norm_q.weight")] = v
        continue
    if ".k_norm.weight" in k:
        converted[k.replace(".k_norm.weight", ".norm_k.weight")] = v
        continue
    if k.startswith("final_layer."):
        converted[k.replace("final_layer.", "all_final_layer.2-1.")] = v
        continue
    if k.startswith("x_embedder."):
        converted[k.replace("x_embedder.", "all_x_embedder.2-1.")] = v
        continue
    converted[k] = v
del nsfw_sd

print("Building transformer...")
transformer = ZImageTransformer2DModel.from_config({
    "all_f_patch_size": [1], "all_patch_size": [2],
    "axes_dims": [32, 48, 48], "axes_lens": [1536, 512, 512],
    "cap_feat_dim": 2560, "dim": 3840, "in_channels": 16,
    "n_heads": 30, "n_kv_heads": 30, "n_layers": 30,
    "n_refiner_layers": 2, "norm_eps": 1e-05, "qk_norm": True,
    "rope_theta": 256.0, "t_scale": 1000.0
})
transformer.load_state_dict(converted)
del converted
transformer = transformer.to(dtype=torch.bfloat16)

print("Loading pipeline...")
pipe = ZImagePipeline.from_pretrained(
    "Tongyi-MAI/Z-Image-Turbo",
    transformer=transformer,
    torch_dtype=torch.bfloat16,
)
pipe = pipe.to("cuda")
pipe.load_lora_weights("/workspace", weight_name="elena_zit_nsfw_v2.safetensors")
print("Pipeline ready!")

prompts = json.loads('${promptsJson.replace(/'/g, "\\'")}')

for i, p in enumerate(prompts):
    scene = re.sub(r'[^a-z0-9_]', '_', p["scene"].lower().strip())[:30]
    fname = f"elena_{scene}_{p['seed']}.png"
    print(f"Generating {i+1}/{len(prompts)}: {fname}...")
    img = pipe(
        prompt=p["prompt"],
        height=${HEIGHT}, width=${WIDTH},
        num_inference_steps=${STEPS},
        guidance_scale=${CFG},
        generator=torch.Generator("cuda").manual_seed(p["seed"]),
    ).images[0]
    img.save(f"/workspace/batch/{fname}")
    print(f"SAVED:{fname}")

print("BATCH_COMPLETE")
`;

  // Create batch dir on pod and run
  const sshBase = `ssh -p ${POD_PORT} root@${POD_HOST} -o StrictHostKeyChecking=no -o ConnectTimeout=15`;

  // Create batch directory
  execSync(`${sshBase} 'mkdir -p /workspace/batch'`, { stdio: 'pipe' });

  // Run the generation script
  console.log('   Running generation on GPU...');
  const result = execSync(`${sshBase} 'python3 << "PYEOF"\n${pythonScript}\nPYEOF'`, {
    timeout: 600000, // 10 min max
    maxBuffer: 10 * 1024 * 1024,
    encoding: 'utf-8',
  });

  // Parse generated filenames
  const savedFiles = [];
  for (const line of result.split('\n')) {
    if (line.startsWith('SAVED:')) {
      savedFiles.push(line.replace('SAVED:', '').trim());
    }
  }

  if (!result.includes('BATCH_COMPLETE')) {
    console.error('   ⚠️ Generation may not have completed fully');
  }

  console.log(`   ✅ Generated ${savedFiles.length}/${prompts.length} images`);
  return savedFiles;
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: DOWNLOAD IMAGES
// ═══════════════════════════════════════════════════════════════

function downloadImages(files) {
  console.log(`\n📥 Downloading ${files.length} images to elena_content/generated/...\n`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sshBase = `scp -P ${POD_PORT} -o StrictHostKeyChecking=no`;
  const downloaded = [];

  for (const file of files) {
    const localPath = join(OUTPUT_DIR, file);
    try {
      execSync(`${sshBase} root@${POD_HOST}:/workspace/batch/${file} "${localPath}"`, {
        timeout: 30000,
        stdio: 'pipe',
      });
      downloaded.push(file);
      console.log(`   ✅ ${file}`);
    } catch (err) {
      console.log(`   ❌ Failed to download ${file}: ${err.message}`);
    }
  }

  console.log(`\n📁 Downloaded ${downloaded.length}/${files.length} images to:`);
  console.log(`   ${OUTPUT_DIR}`);
  return downloaded;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📸 ELENA CONTENT PIPELINE — Batch Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Count: ${COUNT} images`);
  console.log(`   Platform: ${PLATFORM}`);
  console.log(`   Pod: ${POD_HOST}:${POD_PORT}`);
  console.log(`   Settings: ${STEPS} steps, CFG ${CFG}, ${WIDTH}x${HEIGHT}`);
  console.log(`   Output: elena_content/generated/`);
  if (DRY_RUN) console.log('   🔍 DRY RUN — prompts only, no generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check required env vars
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  if (!CLAUDE_KEY) {
    console.error('❌ Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // Step 1: Gather intelligence
  const intelligence = await gatherIntelligence();

  // Step 2: Generate prompts with Claude
  const prompts = await generatePrompts(intelligence, COUNT, PLATFORM);

  console.log('\n📝 Generated prompts:\n');
  prompts.forEach((p, i) => {
    console.log(`   ${i + 1}. [${p.platform.toUpperCase()}] ${p.scene}`);
    console.log(`      ${p.prompt.substring(0, 100)}...`);
    console.log(`      Seed: ${p.seed}`);
  });

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN complete. Remove --dry to generate images.');
    return;
  }

  // Step 3: Generate on Vast.ai
  const generatedFiles = generateOnPod(prompts);

  // Step 4: Download
  const downloadedFiles = downloadImages(generatedFiles);

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ BATCH GENERATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Generated: ${generatedFiles.length} images`);
  console.log(`   Downloaded: ${downloadedFiles.length} images`);
  console.log(`   Location: elena_content/generated/`);
  console.log('\n📋 Next steps:');
  console.log('   1. Review images in Finder');
  console.log('   2. Move keepers to elena_content/approved/x/ or approved/fanvue/');
  console.log('   3. Run: node app/scripts/elena-prepare-posts.mjs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
