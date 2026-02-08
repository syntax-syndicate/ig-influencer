#!/usr/bin/env node
/**
 * Chroma1-HD Test Script
 *
 * Tests Chroma model quality on Vast.ai for realistic/NSFW generation
 *
 * Setup on Vast.ai pod:
 * 1. SSH into the pod
 * 2. Run the setup commands below
 * 3. Start ComfyUI
 * 4. Run this script to generate test images
 *
 * Usage:
 *   node app/scripts/chroma-test.mjs
 *   node app/scripts/chroma-test.mjs --nsfw
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const CONFIG = {
  // ComfyUI server (will be Vast.ai pod)
  comfyuiUrl: process.env.COMFYUI_URL || 'http://localhost:8188',
  outputDir: path.join(__dirname, '../../chroma_tests'),
};

// Chroma recommended settings from guide
const CHROMA_SETTINGS = {
  steps: 30,           // 25-35 recommended
  cfg: 3.5,            // 3.0-4.0 recommended
  sampler: 'deis_2m',  // or 'dpmpp_sde_2s'
  scheduler: 'beta',   // beta57 for best results
  width: 1024,
  height: 1024,
};

// Test prompts
const TEST_PROMPTS = {
  sfw: {
    natural: 'candid amateur photograph of a beautiful woman with pouty lips, high cheekbones, hazel-green eyes, natural morning light, Instagram photo, analog film photo, grainy, Kodachrome',
    portrait: 'professional portrait photo of a woman, 25 years old, natural skin texture with pores and freckles, soft studio lighting, posted on Reddit, 35mm photo',
    casual: 'iPhone selfie of an attractive brunette woman at a coffee shop, natural look, no makeup, candid shot, warm lighting',
  },
  nsfw: {
    sensual: 'analog film photo of a beautiful nude woman lying on bed, natural body, realistic skin texture with pores, soft morning light through window, artistic boudoir, grainy, 35mm',
    explicit: 'amateur photograph of attractive nude woman in shower, wet skin, water droplets, natural lighting, candid shot, real amateur photo',
  }
};

// Chroma workflow (FLUX-based architecture)
function createChromaWorkflow(prompt, negative = '', settings = CHROMA_SETTINGS) {
  return {
    "3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000000000),
        "steps": settings.steps,
        "cfg": settings.cfg,
        "sampler_name": settings.sampler,
        "scheduler": settings.scheduler,
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler",
      "_meta": { "title": "KSampler" }
    },
    "4": {
      "inputs": {
        "unet_name": "chroma1-hd.safetensors"
      },
      "class_type": "UNETLoader",
      "_meta": { "title": "Load Diffusion Model" }
    },
    "5": {
      "inputs": {
        "width": settings.width,
        "height": settings.height,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage",
      "_meta": { "title": "Empty Latent Image" }
    },
    "6": {
      "inputs": {
        "text": prompt,
        "clip": ["11", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Prompt)" }
    },
    "7": {
      "inputs": {
        "text": negative,
        "clip": ["11", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Negative)" }
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["10", 0]
      },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE Decode" }
    },
    "9": {
      "inputs": {
        "filename_prefix": "chroma_test",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": { "title": "Save Image" }
    },
    "10": {
      "inputs": {
        "vae_name": "ae.safetensors"
      },
      "class_type": "VAELoader",
      "_meta": { "title": "Load VAE" }
    },
    "11": {
      "inputs": {
        "clip_name": "t5xxl_fp16.safetensors",
        "type": "flux"
      },
      "class_type": "CLIPLoader",
      "_meta": { "title": "Load CLIP" }
    }
  };
}

async function queuePrompt(workflow) {
  const response = await fetch(`${CONFIG.comfyuiUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });

  if (!response.ok) {
    throw new Error(`Failed to queue prompt: ${response.statusText}`);
  }

  return response.json();
}

async function waitForCompletion(promptId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${CONFIG.comfyuiUrl.replace('http', 'ws')}/ws`);

    ws.on('message', (data) => {
      const message = JSON.parse(data);

      if (message.type === 'executing' && message.data.node === null && message.data.prompt_id === promptId) {
        ws.close();
        resolve();
      }

      if (message.type === 'progress') {
        process.stdout.write(`\r  Progress: ${message.data.value}/${message.data.max}`);
      }
    });

    ws.on('error', reject);
    ws.on('close', () => setTimeout(resolve, 1000));
  });
}

async function getHistory(promptId) {
  const response = await fetch(`${CONFIG.comfyuiUrl}/history/${promptId}`);
  return response.json();
}

async function downloadImage(filename, outputPath) {
  const response = await fetch(`${CONFIG.comfyuiUrl}/view?filename=${filename}&type=output`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`  Saved: ${outputPath}`);
}

async function runTest(name, prompt, settings = CHROMA_SETTINGS) {
  console.log(`\n🎨 Test: ${name}`);
  console.log(`  Prompt: ${prompt.substring(0, 80)}...`);
  console.log(`  Settings: ${settings.steps} steps, CFG ${settings.cfg}, ${settings.sampler}/${settings.scheduler}`);

  const workflow = createChromaWorkflow(prompt, '', settings);

  try {
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`  Queued: ${prompt_id}`);

    await waitForCompletion(prompt_id);
    console.log('\n  ✅ Generation complete');

    // Get the output filename
    const history = await getHistory(prompt_id);
    const outputs = history[prompt_id]?.outputs;

    if (outputs && outputs['9']?.images) {
      const image = outputs['9'].images[0];
      const outputPath = path.join(CONFIG.outputDir, `${name}.png`);
      await downloadImage(image.filename, outputPath);
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runNsfw = args.includes('--nsfw');

  console.log('🔮 Chroma1-HD Test Suite');
  console.log('========================\n');

  // Check ComfyUI connection
  try {
    const response = await fetch(`${CONFIG.comfyuiUrl}/system_stats`);
    if (!response.ok) throw new Error('Not responding');
    console.log(`✅ Connected to ComfyUI: ${CONFIG.comfyuiUrl}`);
  } catch (error) {
    console.error(`❌ Cannot connect to ComfyUI at ${CONFIG.comfyuiUrl}`);
    console.error('\nMake sure:');
    console.error('  1. Vast.ai pod is running with ComfyUI');
    console.error('  2. Set COMFYUI_URL in .env.local (e.g., http://IP:8188)');
    console.error('  3. Chroma models are downloaded (see setup instructions below)\n');
    printSetupInstructions();
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Run SFW tests
  console.log('\n📸 Running SFW tests...');
  for (const [name, prompt] of Object.entries(TEST_PROMPTS.sfw)) {
    await runTest(`chroma_sfw_${name}`, prompt);
  }

  // Run NSFW tests if requested
  if (runNsfw) {
    console.log('\n🔞 Running NSFW tests...');
    for (const [name, prompt] of Object.entries(TEST_PROMPTS.nsfw)) {
      await runTest(`chroma_nsfw_${name}`, prompt);
    }
  }

  console.log('\n✨ Tests complete!');
  console.log(`   Output: ${CONFIG.outputDir}`);
}

function printSetupInstructions() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    CHROMA SETUP INSTRUCTIONS                        ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  1. Create Vast.ai instance:                                        ║
║     node app/scripts/vastai-connect.mjs                             ║
║                                                                     ║
║  2. SSH into the pod and run these commands:                        ║
║                                                                     ║
║     # Install ComfyUI                                               ║
║     cd /workspace                                                   ║
║     git clone https://github.com/comfyanonymous/ComfyUI.git comfyui ║
║     cd comfyui && pip install -r requirements.txt                   ║
║                                                                     ║
║     # Download Chroma1-HD model (~17GB)                             ║
║     wget -O models/diffusion_models/chroma1-hd.safetensors \\        ║
║       "https://huggingface.co/lodestones/Chroma1-HD/resolve/main/chroma1-hd.safetensors"
║                                                                     ║
║     # Download T5 XXL text encoder (~10GB)                          ║
║     wget -O models/clip/t5xxl_fp16.safetensors \\                    ║
║       "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors"
║                                                                     ║
║     # Download FLUX VAE (~335MB)                                    ║
║     wget -O models/vae/ae.safetensors \\                             ║
║       "https://huggingface.co/lodestones/Chroma/resolve/main/ae.safetensors"
║                                                                     ║
║     # Start ComfyUI                                                 ║
║     python main.py --listen 0.0.0.0 --port 8188                     ║
║                                                                     ║
║  3. Set COMFYUI_URL in app/.env.local:                              ║
║     COMFYUI_URL=http://<POD_IP>:8188                                ║
║                                                                     ║
║  4. Run this script again:                                          ║
║     node app/scripts/chroma-test.mjs                                ║
║     node app/scripts/chroma-test.mjs --nsfw                         ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝

CHROMA PARAMETERS (from guide):
  - Steps: 25-35 (30 default)
  - CFG: 3.0-4.0 (3.5 default)
  - Sampler: deis_2m, dpmpp_sde_2s, euler
  - Scheduler: beta (beta57 recommended)

PROMPTING TIPS:
  - Use "analog film photo, 35mm, grainy, Kodachrome" for realistic look
  - Add "posted on Reddit", "Instagram photo" for context
  - Describe lighting: "natural morning light", "soft studio"
  - Avoid SD1.5 keywords like "hyper-realistic"
`);
}

main().catch(console.error);
