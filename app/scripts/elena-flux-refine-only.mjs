#!/usr/bin/env node
/**
 * FLUX Face Refinement Only
 * Takes BigLove output and refines face with FLUX ReferenceLatent
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const CONFIG = {
  inputImage: 'elena_biglove_base_00002_.png',
  faceRef: 'elena_face_ref.jpg',
  steps: 8,
  denoise: 0.35,  // Low to preserve body/lighting
  guidance: 4.0,
};

const workflow = {
  // FLUX models
  "1": {
    "class_type": "UNETLoader",
    "inputs": {
      "unet_name": "flux-2-klein-9b-fp8.safetensors",
      "weight_dtype": "fp8_e4m3fn"
    }
  },
  "2": {
    "class_type": "CLIPLoader",
    "inputs": {
      "clip_name": "qwen_3_8b_fp8mixed.safetensors",
      "type": "flux2"
    }
  },
  "3": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    }
  },

  // Load BigLove output as base
  "4": {
    "class_type": "LoadImage",
    "inputs": {
      "image": CONFIG.inputImage
    }
  },

  // Encode base image to latent
  "5": {
    "class_type": "VAEEncode",
    "inputs": {
      "pixels": ["4", 0],
      "vae": ["3", 0]
    }
  },

  // Load face reference
  "6": {
    "class_type": "LoadImage",
    "inputs": {
      "image": CONFIG.faceRef
    }
  },

  // Encode face reference to latent
  "7": {
    "class_type": "VAEEncode",
    "inputs": {
      "pixels": ["6", 0],
      "vae": ["3", 0]
    }
  },

  // Text prompt describing the face to preserve
  "8": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "same woman, same face, same identity, preserve exact facial features, hazel-green eyes with golden tones, beauty mark on right cheek, full lips with defined cupid's bow, golden tan skin, oval face with high cheekbones, photorealistic",
      "clip": ["2", 0]
    }
  },

  // FluxGuidance
  "9": {
    "class_type": "FluxGuidance",
    "inputs": {
      "conditioning": ["8", 0],
      "guidance": CONFIG.guidance
    }
  },

  // ReferenceLatent - inject face reference
  "10": {
    "class_type": "ReferenceLatent",
    "inputs": {
      "conditioning": ["9", 0],
      "latent": ["7", 0]
    }
  },

  // Negative conditioning
  "11": {
    "class_type": "ConditioningZeroOut",
    "inputs": {
      "conditioning": ["8", 0]
    }
  },

  // KSampler - img2img with low denoise to preserve body/lighting
  "12": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["1", 0],
      "positive": ["10", 0],
      "negative": ["11", 0],
      "latent_image": ["5", 0],  // Start from BigLove image
      "seed": Math.floor(Math.random() * 1000000000),
      "steps": CONFIG.steps,
      "cfg": 1.0,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": CONFIG.denoise
    }
  },

  // VAE Decode
  "13": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["12", 0],
      "vae": ["3", 0]
    }
  },

  // Save final
  "14": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["13", 0],
      "filename_prefix": "elena_biglove_flux_refined"
    }
  }
};

async function queuePrompt(w) {
  const response = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: w })
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
      if (status?.completed) return { success: true, history: history[promptId] };
      if (status?.status_str === 'error') return { success: false, error: 'Generation failed', details: history[promptId] };
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  return { success: false, error: 'Timeout' };
}

async function main() {
  console.log('🎭 FLUX Face Refinement');
  console.log(`   Input: ${CONFIG.inputImage}`);
  console.log(`   Face ref: ${CONFIG.faceRef}`);
  console.log(`   Denoise: ${CONFIG.denoise}`);
  console.log(`   Steps: ${CONFIG.steps}\n`);

  const result = await queuePrompt(workflow);

  if (result.error || (result.node_errors && Object.keys(result.node_errors).length > 0)) {
    console.error('❌ Error:', result.error || JSON.stringify(result.node_errors, null, 2));
    process.exit(1);
  }

  console.log(`📝 Prompt ID: ${result.prompt_id}`);
  console.log('⏳ Waiting...');

  const startTime = Date.now();
  const completion = await waitForCompletion(result.prompt_id);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!completion.success) {
    console.error('\n❌ Failed:', completion.error);
    if (completion.details?.status?.messages) {
      const err = completion.details.status.messages.find(m => m[0] === 'execution_error');
      if (err) console.error(err[1].exception_message);
    }
    process.exit(1);
  }

  console.log(`\n✅ Complete in ${elapsed}s!`);
  for (const [, output] of Object.entries(completion.history.outputs)) {
    if (output.images) {
      for (const img of output.images) {
        console.log(`📷 Output: ${img.filename}`);
        console.log(`   ${COMFYUI_URL}/view?filename=${img.filename}`);
      }
    }
  }
}

main().catch(console.error);
