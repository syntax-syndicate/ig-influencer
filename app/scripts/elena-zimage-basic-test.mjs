#!/usr/bin/env node
/**
 * Elena Z-Image Basic Test (no face reference)
 *
 * Tests Z-Image Full model with a simple prompt to verify the workflow.
 *
 * Run: node app/scripts/elena-zimage-basic-test.mjs
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Vast.ai ComfyUI connection
const COMFYUI_HOST = process.env.VASTAI_COMFYUI_HOST || 'localhost';
const COMFYUI_PORT = process.env.VASTAI_COMFYUI_PORT || '8188';
const COMFYUI_URL = `http://${COMFYUI_HOST}:${COMFYUI_PORT}`;
const WS_URL = `ws://${COMFYUI_HOST}:${COMFYUI_PORT}/ws`;

// Model paths (as they appear in ComfyUI after download)
const MODELS = {
  unet: 'z_image_turbo_bf16.safetensors',
  clip: 'qwen_3_4b.safetensors',
  vae: 'ae.safetensors',
};

/**
 * Build simple Z-Image workflow (text-to-image only)
 * Uses standard nodes with Z-Image specific settings:
 * - 8 steps (Turbo is optimized for few steps)
 * - CFG 1.0 (distilled model, no guidance needed)
 * - euler_ancestral sampler with sgm_uniform scheduler
 * - lumina2 CLIP type for Qwen text encoder
 */
function buildZImageBasicWorkflow(options = {}) {
  const {
    prompt = 'A beautiful young woman with brown hair, elegant portrait, soft lighting',
    width = 1024,
    height = 1024,
    steps = 8,  // Z-Image Turbo optimal
    cfg = 1.0,  // Distilled model, no guidance
    seed = Math.floor(Math.random() * 1000000000),
    filenamePrefix = 'elena_zimage_basic',
  } = options;

  return {
    // Node 1: Load Diffusion Model (Z-Image UNet)
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": MODELS.unet,
        "weight_dtype": "default"
      }
    },

    // Node 2: Load CLIP (Qwen 3.4B with lumina2 type for Z-Image)
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": MODELS.clip,
        "type": "lumina2"
      }
    },

    // Node 3: Load VAE (Flux VAE)
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": MODELS.vae
      }
    },

    // Node 4: Positive prompt encoding (standard CLIP encode)
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["2", 0],
        "text": prompt
      }
    },

    // Node 5: Negative prompt encoding (empty for Z-Image)
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["2", 0],
        "text": ""
      }
    },

    // Node 6: Empty Latent Image (standard, 1024x1024)
    "6": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },

    // Node 7: KSampler (Z-Image optimal settings)
    "7": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler_ancestral",
        "scheduler": "sgm_uniform",
        "denoise": 1.0,
        "model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["6", 0]
      }
    },

    // Node 8: VAE Decode
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["7", 0],
        "vae": ["3", 0]
      }
    },

    // Node 9: Save Image
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["8", 0]
      }
    }
  };
}

/**
 * Queue a prompt for generation
 */
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

/**
 * Wait for a prompt to complete using WebSocket
 */
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
          // Generation complete
          clearTimeout(timeout);
          ws.close();

          // Fetch the result
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
        // Ignore parse errors for binary data
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Download image from ComfyUI
 */
async function downloadImage(filename, subfolder = '', type = 'output') {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFYUI_URL}/view?${params}`);

  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);

  return res.arrayBuffer();
}

/**
 * Check ComfyUI connection
 */
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
  console.log('🎨 Elena Z-Image Basic Test (no face reference)\n');
  console.log(`ComfyUI URL: ${COMFYUI_URL}`);

  // Check connection
  const status = await checkConnection();
  if (!status.connected) {
    console.error(`❌ ComfyUI not accessible: ${status.error}`);
    process.exit(1);
  }

  console.log(`✅ Connected to ComfyUI ${status.version}`);
  console.log(`   Device: ${status.device}\n`);

  // Build workflow
  const prompt = `A beautiful 24 year old French woman with natural wavy brown hair, warm brown eyes, soft glowing skin.
Elegant portrait in soft window light, wearing a simple white cotton blouse.
Natural pose, genuine warm smile, professional photography.
8k uhd, photorealistic, shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field.`;

  console.log('📝 Prompt:', prompt.slice(0, 100) + '...\n');

  const workflow = buildZImageBasicWorkflow({
    prompt,
    width: 1024,
    height: 1024,
    steps: 30,
    cfg: 4.0,
    filenamePrefix: 'elena_zimage_basic',
  });

  // Queue the prompt
  console.log('⏳ Queueing prompt...');
  const { prompt_id } = await queuePrompt(workflow);
  console.log(`   Prompt ID: ${prompt_id}\n`);

  // Wait for completion with progress
  console.log('🔄 Generating...');
  const result = await waitForCompletion(prompt_id, WS_URL, (progress) => {
    const pct = Math.round((progress.value / progress.max) * 100);
    process.stdout.write(`\r   Progress: ${pct}% (${progress.value}/${progress.max})`);
  });
  console.log('\n');

  // Get output filename
  const outputs = result.outputs;
  const saveNode = Object.values(outputs).find(o => o.images);

  if (!saveNode || !saveNode.images.length) {
    throw new Error('No images in output');
  }

  const image = saveNode.images[0];
  console.log(`✅ Generated: ${image.filename}`);

  // Download and save locally
  const localPath = path.join(process.cwd(), 'elena_zimage_basic_test.png');
  const buffer = await downloadImage(image.filename, image.subfolder || '', image.type || 'output');
  fs.writeFileSync(localPath, Buffer.from(buffer));

  console.log(`💾 Saved locally: ${localPath}`);
  console.log('\n🎉 Test complete!');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
