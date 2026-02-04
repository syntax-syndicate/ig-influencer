/**
 * HiDream-I1 Test Script
 *
 * Tests:
 * 1. Basic generation with HiDream-I1-Fast FP8
 * 2. NSFW content generation
 * 3. Skin quality comparison
 * 4. Face consistency (with IP-Adapter if available)
 *
 * Usage:
 *   COMFYUI_URL=http://IP:8188 node app/scripts/hidream-test.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://79.116.93.241:8188';

// HiDream-I1 workflow - uses QuadrupleCLIPLoader for 4 text encoders
const createHiDreamWorkflow = (prompt, negativePrompt = '', seed = null) => ({
  // Load diffusion model
  "1": {
    "class_type": "UNETLoader",
    "inputs": {
      "unet_name": "hidream_i1_fast_fp8.safetensors",
      "weight_dtype": "fp8_e4m3fn"
    }
  },
  // Load 4 text encoders with QuadrupleCLIPLoader
  "2": {
    "class_type": "QuadrupleCLIPLoader",
    "inputs": {
      "clip_name1": "clip_l_hidream.safetensors",
      "clip_name2": "clip_g_hidream.safetensors",
      "clip_name3": "t5xxl_fp8_e4m3fn_scaled.safetensors",
      "clip_name4": "llama_3.1_8b_instruct_fp8_scaled.safetensors",
      "type": "hidream"
    }
  },
  // Load VAE
  "3": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "ae.safetensors"
    }
  },
  // Positive prompt
  "4": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": prompt,
      "clip": ["2", 0]
    }
  },
  // Negative prompt
  "5": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": negativePrompt || "ugly, deformed, bad anatomy, bad hands, missing fingers, extra fingers, blurry, low quality, watermark, text, logo, cartoon, anime, illustration, painting, drawing, cgi, 3d render",
      "clip": ["2", 0]
    }
  },
  // Empty latent
  "6": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    }
  },
  // ModelSamplingSD3 - required for HiDream
  "7": {
    "class_type": "ModelSamplingSD3",
    "inputs": {
      "model": ["1", 0],
      "shift": 3.0
    }
  },
  // KSampler - HiDream-Fast uses 16 steps, CFG 1.0
  "8": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["7", 0],
      "positive": ["4", 0],
      "negative": ["5", 0],
      "latent_image": ["6", 0],
      "seed": seed || Math.floor(Math.random() * 1000000000),
      "steps": 16,
      "cfg": 1.0,  // Critical for distilled models
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1.0
    }
  },
  // VAE Decode
  "9": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["8", 0],
      "vae": ["3", 0]
    }
  },
  // Save image
  "10": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["9", 0],
      "filename_prefix": "hidream_test"
    }
  }
});

async function queuePrompt(workflow) {
  const response = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Queue failed: ${response.status} - ${text}`);
  }

  return response.json();
}

async function waitForCompletion(promptId, timeoutMs = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    const history = await response.json();

    if (history[promptId]) {
      const outputs = history[promptId].outputs;
      if (outputs && Object.keys(outputs).length > 0) {
        return history[promptId];
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error('Generation timed out');
}

async function downloadImage(filename, subfolder, outputPath) {
  const url = `${COMFYUI_URL}/view?filename=${filename}&subfolder=${subfolder}&type=output`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`  Saved: ${outputPath}`);
}

async function runTest(name, prompt, negativePrompt = '', outputName = null) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);

  const startTime = Date.now();

  try {
    const workflow = createHiDreamWorkflow(prompt, negativePrompt);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`  Queued: ${prompt_id}`);

    const result = await waitForCompletion(prompt_id);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Completed in ${elapsed}s`);

    // Find and download output image
    const outputs = result.outputs;
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          const outDir = path.join(__dirname, '..', '..', 'app', 'hidream_tests');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          const outName = outputName || `hidream_${name.toLowerCase().replace(/\s+/g, '_')}.png`;
          const outPath = path.join(outDir, outName);
          await downloadImage(img.filename, img.subfolder || '', outPath);
        }
      }
    }

    return { success: true, elapsed };
  } catch (error) {
    console.log(`  ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('HiDream-I1 Test Suite');
  console.log(`ComfyUI URL: ${COMFYUI_URL}`);

  // Ensure output directory exists
  const outDir = path.join(__dirname, '..', 'hidream_tests');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = [];

  // Test 1: Basic portrait (SFW)
  results.push(await runTest(
    'Basic Portrait',
    'beautiful woman, portrait photography, soft natural lighting, detailed skin texture, photorealistic, high quality, 8k',
    '',
    'hidream_basic_portrait.png'
  ));

  // Test 2: NSFW - Topless
  results.push(await runTest(
    'NSFW Topless',
    'beautiful woman, topless, natural breasts, standing on beach, sunset lighting, photorealistic, detailed skin, 8k',
    'clothed, covered, censored',
    'hidream_nsfw_topless.png'
  ));

  // Test 3: NSFW - Nude
  results.push(await runTest(
    'NSFW Nude',
    'beautiful nude woman, full body, lying on white bed sheets, soft diffused daylight, intimate bedroom, photorealistic, detailed skin texture, natural pose, 8k',
    'clothed, covered, censored',
    'hidream_nsfw_nude.png'
  ));

  // Test 4: Skin quality comparison prompt (same as BigLove test)
  results.push(await runTest(
    'Skin Quality Test',
    'closeup portrait of beautiful woman, freckles, natural skin texture, pores visible, golden hour lighting, shallow depth of field, photorealistic, 8k, detailed skin',
    'smooth skin, airbrushed, plastic, porcelain',
    'hidream_skin_quality.png'
  ));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Tests passed: ${passed}/${results.length}`);
  console.log(`Tests failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.forEach((r, i) => {
      if (!r.success) console.log(`  - Test ${i + 1}: ${r.error}`);
    });
  }

  console.log('\nImages saved to: app/hidream_tests/');
}

main().catch(console.error);
