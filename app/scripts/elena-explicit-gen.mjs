import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

const PROMPTS = [
  `elena, nude selfie in bedroom, masturbating,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, hazel-green eyes,
hand between legs, touching herself, pleasured expression, eyes half-closed,
completely nude on silk sheets, bare breasts, gold pendant necklace,
soft warm lighting, iPhone 16 Pro photo, natural skin texture, intimate erotic aesthetic`,

  `elena, explicit nude photo, spreading legs,
elena's face: light brown wavy hair, full lips, high cheekbones, angular jawline,
lying on bed, legs spread open, pussy visible, touching herself,
sensual expression looking at camera, bare breasts, erect nipples,
natural lighting, boudoir photography, realistic skin, iPhone selfie style`,

  `elena, shower masturbation,
elena's face: wet wavy hair, full pouty lips, high cheekbones, hazel eyes,
standing in glass shower, water droplets on skin, one hand on breast, other hand between legs,
orgasmic expression, steam, wet nude body,
natural lighting, erotic photography, realistic`,
];

const NEGATIVE = `wrong face, different person, dark hair, round face, blue eyes, artificial, cartoon, anime, bad hands, extra fingers`;

function buildWorkflow(prompt, seed, prefix) {
  return {
    "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "z_image_bf16.safetensors", "weight_dtype": "default" }},
    "2": { "class_type": "LoraLoaderModelOnly", "inputs": { "model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": 1.0 }},
    "3": { "class_type": "CLIPLoader", "inputs": { "clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2" }},
    "4": { "class_type": "VAELoader", "inputs": { "vae_name": "ae.safetensors" }},
    "5": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": prompt }},
    "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": NEGATIVE }},
    "7": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1344, "batch_size": 1 }},
    "8": { "class_type": "KSampler", "inputs": { "seed": seed, "steps": 30, "cfg": 3.0, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0] }},
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["8", 0], "vae": ["4", 0] }},
    "10": { "class_type": "SaveImage", "inputs": { "filename_prefix": prefix, "images": ["9", 0] }}
  };
}

async function gen(idx) {
  const seed = Math.floor(Math.random() * 1000000000);
  const prefix = `elena_explicit_${idx+1}`;
  const workflow = buildWorkflow(PROMPTS[idx], seed, prefix);

  console.log(`\n🔥 Generating scene ${idx+1}/3 (seed: ${seed})`);
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });
  if (!res.ok) { console.error('Queue failed'); return null; }
  const { prompt_id } = await res.json();

  return new Promise(r => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const t = setTimeout(() => { ws.close(); console.log('  timeout'); r(null); }, 180000);
    ws.on('message', d => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === 'progress') process.stdout.write(`\r  Progress: ${m.data.value}/${m.data.max}  `);
        if (m.type === 'executing' && m.data.node === null) { 
          clearTimeout(t); ws.close(); 
          console.log('\n  ✅ Done'); 
          r(prefix); 
        }
      } catch(e) {}
    });
    ws.on('error', () => { clearTimeout(t); r(null); });
  });
}

async function main() {
  console.log('🎨 Elena Explicit Generation - LoRA w1.0 CFG 3.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (let i = 0; i < 3; i++) {
    await gen(i);
  }
  
  console.log('\n✅ All 3 images generated!');
}

main();
