/**
 * Elena Tile Upscale - ControlNet Tile for High-Quality Detail Enhancement
 *
 * Two-pass workflow:
 * 1. Generate at 1024x1024 with LoRA
 * 2. Upscale to 2048x2048 with bicubic
 * 3. ControlNet Tile + img2img with low denoise (0.35) to add realistic detail
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

const workflow = {
  // === PASS 1: Generate base image ===

  // Load checkpoint
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "bigLove_xl1.safetensors"
    }
  },
  // Load LoRA
  "2": {
    "class_type": "LoraLoader",
    "inputs": {
      "lora_name": "elena_v5_biglove_native.safetensors",
      "strength_model": 1.1,
      "strength_clip": 1.1,
      "model": ["1", 0],
      "clip": ["1", 1]
    }
  },
  // Positive prompt
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "elena, beautiful woman, natural breasts D cup, completely naked, lying on bed, head on pillow, looking at camera, seductive gaze, soft smile, white silk sheets, hands on sheets, soft diffused daylight from window, intimate bedroom, detailed skin texture, detailed face, photorealistic, 8k, high quality",
      "clip": ["2", 1]
    }
  },
  // Negative prompt
  "4": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "small breasts, flat chest, ugly, deformed, bad anatomy, bad hands, missing fingers, extra fingers, blurry, low quality, watermark, text, logo, cartoon, anime, illustration, painting, drawing, cgi, 3d render, doll, plastic, mannequin",
      "clip": ["2", 1]
    }
  },
  // Empty latent for first pass
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    }
  },
  // First KSampler - generate base image
  "10": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["2", 0],
      "positive": ["3", 0],
      "negative": ["4", 0],
      "latent_image": ["5", 0],
      "seed": Math.floor(Math.random() * 1000000000),
      "steps": 25,
      "cfg": 4.0,
      "sampler_name": "dpmpp_2m_sde",
      "scheduler": "karras",
      "denoise": 1.0
    }
  },
  // Decode first pass
  "11": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["10", 0],
      "vae": ["1", 2]
    }
  },

  // === PASS 2: ControlNet Tile upscale ===

  // Upscale image with bicubic (simple, no AI)
  "20": {
    "class_type": "ImageScaleBy",
    "inputs": {
      "image": ["11", 0],
      "upscale_method": "bicubic",
      "scale_by": 2.0
    }
  },
  // Load ControlNet Tile
  "21": {
    "class_type": "ControlNetLoader",
    "inputs": {
      "control_net_name": "controlnet-tile-sdxl.safetensors"
    }
  },
  // Apply ControlNet Tile
  "22": {
    "class_type": "ControlNetApplyAdvanced",
    "inputs": {
      "positive": ["3", 0],
      "negative": ["4", 0],
      "control_net": ["21", 0],
      "image": ["20", 0],
      "strength": 0.6,
      "start_percent": 0.0,
      "end_percent": 1.0
    }
  },
  // Encode upscaled image to latent for img2img
  "23": {
    "class_type": "VAEEncode",
    "inputs": {
      "pixels": ["20", 0],
      "vae": ["1", 2]
    }
  },
  // Second KSampler - add detail with low denoise
  "30": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["2", 0],
      "positive": ["22", 0],
      "negative": ["22", 1],
      "latent_image": ["23", 0],
      "seed": Math.floor(Math.random() * 1000000000),
      "steps": 20,
      "cfg": 4.0,
      "sampler_name": "dpmpp_2m_sde",
      "scheduler": "karras",
      "denoise": 0.15
    }
  },
  // Decode final
  "31": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["30", 0],
      "vae": ["1", 2]
    }
  },
  // Save
  "40": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["31", 0],
      "filename_prefix": "elena_tile_upscale"
    }
  }
};

async function queuePrompt(prompt) {
  const response = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  return response.json();
}

async function getHistory(promptId) {
  const response = await fetch(`${COMFYUI_URL}/history/${promptId}`);
  return response.json();
}

async function waitForCompletion(promptId, maxWaitMs = 600000) {
  const startTime = Date.now();
  console.log(`⏳ Waiting for generation (max ${maxWaitMs/1000}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    const history = await getHistory(promptId);

    if (history[promptId]) {
      const status = history[promptId].status;
      if (status?.completed) {
        return { success: true, history: history[promptId] };
      }
      if (status?.status_str === 'error') {
        return { success: false, error: 'Generation failed', history: history[promptId] };
      }
    }

    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write('.');
  }

  return { success: false, error: 'Timeout' };
}

async function main() {
  console.log('🎨 Elena Tile Upscale - ControlNet Detail Enhancement');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Workflow:');
  console.log('   1. Generate 1024x1024 with LoRA 1.1');
  console.log('   2. Upscale 2x with bicubic (→ 2048x2048)');
  console.log('   3. ControlNet Tile + img2img (denoise 0.15)');
  console.log('   → Model adds realistic skin/hair/fabric detail');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check ComfyUI
  try {
    await fetch(`${COMFYUI_URL}/system_stats`);
    console.log('✅ ComfyUI connected\n');
  } catch (e) {
    console.error('❌ ComfyUI not running at', COMFYUI_URL);
    process.exit(1);
  }

  // Queue the prompt
  console.log('🚀 Queueing generation...');
  const result = await queuePrompt(workflow);

  if (result.error) {
    console.error('❌ Queue error:', result.error);
    if (result.node_errors) {
      console.error('Node errors:', JSON.stringify(result.node_errors, null, 2));
    }
    process.exit(1);
  }

  const promptId = result.prompt_id;
  console.log(`📝 Prompt ID: ${promptId}\n`);

  // Wait for completion
  const completion = await waitForCompletion(promptId);
  console.log('\n');

  if (completion.success) {
    console.log('✅ Generation complete!');

    // Find output files
    const outputs = completion.history.outputs;
    for (const [nodeId, output] of Object.entries(outputs)) {
      if (output.images) {
        for (const img of output.images) {
          console.log(`📷 Output: ~/ComfyUI/output/${img.filename}`);
        }
      }
    }
  } else {
    console.error('❌ Generation failed:', completion.error);
    if (completion.history) {
      console.error('Details:', JSON.stringify(completion.history, null, 2));
    }
  }
}

main().catch(console.error);
