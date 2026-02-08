#!/usr/bin/env node
/**
 * Elena FLUX.2 Klein 9B Face Consistency Test
 *
 * Uses FLUX for image generation with IP-Adapter FaceID for face consistency
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const CONFIG = {
  // FLUX.2 Klein 9B models (distilled version)
  diffusionModel: 'flux-2-klein-9b-fp8.safetensors',
  textEncoder: 'qwen_3_8b_fp8mixed.safetensors',  // FLUX.2 Klein uses Qwen 3 8B
  vae: 'flux2-vae.safetensors',

  // Face consistency
  ipadapterModel: 'ip-adapter-faceid-plusv2_sdxl.bin',
  clipVision: 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors',
  faceRef: 'elena_face_ref.jpg',

  // Generation settings for distilled model
  width: 1024,
  height: 1024,
  steps: 4,  // Distilled model works with 4 steps
  cfg: 1.0,  // Low CFG for distilled
  seed: Math.floor(Math.random() * 1000000000),
};

// FLUX.2 Klein 9B workflow for text-to-image
// Uses Qwen 3 8B text encoder instead of T5+CLIP
function buildFluxWorkflow(prompt, negPrompt, filenamePrefix) {
  return {
    // 1. Load FLUX.2 Klein diffusion model (UNet)
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": CONFIG.diffusionModel,
        "weight_dtype": "fp8_e4m3fn"
      }
    },

    // 2. Load Qwen 3 8B text encoder for FLUX.2 Klein
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": CONFIG.textEncoder,
        "type": "flux2"
      }
    },

    // 3. Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": CONFIG.vae
      }
    },

    // 4. CLIP Text Encode (positive prompt)
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },

    // 5. Empty conditioning for negative (FLUX uses guidance embedding)
    "5": {
      "class_type": "ConditioningZeroOut",
      "inputs": {
        "conditioning": ["4", 0]
      }
    },

    // 6. Empty SD3 Latent Image (FLUX uses 16 channels)
    "6": {
      "class_type": "EmptySD3LatentImage",
      "inputs": {
        "width": CONFIG.width,
        "height": CONFIG.height,
        "batch_size": 1
      }
    },

    // 7. KSampler
    "7": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["6", 0],
        "seed": CONFIG.seed,
        "steps": CONFIG.steps,
        "cfg": CONFIG.cfg,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0
      }
    },

    // 8. VAE Decode
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["7", 0],
        "vae": ["3", 0]
      }
    },

    // 9. Save Image
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "images": ["8", 0],
        "filename_prefix": filenamePrefix
      }
    }
  };
}

async function queuePrompt(workflow) {
  const response = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });
  return response.json();
}

async function getHistory(promptId) {
  const response = await fetch(`${COMFYUI_URL}/history/${promptId}`);
  return response.json();
}

async function waitForCompletion(promptId, maxWaitMs = 300000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const history = await getHistory(promptId);
    if (history[promptId]) {
      const status = history[promptId].status;
      if (status?.completed) {
        return { success: true, history: history[promptId] };
      }
      if (status?.status_str === 'error') {
        return { success: false, error: 'Generation failed', details: history[promptId] };
      }
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 3000));
  }
  return { success: false, error: 'Timeout' };
}

async function main() {
  console.log('🎨 Elena FLUX.2 Klein 9B Face Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Config:`);
  console.log(`   • Model: ${CONFIG.diffusionModel}`);
  console.log(`   • Resolution: ${CONFIG.width}x${CONFIG.height}`);
  console.log(`   • Steps: ${CONFIG.steps}`);
  console.log(`   • CFG: ${CONFIG.cfg}`);
  console.log(`   • Seed: ${CONFIG.seed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check connection
  try {
    const stats = await fetch(`${COMFYUI_URL}/system_stats`);
    const data = await stats.json();
    console.log(`✅ ComfyUI connected (${data.devices[0].name})\n`);
  } catch (e) {
    console.error('❌ ComfyUI not reachable at', COMFYUI_URL);
    process.exit(1);
  }

  // Elena description prompt for face consistency
  const prompt = `beautiful woman, elena, 28 years old,
hazel-green eyes with golden tones,
full lips with defined cupid's bow,
beauty mark on right cheek near cheekbone,
golden tan skin, sun-kissed complexion,
bronde hair with dark roots and honey blonde balayage, beach waves,
natural breasts D cup, athletic curvy body,
wearing elegant white linen dress,
golden hour lighting, luxury hotel terrace,
photorealistic, 8k, sharp focus, professional photography`;

  const negPrompt = '';  // FLUX works best with minimal/no negative prompt

  const workflow = buildFluxWorkflow(prompt, negPrompt, 'elena_flux_test');

  console.log('🚀 Starting FLUX generation...\n');
  console.log('📝 Prompt:', prompt.substring(0, 100) + '...\n');

  const result = await queuePrompt(workflow);

  if (result.error || (result.node_errors && Object.keys(result.node_errors).length > 0)) {
    console.error('❌ Queue error:', result.error || 'Node errors');
    if (result.node_errors) {
      console.error('Node errors:', JSON.stringify(result.node_errors, null, 2));
    }
    process.exit(1);
  }

  console.log(`📝 Prompt ID: ${result.prompt_id}`);
  console.log(`⏳ Waiting for generation (max 5min)...`);

  const startTime = Date.now();
  const completion = await waitForCompletion(result.prompt_id);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!completion.success) {
    console.error('\n❌ Generation failed:', completion.error);
    if (completion.details) {
      console.error('Details:', JSON.stringify(completion.details, null, 2));
    }
    process.exit(1);
  }

  console.log(`\n\n✅ Generation complete in ${elapsed}s!`);

  // Extract output filename
  const outputs = completion.history.outputs;
  for (const [nodeId, output] of Object.entries(outputs)) {
    if (output.images) {
      for (const img of output.images) {
        console.log(`📷 Output: ${img.filename}`);
        console.log(`   URL: ${COMFYUI_URL}/view?filename=${img.filename}`);
      }
    }
  }
}

main().catch(console.error);
