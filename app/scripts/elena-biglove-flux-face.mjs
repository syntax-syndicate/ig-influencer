#!/usr/bin/env node
/**
 * Elena BigLove + FLUX Face Refinement
 *
 * Pipeline:
 * 1. Generate with BigLove XL (realistic skin/lighting)
 * 2. Refine face with FLUX ReferenceLatent
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

// Stage 1: BigLove XL generation
const bigLoveWorkflow = {
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "bigLove_xl1.safetensors"
    }
  },
  "2": {
    "class_type": "LoraLoader",
    "inputs": {
      "lora_name": "elena_v4_cloud.safetensors",
      "strength_model": 0.7,
      "strength_clip": 0.7,
      "model": ["1", 0],
      "clip": ["1", 1]
    }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "elena, beautiful woman, 28 years old, hazel-green eyes, beauty mark on right cheek, golden tan skin, bronde hair with honey balayage, beach waves, natural breasts D cup, wearing elegant white linen dress, golden hour lighting, luxury hotel terrace, detailed skin texture, photorealistic, 8k",
      "clip": ["2", 1]
    }
  },
  "4": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "ugly, deformed, bad anatomy, bad hands, missing fingers, blurry, low quality, watermark, text, cartoon, anime, cgi, 3d render, plastic",
      "clip": ["2", 1]
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    }
  },
  // Face reference for IP-Adapter
  "10": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "elena_face_ref.jpg"
    }
  },
  "11": {
    "class_type": "CLIPVisionLoader",
    "inputs": {
      "clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
    }
  },
  "12": {
    "class_type": "IPAdapterModelLoader",
    "inputs": {
      "ipadapter_file": "ip-adapter-faceid-plusv2_sdxl.bin"
    }
  },
  "13": {
    "class_type": "IPAdapterInsightFaceLoader",
    "inputs": {
      "provider": "CPU",
      "model_name": "buffalo_l"
    }
  },
  "14": {
    "class_type": "IPAdapterFaceID",
    "inputs": {
      "model": ["2", 0],
      "ipadapter": ["12", 0],
      "image": ["10", 0],
      "clip_vision": ["11", 0],
      "insightface": ["13", 0],
      "weight": 0.85,
      "weight_faceidv2": 0.85,
      "weight_type": "linear",
      "combine_embeds": "concat",
      "start_at": 0,
      "end_at": 1,
      "embeds_scaling": "V only"
    }
  },
  "20": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["14", 0],
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
  "21": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["20", 0],
      "vae": ["1", 2]
    }
  },
  // Save intermediate (without upscale for FLUX processing)
  "22": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["21", 0],
      "filename_prefix": "elena_biglove_base"
    }
  }
};

// Stage 2: FLUX face refinement (img2img with reference)
function buildFluxFaceRefineWorkflow(inputImage, faceRef, filenamePrefix) {
  return {
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
        "image": inputImage
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
        "image": faceRef
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
        "text": "same woman, same face, same identity, preserve exact facial features, hazel-green eyes, beauty mark on right cheek, full lips, golden tan skin, photorealistic",
        "clip": ["2", 0]
      }
    },

    // FluxGuidance
    "9": {
      "class_type": "FluxGuidance",
      "inputs": {
        "conditioning": ["8", 0],
        "guidance": 4.0
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
        "steps": 8,
        "cfg": 1.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 0.35  // Low denoise to preserve most of the image
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
    await new Promise(r => setTimeout(r, 2000));
  }
  return { success: false, error: 'Timeout' };
}

async function main() {
  console.log('🎨 Elena BigLove + FLUX Face Refinement');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Pipeline:');
  console.log('  1. BigLove XL + IP-Adapter FaceID (realistic skin)');
  console.log('  2. FLUX ReferenceLatent (face consistency)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check connection
  try {
    await fetch(`${COMFYUI_URL}/system_stats`);
    console.log('✅ ComfyUI connected\n');
  } catch (e) {
    console.error('❌ ComfyUI not reachable');
    process.exit(1);
  }

  // Stage 1: BigLove generation
  console.log('📸 Stage 1: BigLove XL generation...');
  const result1 = await queuePrompt(bigLoveWorkflow);

  if (result1.error) {
    console.error('❌ BigLove error:', result1.error);
    process.exit(1);
  }
  if (result1.node_errors && Object.keys(result1.node_errors).length > 0) {
    console.error('❌ BigLove node errors:', JSON.stringify(result1.node_errors, null, 2));
    process.exit(1);
  }

  console.log(`   Prompt ID: ${result1.prompt_id}`);
  const completion1 = await waitForCompletion(result1.prompt_id);

  if (!completion1.success) {
    console.error('\n❌ BigLove failed:', completion1.error);
    process.exit(1);
  }

  // Get output filename
  let bigLoveOutput = null;
  for (const [nodeId, output] of Object.entries(completion1.history.outputs)) {
    if (output.images && output.images[0]) {
      bigLoveOutput = output.images[0].filename;
      break;
    }
  }

  console.log(`\n✅ BigLove complete: ${bigLoveOutput}\n`);

  // Copy BigLove output to input folder for FLUX to access
  console.log('📁 Copying image to input folder...');
  const copyUrl = `${COMFYUI_URL}/view?filename=${bigLoveOutput}`;
  // We'll reference from output folder using subfolder parameter instead

  // Stage 2: FLUX face refinement
  console.log('🎭 Stage 2: FLUX face refinement...');
  const fluxWorkflow = buildFluxFaceRefineWorkflow(
    bigLoveOutput,
    'elena_face_ref.jpg',
    'elena_biglove_flux'
  );

  const result2 = await queuePrompt(fluxWorkflow);

  if (result2.error || result2.node_errors) {
    console.error('❌ FLUX error:', result2.error || JSON.stringify(result2.node_errors, null, 2));
    process.exit(1);
  }

  console.log(`   Prompt ID: ${result2.prompt_id}`);
  const completion2 = await waitForCompletion(result2.prompt_id);

  if (!completion2.success) {
    console.error('\n❌ FLUX failed:', completion2.error);
    if (completion2.details) {
      const execError = completion2.details.status?.messages?.find(m => m[0] === 'execution_error');
      if (execError) console.error('Error:', execError[1].exception_message);
    }
    process.exit(1);
  }

  console.log('\n\n✅ Pipeline complete!');

  // Show outputs
  for (const [nodeId, output] of Object.entries(completion2.history.outputs)) {
    if (output.images) {
      for (const img of output.images) {
        console.log(`📷 Final: ${img.filename}`);
        console.log(`   URL: ${COMFYUI_URL}/view?filename=${img.filename}`);
      }
    }
  }
}

main().catch(console.error);
