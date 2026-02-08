#!/usr/bin/env node
/**
 * Elena LoRA v3 Batch Test - Generate multiple images to test consistency
 *
 * Usage: node app/scripts/elena-batch-test.mjs
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

const MODELS = {
  unet: 'z_image_bf16.safetensors',
  clip: 'qwen_3_4b_bf16.safetensors',
  vae: 'ae.safetensors',
  lora: 'elena_zimage_v3_comfyorg.safetensors',
};

// Different scenes to test variety
const PROMPTS = [
  {
    name: 'cafe',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
casual iPhone selfie in a Parisian cafe, golden morning light,
wearing beige cashmere sweater, gold chain necklace,
natural confident smile, looking at camera,
iPhone 16 Pro photo, natural skin, soft bokeh background,
authentic candid moment, warm tones, slight depth of field`,
  },
  {
    name: 'beach',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
beach sunset selfie, golden hour warm light on face,
wearing white linen shirt, gold pendant necklace,
relaxed confident expression, wind in hair,
iPhone 16 Pro photo, natural tan skin, ocean bokeh background,
summer vibes, warm golden tones`,
  },
  {
    name: 'home',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
cozy home selfie on couch, soft window light,
wearing oversized white sweater, delicate gold necklace,
relaxed natural smile, looking at camera,
iPhone 16 Pro photo, natural skin, warm interior bokeh,
intimate lifestyle moment, soft tones`,
  },
  {
    name: 'street',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
street style selfie in Paris, afternoon light,
wearing black leather jacket, gold layered necklaces,
confident cool expression, urban background,
iPhone 16 Pro photo, natural skin, city bokeh,
fashion influencer vibe, neutral tones`,
  },
  {
    name: 'mirror',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
mirror selfie in modern bathroom, bright natural light,
wearing simple white tank top, minimalist gold jewelry,
casual morning vibe, phone visible in mirror,
iPhone 16 Pro photo, natural skin, clean aesthetic,
authentic everyday moment, bright tones`,
  },
];

const NEGATIVE = 'dark hair, round face, pale skin, heavy makeup, artificial, overprocessed';

function buildWorkflow(prompt, loraWeight, cfg, seed, filenamePrefix) {
  return {
    "1": {
      "class_type": "UNETLoader",
      "inputs": { "unet_name": MODELS.unet, "weight_dtype": "default" }
    },
    "2": {
      "class_type": "LoraLoaderModelOnly",
      "inputs": { "model": ["1", 0], "lora_name": MODELS.lora, "strength_model": loraWeight }
    },
    "3": {
      "class_type": "CLIPLoader",
      "inputs": { "clip_name": MODELS.clip, "type": "lumina2" }
    },
    "4": {
      "class_type": "VAELoader",
      "inputs": { "vae_name": MODELS.vae }
    },
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": { "clip": ["3", 0], "text": prompt }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": { "clip": ["3", 0], "text": NEGATIVE }
    },
    "7": {
      "class_type": "EmptyLatentImage",
      "inputs": { "width": 1024, "height": 1344, "batch_size": 1 }
    },
    "8": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": 30,
        "cfg": cfg,
        "sampler_name": "res_multistep",
        "scheduler": "simple",
        "denoise": 1.0,
        "model": ["2", 0],
        "positive": ["5", 0],
        "negative": ["6", 0],
        "latent_image": ["7", 0]
      }
    },
    "9": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["8", 0], "vae": ["4", 0] }
    },
    "10": {
      "class_type": "SaveImage",
      "inputs": { "filename_prefix": filenamePrefix, "images": ["9", 0] }
    }
  };
}

async function queuePrompt(workflow) {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });
  if (!res.ok) throw new Error(`Queue failed: ${await res.text()}`);
  return res.json();
}

async function waitForCompletion(promptId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 10 * 60 * 1000);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'executing' && msg.data.node === null) {
          clearTimeout(timeout);
          ws.close();
          const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
          const history = await historyRes.json();
          resolve(history[promptId]);
        }
        if (msg.type === 'execution_error') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Execution error'));
        }
      } catch (e) {}
    });
    ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

async function downloadImage(filename) {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  return res.arrayBuffer();
}

async function main() {
  console.log('🎨 Elena LoRA v3 Batch Test\n');
  console.log('Generating 15 images (5 per weight: 1.0, 1.1, 1.2)\n');

  const weights = [1.0, 1.1, 1.2];
  const cfg = 3.0;
  const outputDir = path.join(process.cwd(), 'elena_batch_test');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let totalGenerated = 0;

  for (const weight of weights) {
    console.log(`\n📊 Weight ${weight}:`);

    for (let i = 0; i < 5; i++) {
      const promptConfig = PROMPTS[i];
      const seed = Math.floor(Math.random() * 1000000000);
      const prefix = `elena_w${weight}_${promptConfig.name}`;

      process.stdout.write(`   ${i + 1}/5 ${promptConfig.name}... `);

      try {
        const workflow = buildWorkflow(promptConfig.prompt, weight, cfg, seed, prefix);
        const { prompt_id } = await queuePrompt(workflow);
        const result = await waitForCompletion(prompt_id);

        const outputs = result.outputs;
        const saveNode = Object.values(outputs).find(o => o.images);
        if (saveNode?.images?.length) {
          const img = saveNode.images[0];
          const buffer = await downloadImage(img.filename);
          const localPath = path.join(outputDir, `w${weight}_${promptConfig.name}.png`);
          fs.writeFileSync(localPath, Buffer.from(buffer));
          console.log('✅');
          totalGenerated++;
        }
      } catch (e) {
        console.log(`❌ ${e.message}`);
      }
    }
  }

  console.log(`\n🎉 Done! Generated ${totalGenerated}/15 images`);
  console.log(`📁 Saved to: ${outputDir}/`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
