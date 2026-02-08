#!/usr/bin/env node
/**
 * Elena NSFW Test - Improved face consistency
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

// Enhanced prompts with stronger face focus
const TESTS = [
  {
    name: 'lingerie_face_focus',
    weight: 1.2,
    cfg: 2.5,
    prompt: `elena, intimate bedroom photo, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes, natural eyebrows,
wearing black lace lingerie, gold delicate necklace,
sensual confident expression looking at camera, soft warm bedroom lighting,
iPhone 16 Pro photo, natural skin texture, shallow depth of field`,
    negative: `wrong face, different person, dark hair, round face, blue eyes, heavy makeup, artificial, blurry face`,
  },
  {
    name: 'bikini_face_focus',
    weight: 1.2,
    cfg: 2.5,
    prompt: `elena, poolside selfie, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes,
wearing tiny black bikini, wet tanned skin, gold chain necklace,
playful confident smile, bright summer sunlight, turquoise pool background,
iPhone 16 Pro photo, natural sun-kissed skin, water reflections`,
    negative: `wrong face, different person, dark hair, round face, blue eyes, heavy makeup, artificial, blurry face`,
  },
  {
    name: 'topless_face_focus',
    weight: 1.2,
    cfg: 2.5,
    prompt: `elena, artistic boudoir photo, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes,
topless, hair partially covering chest, gold pendant necklace,
elegant confident gaze at camera, soft natural window light, white sheets background,
iPhone 16 Pro photo, natural skin texture, intimate aesthetic`,
    negative: `wrong face, different person, dark hair, round face, blue eyes, heavy makeup, artificial, blurry face`,
  },
  {
    name: 'lingerie_w1.3',
    weight: 1.3,
    cfg: 3.0,
    prompt: `elena, intimate bedroom selfie,
elena woman with light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
wearing black lace lingerie bra, gold necklace,
sensual confident expression, soft warm lighting, silk sheets,
iPhone 16 Pro photo, natural skin, bedroom bokeh`,
    negative: `wrong face, different person, dark hair, round face, pale skin, artificial`,
  },
  {
    name: 'bikini_low_cfg',
    weight: 1.0,
    cfg: 2.0,
    prompt: `elena, beach bikini selfie, golden hour,
elena woman light brown wavy hair blonde highlights, full lips, high cheekbones, angular jawline,
wearing white string bikini, tanned skin, gold body chain,
relaxed happy smile, sunset ocean background,
iPhone 16 Pro photo, natural glowing skin`,
    negative: `wrong face, different person, dark hair, artificial`,
  },
];

function buildWorkflow(prompt, negative, weight, cfg, seed, prefix) {
  return {
    "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "z_image_bf16.safetensors", "weight_dtype": "default" }},
    "2": { "class_type": "LoraLoaderModelOnly", "inputs": { "model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": weight }},
    "3": { "class_type": "CLIPLoader", "inputs": { "clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2" }},
    "4": { "class_type": "VAELoader", "inputs": { "vae_name": "ae.safetensors" }},
    "5": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": prompt }},
    "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": negative }},
    "7": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1344, "batch_size": 1 }},
    "8": { "class_type": "KSampler", "inputs": { "seed": seed, "steps": 30, "cfg": cfg, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0] }},
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["8", 0], "vae": ["4", 0] }},
    "10": { "class_type": "SaveImage", "inputs": { "filename_prefix": prefix, "images": ["9", 0] }}
  };
}

async function generate(test) {
  const seed = Math.floor(Math.random() * 1000000000);
  const prefix = `elena_nsfw_${test.name}`;
  const workflow = buildWorkflow(test.prompt, test.negative, test.weight, test.cfg, seed, prefix);

  console.log(`\n🎨 ${test.name} (w${test.weight}, cfg${test.cfg})`);

  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });

  if (!res.ok) { console.error('Queue failed'); return; }
  const { prompt_id } = await res.json();
  console.log(`   Queued: ${prompt_id}`);

  // Wait for completion
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const timeout = setTimeout(() => { ws.close(); console.log('   Timeout (but job continues)'); resolve(); }, 3 * 60 * 1000);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'progress') {
          process.stdout.write(`\r   Progress: ${msg.data.value}/${msg.data.max}    `);
        }
        if (msg.type === 'executing' && msg.data.node === null) {
          clearTimeout(timeout);
          ws.close();
          console.log('\n   ✅ Done');
          resolve();
        }
      } catch (e) {}
    });
    ws.on('error', () => { clearTimeout(timeout); resolve(); });
  });
}

async function main() {
  console.log('🔬 Elena NSFW Face Consistency Tests\n');
  console.log('Testing: higher weight, lower CFG, face-focused prompts\n');

  for (const test of TESTS) {
    await generate(test);
  }

  console.log('\n✅ All tests queued. Check pod output folder.');
}

main().catch(e => console.error(e.message));
