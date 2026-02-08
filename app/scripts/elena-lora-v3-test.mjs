#!/usr/bin/env node
/**
 * Elena LoRA v3 Test - Z-Image Full with Optimal Settings
 *
 * Settings based on research:
 * - Z-Image Full (non-Turbo): CFG 3.0-4.0, Steps 28-35, res_multistep sampler
 * - LoRA weight: 0.7-0.8 (max 0.8 for character LoRAs)
 * - iPhone 16 Pro style: natural colors, crisp detail, depth of field
 *
 * Sources:
 * - https://apatero.com/blog/best-settings-character-lora-z-image-turbo-guide-2025
 * - https://www.stablediffusiontutorials.com/2026/01/z-image.html
 * - https://docsbot.ai/prompts/images/iphone-16-style-photo-edit
 *
 * Run: node app/scripts/elena-lora-v3-test.mjs
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Local ComfyUI (Mac)
const COMFYUI_HOST = 'localhost';
const COMFYUI_PORT = '8188';
const COMFYUI_URL = `http://${COMFYUI_HOST}:${COMFYUI_PORT}`;
const WS_URL = `ws://${COMFYUI_HOST}:${COMFYUI_PORT}/ws`;

// Model paths (local ComfyUI)
const MODELS = {
  unet: 'z_image_bf16.safetensors',      // Official Comfy-Org Z-Image Full 12.3GB
  clip: 'qwen_3_4b_bf16.safetensors',    // Qwen 2.5 3B text encoder
  vae: 'ae.safetensors',                  // Flux VAE
  lora: 'elena_zimage_v3_comfyorg.safetensors',  // Our trained LoRA
};

/**
 * Build Z-Image Full workflow with LoRA for Elena
 *
 * Optimal settings for character LoRA + realistic portrait:
 * - CFG: 3.0-4.0 (lower for LoRAs, avoids artifacts)
 * - Steps: 28-35 (Z-Image Full needs more than Turbo)
 * - Sampler: res_multistep (recommended for Full model)
 * - LoRA weight: 0.7-0.8 (sweet spot for identity)
 */
function buildElenaLoraWorkflow(options = {}) {
  const {
    prompt,
    negativePrompt = '',
    width = 1024,
    height = 1344,  // 3:4 ratio for portrait/social media
    steps = 30,
    cfg = 3.5,      // Lower CFG for LoRAs
    loraWeight = 0.8,
    seed = Math.floor(Math.random() * 1000000000),
    filenamePrefix = 'elena_v3_test',
  } = options;

  return {
    // Node 1: Load Diffusion Model (Z-Image Full)
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": MODELS.unet,
        "weight_dtype": "default"
      }
    },

    // Node 2: Load LoRA (Elena v3)
    "2": {
      "class_type": "LoraLoaderModelOnly",
      "inputs": {
        "model": ["1", 0],
        "lora_name": MODELS.lora,
        "strength_model": loraWeight
      }
    },

    // Node 3: Load CLIP (Qwen with lumina2 type)
    "3": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": MODELS.clip,
        "type": "lumina2"
      }
    },

    // Node 4: Load VAE
    "4": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": MODELS.vae
      }
    },

    // Node 5: Positive prompt encoding
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["3", 0],
        "text": prompt
      }
    },

    // Node 6: Negative prompt encoding
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["3", 0],
        "text": negativePrompt
      }
    },

    // Node 7: Empty Latent Image (3:4 portrait ratio)
    "7": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },

    // Node 8: KSampler with Z-Image Full optimal settings
    "8": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "res_multistep",
        "scheduler": "simple",
        "denoise": 1.0,
        "model": ["2", 0],  // Model with LoRA applied
        "positive": ["5", 0],
        "negative": ["6", 0],
        "latent_image": ["7", 0]
      }
    },

    // Node 9: VAE Decode
    "9": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["8", 0],
        "vae": ["4", 0]
      }
    },

    // Node 10: Save Image
    "10": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["9", 0]
      }
    }
  };
}

async function queuePrompt(workflow, serverUrl = COMFYUI_URL) {
  const clientId = randomUUID();
  const res = await fetch(`${serverUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Queue failed: ${JSON.stringify(error)}`);
  }
  return res.json();
}

async function waitForCompletion(promptId, wsUrl = WS_URL, onProgress = null) {
  return new Promise((resolve, reject) => {
    const clientId = randomUUID();
    const ws = new WebSocket(`${wsUrl}?clientId=${clientId}`);

    let timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Generation timeout (15 minutes)'));
    }, 15 * 60 * 1000);

    ws.on('open', () => {
      console.log('WebSocket connected, waiting for generation...');
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'progress' && onProgress) {
          onProgress({
            node: message.data.node,
            value: message.data.value,
            max: message.data.max,
          });
        }

        if (message.type === 'executing' && message.data.node === null) {
          clearTimeout(timeout);
          ws.close();
          const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
          const history = await historyRes.json();
          resolve(history[promptId]);
        }

        if (message.type === 'execution_error') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Execution error: ${JSON.stringify(message.data)}`));
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function downloadImage(filename, subfolder = '', type = 'output') {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFYUI_URL}/view?${params}`);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  return res.arrayBuffer();
}

async function checkConnection() {
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      connected: true,
      version: data.system?.comfyui_version,
      device: data.devices?.[0]?.name || 'unknown',
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function main() {
  console.log('🎨 Elena LoRA v3 Test - iPhone 16 Pro Style\n');
  console.log(`ComfyUI URL: ${COMFYUI_URL}`);
  console.log(`LoRA: ${MODELS.lora}\n`);

  // Check connection
  const status = await checkConnection();
  if (!status.connected) {
    console.error(`❌ ComfyUI not accessible: ${status.error}`);
    console.log('\n💡 Start ComfyUI locally first:');
    console.log('   cd ~/ComfyUI && python main.py');
    process.exit(1);
  }

  console.log(`✅ Connected to ComfyUI ${status.version}`);
  console.log(`   Device: ${status.device}\n`);

  // iPhone 16 Pro style prompts - natural, casual, social media ready
  const testPrompts = [
    {
      name: 'casual_selfie',
      prompt: `elena, casual iPhone selfie in a coffee shop,
natural morning light through window, warm brown eyes, soft smile,
wearing casual white t-shirt, hair slightly messy, authentic candid moment,
iPhone 16 Pro photo, natural skin texture, soft bokeh background,
realistic lighting, slight depth of field, crisp detail, vivid but natural colors`,
      negativePrompt: 'artificial, overprocessed, heavy makeup, studio lighting, posed, fake',
    },
    {
      name: 'golden_hour',
      prompt: `elena, outdoor portrait at golden hour,
warm sunlight on face, natural glow, relaxed expression, genuine smile,
wearing simple summer dress, wind in hair, Parisian street background,
shot on iPhone 16 Pro, natural color grading, soft shadows,
authentic candid photo, social media aesthetic, shallow depth of field`,
      negativePrompt: 'overexposed, harsh shadows, unnatural colors, overly edited',
    },
    {
      name: 'casual_home',
      prompt: `elena, relaxed at home on couch,
cozy indoor lighting, natural pose, looking at camera with soft smile,
wearing comfortable loungewear, hair down, minimal makeup,
iPhone 16 Pro photo, intimate casual moment, natural skin,
soft warm tones, slight grain, authentic lifestyle photo`,
      negativePrompt: 'studio, professional, posed, heavy editing, artificial',
    },
  ];

  // Test settings to try
  const testSettings = [
    { loraWeight: 0.7, cfg: 3.5, name: 'w0.7_cfg3.5' },
    { loraWeight: 0.8, cfg: 3.5, name: 'w0.8_cfg3.5' },
    { loraWeight: 0.8, cfg: 4.0, name: 'w0.8_cfg4.0' },
  ];

  // Test different LoRA weights
  const promptConfig = {
    name: 'elena_cafe',
    prompt: `elena, a beautiful 28-year-old French influencer woman,
light brown wavy hair with blonde highlights, full lips, high cheekbones, angular face,
casual iPhone selfie in a Parisian cafe, golden morning light,
wearing beige cashmere sweater, gold chain necklace,
natural confident smile, looking at camera,
iPhone 16 Pro photo, natural skin, soft bokeh background,
authentic candid moment, warm tones, slight depth of field`,
    negativePrompt: 'dark hair, round face, pale skin, heavy makeup, artificial',
  };

  // Get weight from command line args or default to 1.0
  const loraWeight = parseFloat(process.argv[2]) || 1.0;
  const cfg = parseFloat(process.argv[3]) || 3.0;
  const settings = { loraWeight, cfg, name: `w${loraWeight}_cfg${cfg}` };

  console.log('📝 Test Configuration:');
  console.log(`   Prompt: ${promptConfig.name}`);
  console.log(`   LoRA Weight: ${settings.loraWeight}`);
  console.log(`   CFG: ${settings.cfg}`);
  console.log(`   Steps: 30`);
  console.log(`   Resolution: 1024x1344 (3:4 portrait)\n`);

  const workflow = buildElenaLoraWorkflow({
    prompt: promptConfig.prompt,
    negativePrompt: promptConfig.negativePrompt,
    loraWeight: settings.loraWeight,
    cfg: settings.cfg,
    steps: 30,
    filenamePrefix: `elena_v3_${promptConfig.name}_${settings.name}`,
  });

  console.log('⏳ Queueing prompt...');
  const { prompt_id } = await queuePrompt(workflow);
  console.log(`   Prompt ID: ${prompt_id}\n`);

  console.log('🔄 Generating...');
  const result = await waitForCompletion(prompt_id, WS_URL, (progress) => {
    const pct = Math.round((progress.value / progress.max) * 100);
    process.stdout.write(`\r   Progress: ${pct}% (${progress.value}/${progress.max})`);
  });
  console.log('\n');

  const outputs = result.outputs;
  const saveNode = Object.values(outputs).find(o => o.images);

  if (!saveNode || !saveNode.images.length) {
    throw new Error('No images in output');
  }

  const image = saveNode.images[0];
  console.log(`✅ Generated: ${image.filename}`);

  // Save locally
  const localPath = path.join(process.cwd(), `elena_v3_${promptConfig.name}.png`);
  const buffer = await downloadImage(image.filename, image.subfolder || '', image.type || 'output');
  fs.writeFileSync(localPath, Buffer.from(buffer));

  console.log(`💾 Saved: ${localPath}`);
  console.log('\n🎉 Test complete! Check the image for Elena resemblance.');
  console.log('\n📊 Settings used:');
  console.log(`   Model: Z-Image Full (Comfy-Org 12.3GB)`);
  console.log(`   LoRA: elena_zimage_v3_comfyorg.safetensors`);
  console.log(`   Weight: ${settings.loraWeight}, CFG: ${settings.cfg}, Steps: 30`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.message.includes('LoraLoaderModelOnly')) {
    console.log('\n💡 Try using "LoraLoader" instead of "LoraLoaderModelOnly"');
  }
  process.exit(1);
});
