#!/usr/bin/env node
/**
 * Generate a single Elena image with Z-Image Turbo + LoRA
 *
 * Usage:
 *   COMFYUI_URL=http://localhost:18188 node app/scripts/elena-single-gen.mjs "prompt text" [output.png] [seed]
 *
 * Env vars:
 *   NSFW_CKPT=1        Use NSFW checkpoint instead of base Z-Image Turbo
 *   NSFW_LORA=1         Stack ZIT NSFW LoRA (alternative to checkpoint)
 *   REALISTIC=1         Stack Realistic Snapshot v5 LoRA (anti-AI look)
 *   ELENA_WEIGHT=1.0    Elena LoRA weight
 *   NSFW_WEIGHT=0.9     NSFW LoRA weight (only with NSFW_LORA=1)
 *   REAL_WEIGHT=0.6     Realistic Snapshot weight (only with REALISTIC=1)
 *   CFG=0               Classifier-free guidance
 *   STEPS=8             Sampling steps
 *   SAMPLER=euler       Sampler name
 *   SCHEDULER=sgm_uniform  Scheduler name
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:18188';

const useNsfwCkpt = process.env.NSFW_CKPT === '1';
const useNsfwLora = process.env.NSFW_LORA === '1';
const useRealistic = process.env.REALISTIC === '1';

const MODELS = {
  unet: useNsfwCkpt ? 'zImageTurboNSFW_30BF16.safetensors' : 'z_image_turbo_bf16.safetensors',
  clip: 'qwen_3_4b.safetensors',
  vae: 'ae.safetensors',
  lora: 'elena_zit_nsfw_v2.safetensors',  // v2: trained ON NSFW checkpoint, rank 32
  nsfw_lora: 'ZITnsfwLoRA_v3.safetensors',
  realistic_lora: 'RealisticSnapshot_v5.safetensors',
};

const promptText = process.argv[2] || '<elena> portrait of a beautiful French woman, natural light, photorealistic';
const outputFile = process.argv[3] || 'elena_output.png';
const seed = parseInt(process.argv[4]) || Math.floor(Math.random() * 1000000000);

const elenaWeight = parseFloat(process.env.ELENA_WEIGHT || '1.0');
const nsfwWeight = parseFloat(process.env.NSFW_WEIGHT || '0.9');
const realWeight = parseFloat(process.env.REAL_WEIGHT || '0.6');
const cfg = parseFloat(process.env.CFG || '0');
const negativePrompt = 'ai generated, smooth skin, plastic, digital art, 3d render, perfect lighting, illustration, CGI, airbrushed';

// Build LoRA chain: UNet → [NSFW LoRA] → [Realistic LoRA] → Elena LoRA
let modelSource = ['1', 0]; // starts from UNETLoader
let nextId = 10;
const loraNodes = {};

if (useNsfwLora) {
  const id = String(nextId++);
  loraNodes[id] = { class_type: 'LoraLoaderModelOnly', inputs: { model: modelSource, lora_name: MODELS.nsfw_lora, strength_model: nsfwWeight } };
  modelSource = [id, 0];
}

if (useRealistic) {
  const id = String(nextId++);
  loraNodes[id] = { class_type: 'LoraLoaderModelOnly', inputs: { model: modelSource, lora_name: MODELS.realistic_lora, strength_model: realWeight } };
  modelSource = [id, 0];
}

// Elena LoRA always last
loraNodes['2'] = { class_type: 'LoraLoaderModelOnly', inputs: { model: modelSource, lora_name: MODELS.lora, strength_model: elenaWeight } };

const workflow = {
  '1': { class_type: 'UNETLoader', inputs: { unet_name: MODELS.unet, weight_dtype: 'default' } },
  ...loraNodes,
  '3': { class_type: 'CLIPLoader', inputs: { clip_name: MODELS.clip, type: 'lumina2' } },
  '4': { class_type: 'VAELoader', inputs: { vae_name: MODELS.vae } },
  '5': { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: promptText } },
  // Negative prompt (only effective when CFG > 0)
  '11': { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: cfg > 0 ? negativePrompt : '' } },
  '6': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 1024, batch_size: 1 } },
  '7': { class_type: 'KSampler', inputs: {
    seed, steps: parseInt(process.env.STEPS || '8'), cfg, sampler_name: process.env.SAMPLER || 'euler', scheduler: process.env.SCHEDULER || 'sgm_uniform', denoise: 1.0,
    model: ['2', 0], positive: ['5', 0], negative: ['11', 0], latent_image: ['6', 0]
  }},
  '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['4', 0] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'elena_gen', images: ['8', 0] } }
};

console.log(`Prompt: ${promptText.slice(0, 100)}...`);
console.log(`Output: ${outputFile}`);
console.log(`Seed: ${seed} | CFG: ${cfg} | Steps: ${process.env.STEPS || '8'} | Sampler: ${process.env.SAMPLER || 'euler'}`);
if (useNsfwCkpt) console.log(`NSFW Checkpoint: ON (v3.0)`);
if (useNsfwLora) console.log(`NSFW LoRA: ${nsfwWeight}`);
if (useRealistic) console.log(`Realistic Snapshot: ${realWeight}`);
console.log(`Elena LoRA: ${elenaWeight}`);
if (cfg > 0) console.log(`Negative: ${negativePrompt.slice(0, 60)}...`);

const res = await fetch(`${COMFYUI_URL}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
});
if (!res.ok) { console.error('Queue failed:', await res.text()); process.exit(1); }
const { prompt_id } = await res.json();
console.log('Generating...');

for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 2000));
  try {
    const hres = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
    const history = await hres.json();
    if (history[prompt_id]) {
      const status = history[prompt_id].status;
      if (status?.status_str === 'error') {
        console.error('Generation error:', JSON.stringify(status.messages));
        process.exit(1);
      }
      const outputs = history[prompt_id].outputs;
      const saveNode = Object.values(outputs).find(o => o.images);
      if (saveNode?.images?.length) {
        const image = saveNode.images[0];
        const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output' });
        const imgRes = await fetch(`${COMFYUI_URL}/view?${params}`);
        const buffer = await imgRes.arrayBuffer();
        const outPath = path.resolve(outputFile);
        fs.writeFileSync(outPath, Buffer.from(buffer));
        console.log(`Saved: ${outPath}`);
        process.exit(0);
      }
    }
  } catch (e) { /* retry */ }
  process.stdout.write('.');
}
console.error('Timeout');
process.exit(1);
