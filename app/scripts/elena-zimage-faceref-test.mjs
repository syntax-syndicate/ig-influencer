#!/usr/bin/env node
/**
 * Elena Z-Image Face Reference Test
 *
 * Tests Z-Image Full model with Elena face reference via native image conditioning.
 * Z-Image supports up to 3 reference images directly in its text encoder.
 *
 * Run: node app/scripts/elena-zimage-faceref-test.mjs
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
  unet: 'z_image_bf16.safetensors',
  clip: 'qwen_3_4b.safetensors',
  vae: 'ae.safetensors',
  clipVision: 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors',
  faceRef: 'elena_face_ref.jpg',
};

/**
 * Build Z-Image workflow with face reference
 */
function buildZImageFaceRefWorkflow(options = {}) {
  const {
    prompt = 'A beautiful 24 year old French woman with natural wavy brown hair, warm brown eyes, natural skin texture. Elegant portrait in soft natural lighting, photorealistic, 8k uhd, professional photography.',
    width = 1024,
    height = 1024,
    steps = 30,
    cfg = 4.0,
    seed = Math.floor(Math.random() * 1000000000),
    filenamePrefix = 'elena_zimage_faceref',
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

    // Node 2: Load CLIP (Qwen 3.4B for Z-Image)
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": MODELS.clip,
        "type": "qwen_image"
      }
    },

    // Node 3: Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": MODELS.vae
      }
    },

    // Node 4: Load CLIP Vision (for image conditioning)
    "4": {
      "class_type": "CLIPVisionLoader",
      "inputs": {
        "clip_name": MODELS.clipVision
      }
    },

    // Node 5: Load Elena face reference image
    "5": {
      "class_type": "LoadImage",
      "inputs": {
        "image": MODELS.faceRef
      }
    },

    // Node 6: Text Encode with Z-Image Omni (includes image conditioning)
    "6": {
      "class_type": "TextEncodeZImageOmni",
      "inputs": {
        "clip": ["2", 0],
        "prompt": prompt,
        "auto_resize_images": true,
        "image_encoder": ["4", 0],
        "vae": ["3", 0],
        "image1": ["5", 0]
      }
    },

    // Node 7: Empty conditioning for negative
    "7": {
      "class_type": "TextEncodeZImageOmni",
      "inputs": {
        "clip": ["2", 0],
        "prompt": "blurry, low quality, bad anatomy, deformed, ugly, cartoon, anime, illustration, worst quality",
        "auto_resize_images": true
      }
    },

    // Node 8: Empty Latent Image (Qwen/Z-Image style)
    "8": {
      "class_type": "EmptyQwenImageLayeredLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "layers": 3,
        "batch_size": 1
      }
    },

    // Node 9: KSampler
    "9": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1.0,
        "model": ["1", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["8", 0]
      }
    },

    // Node 10: VAE Decode
    "10": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["9", 0],
        "vae": ["3", 0]
      }
    },

    // Node 11: Save Image
    "11": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["10", 0]
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
  console.log('🎨 Elena Z-Image Face Reference Test\n');
  console.log(`ComfyUI URL: ${COMFYUI_URL}`);

  // Check connection
  const status = await checkConnection();
  if (!status.connected) {
    console.error(`❌ ComfyUI not accessible: ${status.error}`);
    console.log('\nMake sure the SSH tunnel is active or set VASTAI_COMFYUI_HOST/PORT');
    process.exit(1);
  }

  console.log(`✅ Connected to ComfyUI ${status.version}`);
  console.log(`   Device: ${status.device}\n`);

  // Build workflow
  const prompt = `A beautiful 24 year old French woman with natural wavy brown hair, warm brown eyes, soft glowing skin.
Elegant portrait in soft window light, wearing a simple white cotton blouse.
Natural pose, genuine warm smile, professional photography.
8k uhd, photorealistic, shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field.`;

  console.log('📝 Prompt:', prompt.slice(0, 100) + '...');
  console.log('🖼️  Face reference: elena_face_ref.jpg\n');

  const workflow = buildZImageFaceRefWorkflow({
    prompt,
    width: 1024,
    height: 1024,
    steps: 30,
    cfg: 4.0,
    filenamePrefix: 'elena_zimage_faceref',
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
  const localPath = path.join(process.cwd(), 'elena_zimage_faceref_test.png');
  const buffer = await downloadImage(image.filename, image.subfolder || '', image.type || 'output');
  fs.writeFileSync(localPath, Buffer.from(buffer));

  console.log(`💾 Saved locally: ${localPath}`);
  console.log('\n🎉 Test complete!');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
