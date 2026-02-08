#!/usr/bin/env node
/**
 * Elena Z-Image Turbo LoRA Inference Test
 *
 * Generates diverse SFW + NSFW images using Z-Image Turbo + Elena LoRA v1.
 * Connects to ComfyUI on Vast.ai instance.
 *
 * Usage:
 *   COMFYUI_URL=http://HOST:PORT node app/scripts/elena-zit-lora-inference.mjs
 *   COMFYUI_URL=http://HOST:PORT node app/scripts/elena-zit-lora-inference.mjs --single 0
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const COMFYUI_URL = process.env.COMFYUI_URL;
if (!COMFYUI_URL) {
  console.error('Set COMFYUI_URL env var (e.g. http://host:8188)');
  process.exit(1);
}

// Models (ComfyUI paths after download)
const MODELS = {
  unet: 'z_image_turbo_bf16.safetensors',
  clip: 'qwen_3_4b.safetensors',
  vae: 'ae.safetensors',
  lora: 'elena_zit_lora_v1.safetensors',
};

// Test prompts — diverse scenarios for proper evaluation
const TEST_PROMPTS = [
  // SFW portraits
  {
    name: 'sfw_portrait_natural',
    prompt: '<elena> close-up portrait of a beautiful 24 year old French woman, natural window light, warm smile, wearing a cream knit sweater, soft bokeh background, shot on Canon R5 85mm f/1.4, photorealistic, 8k',
    category: 'SFW',
  },
  {
    name: 'sfw_cafe_paris',
    prompt: '<elena> a beautiful 24 year old French woman sitting at a Parisian cafe terrace, golden hour sunlight, wearing a black turtleneck and gold necklace, espresso cup on table, candid shot, street photography, Leica M11, photorealistic',
    category: 'SFW',
  },
  {
    name: 'sfw_beach_golden',
    prompt: '<elena> a beautiful 24 year old French woman on a Mediterranean beach at golden hour, wearing a white linen sundress, wind in hair, waves in background, warm golden light, iPhone 15 Pro selfie style, natural and relaxed',
    category: 'SFW',
  },
  {
    name: 'sfw_gym_selfie',
    prompt: '<elena> a beautiful 24 year old French woman gym mirror selfie, athletic build, wearing black sports bra and leggings, slight sweat on skin, natural lighting, iPhone photo, casual pose, gym background',
    category: 'SFW',
  },
  {
    name: 'sfw_night_dress',
    prompt: '<elena> a beautiful 24 year old French woman at a rooftop bar at night, wearing an elegant red dress, city lights bokeh background, warm ambient lighting, champagne glass in hand, glamorous, 8k photo',
    category: 'SFW',
  },
  // Suggestive / lingerie
  {
    name: 'suggestive_bedroom',
    prompt: '<elena> a beautiful 24 year old French woman lying on white hotel bed sheets, wearing black lace lingerie, soft morning light from window, relaxed sensual pose, warm skin tones, boudoir photography, 8k',
    category: 'Suggestive',
  },
  {
    name: 'suggestive_mirror',
    prompt: '<elena> a beautiful 24 year old French woman standing in front of a bathroom mirror, wearing white cotton underwear and bralette, natural morning light, candid intimate moment, warm tones, photorealistic',
    category: 'Suggestive',
  },
  // NSFW
  {
    name: 'nsfw_topless_beach',
    prompt: '<elena> a beautiful 24 year old French woman sunbathing topless on a secluded beach, natural breasts, lying on a towel, Mediterranean sea in background, golden hour warm light, natural skin with freckles, photorealistic, 8k',
    category: 'NSFW',
  },
  {
    name: 'nsfw_shower',
    prompt: '<elena> a beautiful 24 year old French woman in a glass shower, nude, wet skin, steam, water droplets on glass, warm bathroom lighting, natural pose, photorealistic skin texture with pores, 8k',
    category: 'NSFW',
  },
  {
    name: 'nsfw_bedroom_nude',
    prompt: '<elena> a beautiful 24 year old French woman lying nude on white bed sheets, morning sunlight through curtains, natural pose, beautiful skin texture, warm golden tones, intimate boudoir, photorealistic, 8k',
    category: 'NSFW',
  },
  // Varied angles / poses for face consistency check
  {
    name: 'face_three_quarter',
    prompt: '<elena> three-quarter profile portrait of a beautiful 24 year old French woman, studio lighting with softbox, neutral grey background, wearing pearl earrings, beauty photography, sharp focus on eyes, 8k',
    category: 'Face Test',
  },
  {
    name: 'face_looking_down',
    prompt: '<elena> a beautiful 24 year old French woman looking down and smiling softly, reading a book in a cozy armchair, warm lamp light, wearing an oversized beige cardigan, soft focus background, intimate candid moment',
    category: 'Face Test',
  },
];

/**
 * Build Z-Image Turbo workflow with LoRA
 */
function buildWorkflow({ prompt, seed, width = 1024, height = 1024, loraWeight = 1.0, filenamePrefix = 'elena_zit' }) {
  return {
    // 1: Load UNet (Z-Image Turbo)
    "1": {
      class_type: "UNETLoader",
      inputs: { unet_name: MODELS.unet, weight_dtype: "default" }
    },
    // 2: Load LoRA (Elena)
    "2": {
      class_type: "LoraLoaderModelOnly",
      inputs: {
        model: ["1", 0],
        lora_name: MODELS.lora,
        strength_model: loraWeight
      }
    },
    // 3: Load CLIP (Qwen 3 4B, lumina2 type)
    "3": {
      class_type: "CLIPLoader",
      inputs: { clip_name: MODELS.clip, type: "lumina2" }
    },
    // 4: Load VAE
    "4": {
      class_type: "VAELoader",
      inputs: { vae_name: MODELS.vae }
    },
    // 5: Positive prompt
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["3", 0], text: prompt }
    },
    // 6: Empty latent
    "6": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 }
    },
    // 7: KSampler — ZiT optimal: 8 steps, cfg 0, euler, sgm_uniform
    "7": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 8,
        cfg: 0,
        sampler_name: "euler",
        scheduler: "sgm_uniform",
        denoise: 1.0,
        model: ["2", 0],  // LoRA output
        positive: ["5", 0],
        negative: ["5", 0],  // Same as positive (no negative for ZiT)
        latent_image: ["6", 0]
      }
    },
    // 8: VAE Decode
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["7", 0], vae: ["4", 0] }
    },
    // 9: Save Image
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: filenamePrefix, images: ["8", 0] }
    }
  };
}

async function queuePrompt(workflow) {
  const clientId = randomUUID();
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Queue failed (${res.status}): ${err}`);
  }
  return res.json();
}

/** Poll /history until prompt completes (more reliable than WebSocket through tunnels) */
async function waitForCompletion(promptId) {
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2000)); // poll every 2s
    try {
      const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      const history = await res.json();
      if (history[promptId]) {
        // Check for errors
        const status = history[promptId].status;
        if (status && status.status_str === 'error') {
          throw new Error(`Execution error: ${JSON.stringify(status.messages)}`);
        }
        return history[promptId];
      }
    } catch (e) {
      if (e.message.includes('Execution error')) throw e;
      // Network error, retry
    }
    process.stdout.write('.');
  }
  throw new Error('Timeout 5min');
}

async function downloadImage(filename, subfolder = '', type = 'output') {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFYUI_URL}/view?${params}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.arrayBuffer();
}

async function checkConnection() {
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`);
    const data = await res.json();
    return { ok: true, gpu: data.devices?.[0]?.name || 'unknown' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const singleIdx = args.indexOf('--single') !== -1 ? parseInt(args[args.indexOf('--single') + 1]) : null;
  const loraWeight = args.indexOf('--weight') !== -1 ? parseFloat(args[args.indexOf('--weight') + 1]) : 1.0;

  console.log('Elena ZiT LoRA Inference Test');
  console.log(`ComfyUI: ${COMFYUI_URL}`);
  console.log(`LoRA weight: ${loraWeight}\n`);

  const status = await checkConnection();
  if (!status.ok) {
    console.error(`ComfyUI not accessible: ${status.error}`);
    process.exit(1);
  }
  console.log(`Connected — GPU: ${status.gpu}\n`);

  // Output directory
  const outDir = path.join(process.cwd(), 'elena_lora_tests', 'zit_inference');
  fs.mkdirSync(outDir, { recursive: true });

  const prompts = singleIdx !== null ? [TEST_PROMPTS[singleIdx]] : TEST_PROMPTS;
  const seeds = [42, 1337, 8675309]; // 3 seeds per prompt for consistency check

  let total = 0;
  const results = [];

  for (const tp of prompts) {
    for (const seed of seeds) {
      total++;
      const prefix = `${tp.name}_s${seed}`;
      console.log(`[${total}/${prompts.length * seeds.length}] ${tp.category} | ${tp.name} | seed ${seed}`);

      try {
        const workflow = buildWorkflow({
          prompt: tp.prompt,
          seed,
          loraWeight,
          filenamePrefix: `elena_zit/${prefix}`,
        });

        const { prompt_id } = await queuePrompt(workflow);
        const result = await waitForCompletion(prompt_id);

        const outputs = result.outputs;
        const saveNode = Object.values(outputs).find(o => o.images);
        if (!saveNode?.images?.length) throw new Error('No images');

        const image = saveNode.images[0];
        const buffer = await downloadImage(image.filename, image.subfolder || '', image.type || 'output');
        const localFile = path.join(outDir, `${prefix}.png`);
        fs.writeFileSync(localFile, Buffer.from(buffer));

        console.log(`  Saved: ${prefix}.png`);
        results.push({ name: prefix, category: tp.category, seed, status: 'ok' });
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        results.push({ name: prefix, category: tp.category, seed, status: 'error', error: err.message });
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${results.filter(r => r.status === 'ok').length}/${results.length} generated`);
  console.log(`Output: ${outDir}`);
  console.log(`${'='.repeat(60)}`);

  const byCategory = {};
  for (const r of results) {
    byCategory[r.category] = byCategory[r.category] || [];
    byCategory[r.category].push(r);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    const ok = items.filter(i => i.status === 'ok').length;
    console.log(`  ${cat}: ${ok}/${items.length}`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
