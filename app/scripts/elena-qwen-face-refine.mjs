/**
 * Elena Qwen Face Refinement
 *
 * Takes a generated image and refines the face using Qwen-Image-Edit
 * Uses the face reference image for identity preservation
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

// Configuration
const CONFIG = {
  // Qwen models
  unet: 'qwen-image-edit-2511-Q4_K_M.gguf',
  textEncoder: 'qwen_2.5_vl_7b.safetensors',
  vae: 'qwen_image_vae.safetensors',

  // Input images (will be set dynamically)
  inputImage: 'elena_simple_test_00002_.png',  // Generated image to refine
  faceRef: 'elena_face_ref.jpg',               // Face reference

  // Generation settings
  steps: 20,
  cfg: 7.0,
  denoise: 0.6,  // Lower = subtle changes, Higher = more changes
};

// Build Qwen face refinement workflow
function buildQwenWorkflow(inputImage, faceRef, prompt, filenamePrefix) {
  return {
    // 1. Load Qwen GGUF UNet
    "1": {
      "class_type": "UnetLoaderGGUF",
      "inputs": {
        "unet_name": CONFIG.unet
      }
    },

    // 2. Load Qwen Text Encoder
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": CONFIG.textEncoder,
        "type": "qwen_image"
      }
    },

    // 3. Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": CONFIG.vae
      }
    },

    // 4. Load input image (the generated image to refine)
    "4": {
      "class_type": "LoadImage",
      "inputs": {
        "image": inputImage
      }
    },

    // 5. Load face reference image
    "5": {
      "class_type": "LoadImage",
      "inputs": {
        "image": faceRef
      }
    },

    // 6. Encode the editing instruction with images
    "6": {
      "class_type": "TextEncodeQwenImageEditPlus",
      "inputs": {
        "clip": ["2", 0],
        "prompt": prompt,
        "vae": ["3", 0],
        "image1": ["4", 0],  // Base image to edit
        "image2": ["5", 0]   // Face reference
      }
    },

    // 7. Create empty latent for Qwen (layered)
    "7": {
      "class_type": "EmptyQwenImageLayeredLatentImage",
      "inputs": {
        "width": 1024,
        "height": 1024,
        "layers": 2,  // 2 images: base + face ref
        "batch_size": 1
      }
    },

    // 8. KSampler for generation
    "8": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "positive": ["6", 0],
        "negative": ["6", 0],  // Qwen doesn't use separate negative
        "latent_image": ["7", 0],
        "seed": Math.floor(Math.random() * 1000000000),
        "steps": CONFIG.steps,
        "cfg": CONFIG.cfg,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1.0
      }
    },

    // 9. VAE Decode
    "9": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["8", 0],
        "vae": ["3", 0]
      }
    },

    // 10. Save Image
    "10": {
      "class_type": "SaveImage",
      "inputs": {
        "images": ["9", 0],
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

async function waitForCompletion(promptId, maxWaitMs = 600000) {
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
  console.log('🎨 Elena Qwen Face Refinement');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Config:`);
  console.log(`   • Input: ${CONFIG.inputImage}`);
  console.log(`   • Face ref: ${CONFIG.faceRef}`);
  console.log(`   • Steps: ${CONFIG.steps}`);
  console.log(`   • CFG: ${CONFIG.cfg}`);
  console.log(`   • Denoise: ${CONFIG.denoise}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check connection
  try {
    await fetch(`${COMFYUI_URL}/system_stats`);
    console.log('✅ ComfyUI connected\n');
  } catch (e) {
    console.error('❌ ComfyUI not running at', COMFYUI_URL);
    process.exit(1);
  }

  // Face refinement prompt
  const prompt = `Keep the exact face from image 2 (the reference photo).
Replace the face in image 1 with the face from image 2.
Preserve the exact facial features, eye color, skin tone, beauty mark.
Match the lighting and angle from image 1.
Keep body, pose, background unchanged.`;

  const workflow = buildQwenWorkflow(
    CONFIG.inputImage,
    CONFIG.faceRef,
    prompt,
    'elena_qwen_refined'
  );

  console.log('🚀 Queueing Qwen face refinement...');

  const result = await queuePrompt(workflow);

  if (result.error || (result.node_errors && Object.keys(result.node_errors).length > 0)) {
    console.error('❌ Queue error:', result.error || result);
    if (result.node_errors && Object.keys(result.node_errors).length > 0) {
      console.error('Node errors:', JSON.stringify(result.node_errors, null, 2));
    }
    process.exit(1);
  }

  console.log(`📝 Prompt ID: ${result.prompt_id}\n`);
  console.log(`⏳ Waiting for generation (max 600s)...`);

  const completion = await waitForCompletion(result.prompt_id);

  if (!completion.success) {
    console.error('\n❌ Generation failed:', completion.error);
    if (completion.details) {
      console.error('Details:', JSON.stringify(completion.details, null, 2));
    }
    process.exit(1);
  }

  console.log('\n\n✅ Face refinement complete!');

  // Extract output filename
  const outputs = completion.history.outputs;
  for (const [nodeId, output] of Object.entries(outputs)) {
    if (output.images) {
      for (const img of output.images) {
        console.log(`📷 Output: ~/ComfyUI/output/${img.filename}`);
      }
    }
  }
}

main().catch(console.error);
