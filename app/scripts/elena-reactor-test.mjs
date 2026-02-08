import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

const PROMPT = `elena, nude selfie in bedroom,
light brown wavy hair with blonde highlights, full lips, high cheekbones,
completely nude, bare breasts, nipples visible, gold pendant necklace,
sensual confident expression, soft warm lighting, silk sheets,
iPhone 16 Pro photo, natural skin texture, intimate aesthetic`;

const NEGATIVE = `wrong face, different person, dark hair, round face, artificial, cartoon`;

// Workflow: Z-Image + LoRA + ReActor Face Swap
function buildWorkflow(seed, prefix) {
  return {
    // Load models
    "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "z_image_bf16.safetensors", "weight_dtype": "default" }},
    "2": { "class_type": "LoraLoaderModelOnly", "inputs": { "model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": 1.0 }},
    "3": { "class_type": "CLIPLoader", "inputs": { "clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2" }},
    "4": { "class_type": "VAELoader", "inputs": { "vae_name": "ae.safetensors" }},

    // Encode prompts
    "5": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": PROMPT }},
    "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": NEGATIVE }},

    // Generate
    "7": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1344, "batch_size": 1 }},
    "8": { "class_type": "KSampler", "inputs": {
      "seed": seed, "steps": 30, "cfg": 3.0,
      "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0,
      "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]
    }},
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["8", 0], "vae": ["4", 0] }},

    // Load Elena reference face
    "10": { "class_type": "LoadImage", "inputs": { "image": "elena_reference.jpg" }},

    // ReActor Face Swap
    "11": {
      "class_type": "ReActorFaceSwap",
      "inputs": {
        "enabled": true,
        "input_image": ["9", 0],
        "source_image": ["10", 0],
        "swap_model": "inswapper_128.onnx",
        "facedetection": "retinaface_resnet50",
        "face_restore_model": "GFPGANv1.4.pth",
        "face_restore_visibility": 1,
        "codeformer_weight": 0.5,
        "detect_gender_input": "no",
        "detect_gender_source": "no",
        "input_faces_index": "0",
        "source_faces_index": "0",
        "console_log_level": 1
      }
    },

    // Save both images
    "12": { "class_type": "SaveImage", "inputs": { "filename_prefix": prefix + "_original", "images": ["9", 0] }},
    "13": { "class_type": "SaveImage", "inputs": { "filename_prefix": prefix + "_swapped", "images": ["11", 0] }}
  };
}

async function generate() {
  const seed = Math.floor(Math.random() * 1000000000);
  const prefix = `elena_reactor`;
  const workflow = buildWorkflow(seed, prefix);

  console.log('🎨 Generating with Z-Image + LoRA + ReActor Face Swap');
  console.log(`   Seed: ${seed}`);

  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Queue failed:', error);
    return;
  }

  const { prompt_id } = await res.json();
  console.log(`   Queued: ${prompt_id}`);

  await new Promise(r => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const t = setTimeout(() => { ws.close(); console.log('   timeout'); r(); }, 300000);
    ws.on('message', d => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === 'progress') process.stdout.write(`\r   Progress: ${m.data.value}/${m.data.max}  `);
        if (m.type === 'executing' && m.data.node === null) { clearTimeout(t); ws.close(); console.log('\n   ✅ Done'); r(); }
        if (m.type === 'execution_error') {
          console.error('\n   ❌ Error:', m.data.exception_message);
          clearTimeout(t); ws.close(); r();
        }
      } catch(e) {}
    });
    ws.on('error', (e) => { console.error('WS error:', e.message); clearTimeout(t); r(); });
  });
}

generate();
