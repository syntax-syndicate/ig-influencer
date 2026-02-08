#!/usr/bin/env node
/**
 * Elena FLUX.2 Klein 9B Face Reference Test
 *
 * Uses ReferenceLatent node to preserve face identity from reference photo
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const CONFIG = {
  // FLUX.2 Klein 9B models
  diffusionModel: 'flux-2-klein-9b-fp8.safetensors',
  textEncoder: 'qwen_3_8b_fp8mixed.safetensors',
  vae: 'flux2-vae.safetensors',

  // Face reference
  faceRef: 'elena_face_ref.jpg',

  // Generation settings
  width: 1024,
  height: 1024,
  steps: 8,        // More steps for better quality with reference
  cfg: 4.0,        // Higher CFG for reference-based generation
  seed: Math.floor(Math.random() * 1000000000),
};

// FLUX.2 Klein workflow with face reference
// ReferenceLatent embeds the face reference into the conditioning
function buildFluxFaceRefWorkflow(prompt, faceRefImage, filenamePrefix) {
  return {
    // 1. Load FLUX.2 Klein diffusion model
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": CONFIG.diffusionModel,
        "weight_dtype": "fp8_e4m3fn"
      }
    },

    // 2. Load Qwen 3 8B text encoder
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

    // 4. Load face reference image
    "4": {
      "class_type": "LoadImage",
      "inputs": {
        "image": faceRefImage
      }
    },

    // 5. Encode face reference to latent
    "5": {
      "class_type": "VAEEncode",
      "inputs": {
        "pixels": ["4", 0],
        "vae": ["3", 0]
      }
    },

    // 6. CLIP Text Encode (positive prompt)
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },

    // 7. FluxGuidance - apply guidance to base conditioning
    "7": {
      "class_type": "FluxGuidance",
      "inputs": {
        "conditioning": ["6", 0],
        "guidance": CONFIG.cfg
      }
    },

    // 8. ReferenceLatent - inject face reference into conditioning
    "8": {
      "class_type": "ReferenceLatent",
      "inputs": {
        "conditioning": ["7", 0],
        "latent": ["5", 0]
      }
    },

    // 9. Empty conditioning for negative
    "9": {
      "class_type": "ConditioningZeroOut",
      "inputs": {
        "conditioning": ["6", 0]
      }
    },

    // 10. Empty FLUX2 Latent Image
    "10": {
      "class_type": "EmptyFlux2LatentImage",
      "inputs": {
        "width": CONFIG.width,
        "height": CONFIG.height,
        "batch_size": 1
      }
    },

    // 11. KSampler with reference conditioning
    "11": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "positive": ["8", 0],  // Reference-enhanced conditioning
        "negative": ["9", 0],
        "latent_image": ["10", 0],
        "seed": CONFIG.seed,
        "steps": CONFIG.steps,
        "cfg": 1.0,  // CFG controlled by FluxGuidance
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0
      }
    },

    // 12. VAE Decode
    "12": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["11", 0],
        "vae": ["3", 0]
      }
    },

    // 13. Save Image
    "13": {
      "class_type": "SaveImage",
      "inputs": {
        "images": ["12", 0],
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
  console.log('🎨 Elena FLUX.2 Klein 9B Face Reference Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Config:`);
  console.log(`   • Model: ${CONFIG.diffusionModel}`);
  console.log(`   • Face ref: ${CONFIG.faceRef}`);
  console.log(`   • Resolution: ${CONFIG.width}x${CONFIG.height}`);
  console.log(`   • Steps: ${CONFIG.steps}`);
  console.log(`   • CFG: ${CONFIG.cfg}`);
  console.log(`   • Seed: ${CONFIG.seed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check connection
  try {
    const stats = await fetch(`${COMFYUI_URL}/system_stats`);
    const data = await stats.json();
    console.log(`✅ ComfyUI connected (${data.devices[0].name})\n`);
  } catch (e) {
    console.error('❌ ComfyUI not reachable at', COMFYUI_URL);
    process.exit(1);
  }

  // Elena-specific prompt emphasizing face features
  const prompt = `portrait photo of elena, beautiful woman, 28 years old,
oval face shape with high cheekbones,
hazel-green eyes with golden honey tones,
straight nose with slight slope and rounded tip,
full lips with larger lower lip and defined cupid's bow,
distinctive beauty mark on right cheek near cheekbone,
golden tan sun-kissed skin with smooth texture,
bronde hair with dark roots and golden honey blonde balayage, textured beach waves,
wearing elegant white linen dress,
golden hour lighting, luxury hotel terrace background,
photorealistic, 8k resolution, sharp focus, professional photography,
same person as reference, exact face identity match`;

  const workflow = buildFluxFaceRefWorkflow(prompt, CONFIG.faceRef, 'elena_flux_faceref');

  console.log('🚀 Starting FLUX generation with face reference...\n');

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
      const execError = completion.details.status?.messages?.find(m => m[0] === 'execution_error');
      if (execError) {
        console.error('Error:', execError[1].exception_message);
      }
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
