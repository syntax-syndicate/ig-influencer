import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

// Step 1: Generate full image with Z-Image Full + LoRA
function buildGenerateWorkflow(seed) {
  return {
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}},
    "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": 1.0}},
    "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2"}},
    "4": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": "elena, nude on white bed, legs spread open, elena face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, hazel-green eyes, sensual confident expression, bare breasts, gold pendant necklace, soft natural window lighting, iPhone 16 Pro photo, photorealistic skin texture, boudoir photography"}},
    "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": "wrong face, different person, cartoon, anime, plastic"}},
    "7": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1344, "batch_size": 1}},
    "8": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 35, "cfg": 3.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]}},
    "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
    "10": {"class_type": "SaveImage", "inputs": {"filename_prefix": "elena_base", "images": ["9", 0]}}
  };
}

// Step 2: Inpaint genital area
function buildInpaintWorkflow(imageName, seed) {
  return {
    // Load models
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}},
    "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": 0.3}},
    "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2"}},
    "4": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    
    // Load generated image
    "10": {"class_type": "LoadImage", "inputs": {"image": imageName}},
    
    // Encode to latent
    "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["4", 0]}},
    
    // Prompts for inpainting - focused on anatomy
    "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": "realistic female vulva, detailed labia, natural pink color, photorealistic anatomy, sharp details, natural skin texture"}},
    "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": "bad anatomy, deformed, blurry, cartoon, unrealistic"}},
    
    // Create mask for lower body area (we'll use a solid mask and rely on low denoise)
    "12": {"class_type": "SolidMask", "inputs": {"value": 1.0, "width": 1024, "height": 1344}},
    
    // Set latent noise mask
    "13": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["11", 0], "mask": ["12", 0]}},
    
    // KSampler with low denoise to preserve most of image
    "8": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 30, "cfg": 3.5, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 0.45, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["13", 0]}},
    
    "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
    "14": {"class_type": "SaveImage", "inputs": {"filename_prefix": "elena_inpaint", "images": ["9", 0]}}
  };
}

async function waitForImage(prefix, timeout = 180000) {
  return new Promise(r => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const t = setTimeout(() => { ws.close(); console.log('  ⏱️ timeout'); r(null); }, timeout);
    ws.on('message', d => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === 'progress') process.stdout.write(`\r  Progress: ${m.data.value}/${m.data.max}  `);
        if (m.type === 'executing' && m.data.node === null) { 
          clearTimeout(t); ws.close(); 
          console.log('\n  ✅ Done'); 
          r(true); 
        }
      } catch(e) {}
    });
    ws.on('error', () => { clearTimeout(t); r(null); });
  });
}

async function main() {
  const seed = Math.floor(Math.random() * 1000000000);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 Elena Z-Image Full + LoRA + Inpainting');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Step 1: Generate base image
  console.log('\n📸 Step 1: Generating base image with Elena LoRA...');
  const genWorkflow = buildGenerateWorkflow(seed);
  const res1 = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt: genWorkflow, client_id: randomUUID()}),
  });
  if (!res1.ok) { console.error('Queue failed'); return; }
  const { prompt_id: pid1 } = await res1.json();
  console.log(`  Queued: ${pid1}`);
  await waitForImage('elena_base');
  
  console.log('\n✅ Base image generated!');
  console.log('   File: elena_base_00001_.png');
  console.log('\n💡 To inpaint: manually create mask in ComfyUI UI');
  console.log('   or use img2img with low denoise (0.4-0.5) on cropped region');
}

main();
