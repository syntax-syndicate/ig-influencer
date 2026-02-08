/**
 * Elena Qwen Face Refinement V2
 *
 * 1. Detect face in base image using InsightFace
 * 2. Create gray mask over face region
 * 3. Run Qwen with masked image + face reference
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SSH_HOST = process.env.SSH_HOST || 'root@209.170.80.132';
const SSH_PORT = process.env.SSH_PORT || '14879';
const SSH_KEY = process.env.SSH_KEY || '~/.runpod/ssh/RunPod-Key-Go';

// Configuration
const CONFIG = {
  // Qwen models
  unet: 'qwen-image-edit-2511-Q4_K_M.gguf',
  textEncoder: 'qwen_2.5_vl_7b.safetensors',
  vae: 'qwen_image_vae.safetensors',

  // Input images
  inputImage: 'elena_simple_test_00002_.png',  // Generated image to refine
  faceRef: 'elena_face_ref_v2.png',             // Face reference (CleanShot)
  maskedImage: 'elena_masked_for_qwen.png',    // Will be created

  // Generation settings
  steps: 20,
  cfg: 7.0,
};

import { execSync } from 'child_process';

// Create the face masking Python script - uses oval/polygon contour, not square
const MASK_SCRIPT = `
import cv2
import numpy as np
from PIL import Image
import sys

# Paths
input_path = sys.argv[1]
output_path = sys.argv[2]

# Load image
img = cv2.imread(input_path)
if img is None:
    print(f"Error: Could not load {input_path}")
    sys.exit(1)

h, w = img.shape[:2]
print(f"Image size: {w}x{h}")

# Try to load InsightFace for face detection with landmarks
try:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    faces = app.get(img)

    if len(faces) > 0:
        # Get the largest face
        face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
        x1, y1, x2, y2 = [int(c) for c in face.bbox]

        # Get face landmarks if available (68 or 106 points)
        landmarks = face.landmark_2d_106 if hasattr(face, 'landmark_2d_106') and face.landmark_2d_106 is not None else None
        if landmarks is None:
            landmarks = face.landmark_3d_68 if hasattr(face, 'landmark_3d_68') and face.landmark_3d_68 is not None else None

        if landmarks is not None:
            print(f"Using {len(landmarks)} face landmarks for contour mask")
            # Create convex hull from landmarks for face contour
            points = np.array(landmarks[:, :2], dtype=np.int32)
            hull = cv2.convexHull(points)

            # Expand the hull slightly (10%)
            center = np.mean(hull, axis=0)
            expanded_hull = []
            for point in hull:
                direction = point[0] - center
                expanded_point = point[0] + direction * 0.15  # 15% expansion
                expanded_hull.append(expanded_point)
            expanded_hull = np.array(expanded_hull, dtype=np.int32)

            # Create mask from hull
            mask = np.zeros(img.shape[:2], dtype=np.uint8)
            cv2.fillConvexPoly(mask, expanded_hull, 255)

            # Feather the mask edges for smooth blending
            mask = cv2.GaussianBlur(mask, (31, 31), 0)

            # Apply gray to masked region
            gray_color = np.array([128, 128, 128], dtype=np.uint8)
            mask_3ch = mask[:, :, np.newaxis] / 255.0
            img = (img * (1 - mask_3ch) + gray_color * mask_3ch).astype(np.uint8)

            print(f"Applied feathered convex hull mask")
        else:
            # Fallback to oval if no landmarks
            print("No landmarks, using oval mask")
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            rx, ry = int((x2 - x1) * 0.6), int((y2 - y1) * 0.6)  # Oval radii

            # Create oval mask
            mask = np.zeros(img.shape[:2], dtype=np.uint8)
            cv2.ellipse(mask, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)

            # Feather edges
            mask = cv2.GaussianBlur(mask, (31, 31), 0)

            # Apply gray
            gray_color = np.array([128, 128, 128], dtype=np.uint8)
            mask_3ch = mask[:, :, np.newaxis] / 255.0
            img = (img * (1 - mask_3ch) + gray_color * mask_3ch).astype(np.uint8)
    else:
        print("No face detected, using center oval")
        cx, cy = w // 2, int(h * 0.35)
        rx, ry = int(w * 0.2), int(h * 0.25)
        mask = np.zeros(img.shape[:2], dtype=np.uint8)
        cv2.ellipse(mask, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
        mask = cv2.GaussianBlur(mask, (31, 31), 0)
        gray_color = np.array([128, 128, 128], dtype=np.uint8)
        mask_3ch = mask[:, :, np.newaxis] / 255.0
        img = (img * (1 - mask_3ch) + gray_color * mask_3ch).astype(np.uint8)

except Exception as e:
    print(f"InsightFace failed: {e}, using center oval")
    cx, cy = w // 2, int(h * 0.35)
    rx, ry = int(w * 0.2), int(h * 0.25)
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    cv2.ellipse(mask, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    mask = cv2.GaussianBlur(mask, (31, 31), 0)
    gray_color = np.array([128, 128, 128], dtype=np.uint8)
    mask_3ch = mask[:, :, np.newaxis] / 255.0
    img = (img * (1 - mask_3ch) + gray_color * mask_3ch).astype(np.uint8)

# Save
cv2.imwrite(output_path, img)
print(f"Saved masked image to: {output_path}")
`;

function ssh(cmd) {
  const fullCmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_HOST} -p ${SSH_PORT} "${cmd.replace(/"/g, '\\"')}"`;
  return execSync(fullCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

async function createMaskedImage() {
  console.log('🎭 Creating masked image...');

  // Write mask script to server
  const scriptPath = '/tmp/create_face_mask.py';
  const inputPath = `/workspace/comfyui/output/${CONFIG.inputImage}`;
  const outputPath = `/workspace/comfyui/input/${CONFIG.maskedImage}`;

  // Create the script on the server
  ssh(`cat > ${scriptPath} << 'PYTHON_EOF'
${MASK_SCRIPT}
PYTHON_EOF`);

  // Run the script
  try {
    const result = ssh(`cd /workspace/comfyui && python3 ${scriptPath} "${inputPath}" "${outputPath}"`);
    console.log(result);
    return true;
  } catch (e) {
    console.error('Error creating mask:', e.message);
    return false;
  }
}

// Build Qwen face refinement workflow with masked image
function buildQwenWorkflow(maskedImage, faceRef, prompt, filenamePrefix) {
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

    // 4. Load MASKED input image (with gray patch over face)
    "4": {
      "class_type": "LoadImage",
      "inputs": {
        "image": maskedImage
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
        "image1": ["4", 0],  // Masked base image (gray patch over face)
        "image2": ["5", 0]   // Face reference to copy from
      }
    },

    // 7. Create empty latent for Qwen (layered)
    "7": {
      "class_type": "EmptyQwenImageLayeredLatentImage",
      "inputs": {
        "width": 1024,
        "height": 1024,
        "layers": 2,
        "batch_size": 1
      }
    },

    // 8. KSampler for generation
    "8": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "positive": ["6", 0],
        "negative": ["6", 0],
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
  console.log('🎨 Elena Qwen Face Refinement V2 (with face masking)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Config:`);
  console.log(`   • Input: ${CONFIG.inputImage}`);
  console.log(`   • Face ref: ${CONFIG.faceRef}`);
  console.log(`   • Steps: ${CONFIG.steps}`);
  console.log(`   • CFG: ${CONFIG.cfg}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check connection
  try {
    await fetch(`${COMFYUI_URL}/system_stats`);
    console.log('✅ ComfyUI connected\n');
  } catch (e) {
    console.error('❌ ComfyUI not running at', COMFYUI_URL);
    process.exit(1);
  }

  // Step 1: Create masked image
  const maskSuccess = await createMaskedImage();
  if (!maskSuccess) {
    console.error('❌ Failed to create masked image');
    process.exit(1);
  }

  // Face refinement prompt - strongly emphasize copying face from reference
  const prompt = `This is a face swap task.
Image 1 has a gray masked area where the face should be.
Image 2 shows the exact face to use - copy this face exactly.

IMPORTANT: Use the EXACT face from image 2:
- Same eye shape, eye color, eyebrows
- Same nose shape and size
- Same lips and mouth shape
- Same skin tone and texture
- Same beauty mark on right cheek
- Same facial structure and proportions

Fill the gray area in image 1 with the face from image 2.
Match the lighting direction from image 1.
Blend naturally with hair and neck.`;

  const workflow = buildQwenWorkflow(
    CONFIG.maskedImage,
    CONFIG.faceRef,
    prompt,
    'elena_qwen_v4_newref'
  );

  console.log('\n🚀 Queueing Qwen face refinement...');

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
