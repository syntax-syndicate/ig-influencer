import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

// IMPROVED PROMPTS with anatomical detail
const PROMPTS = [
  `elena, explicit nude photo spreading legs on white bed,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, hazel-green eyes,
lying on back, legs wide open, realistic vulva, detailed labia, natural female anatomy, pink pussy,
hands on inner thighs, sensual expression looking at camera, bare breasts with erect nipples,
soft natural window lighting, iPhone 16 Pro photo, photorealistic skin texture, boudoir photography`,

  `elena, masturbating in bedroom, fingers inside,
elena's face: light brown wavy hair, full lips, high cheekbones, angular jawline, hazel eyes,
spread legs, two fingers penetrating pussy, realistic vagina, detailed labia minora, wet aroused,
pleasured expression, eyes half-closed, moaning, bare breasts, gold necklace,
warm lighting, silk sheets, intimate erotic photography, photorealistic`,

  `elena, nude on bed legs up,
elena's face: wavy blonde-brown hair, pouty lips, high cheekbones, green-hazel eyes,
lying on back, knees up and spread, showing pussy, realistic female genitals, detailed anatomy, pink labia,
touching herself, one hand on breast, seductive gaze at camera,
natural soft lighting, white bedding, iPhone photo style, ultra realistic skin`,
];

// IMPROVED NEGATIVES
const NEGATIVE = `wrong face, different person, dark hair, round face, blue eyes, 
bad anatomy, deformed genitals, unrealistic anatomy, blurry genitals, malformed vulva, 
extra fingers, bad hands, mutated, disfigured, low quality, blurry, cartoon, anime, 
censored, mosaic, pixelated`;

function buildWorkflow(prompt, seed, prefix) {
  return {
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_bf16.safetensors", "weight_dtype": "default"}},
    "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": 1.0}},
    "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2"}},
    "4": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": prompt}},
    "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": NEGATIVE}},
    "7": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1344, "batch_size": 1}},
    "8": {"class_type": "KSampler", "inputs": {
      "seed": seed, 
      "steps": 40,  // INCREASED from 30
      "cfg": 3.0, 
      "sampler_name": "res_multistep", 
      "scheduler": "simple", 
      "denoise": 1.0, 
      "model": ["2", 0], 
      "positive": ["5", 0], 
      "negative": ["6", 0], 
      "latent_image": ["7", 0]
    }},
    "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
    "10": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["9", 0]}}
  };
}

async function gen(idx) {
  const seed = Math.floor(Math.random() * 1000000000);
  const prefix = `elena_improved_${idx+1}`;
  const workflow = buildWorkflow(PROMPTS[idx], seed, prefix);

  console.log(`\n🔥 Scene ${idx+1}/3 | 40 steps | seed: ${seed}`);
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt: workflow, client_id: randomUUID()}),
  });
  if (!res.ok) { console.error('Queue failed:', await res.text()); return null; }
  const { prompt_id } = await res.json();
  console.log(`   Queued: ${prompt_id}`);

  return new Promise(r => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const t = setTimeout(() => { ws.close(); console.log('   ⏱️ WS timeout (image likely still generating)'); r(prefix); }, 200000);
    ws.on('message', d => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === 'progress') process.stdout.write(`\r   Progress: ${m.data.value}/${m.data.max}  `);
        if (m.type === 'executing' && m.data.node === null) { 
          clearTimeout(t); ws.close(); 
          console.log('\n   ✅ Done'); 
          r(prefix); 
        }
        if (m.type === 'execution_error') {
          console.error('\n   ❌ Error:', m.data.exception_message);
          clearTimeout(t); ws.close(); r(null);
        }
      } catch(e) {}
    });
    ws.on('error', (e) => { console.error('WS error:', e.message); clearTimeout(t); r(prefix); });
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 Elena IMPROVED Anatomy Generation');
  console.log('   LoRA: w1.0 | CFG: 3.0 | Steps: 40');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (let i = 0; i < 3; i++) {
    await gen(i);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All 3 images queued/generated!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main();
