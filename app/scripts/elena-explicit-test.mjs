import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const COMFYUI_URL = 'http://localhost:8188';
const WS_URL = 'ws://localhost:8188/ws';

const PROMPTS = [
  `elena, nude selfie in bedroom, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes,
completely nude, bare breasts, nipples visible, gold pendant necklace,
sensual confident expression, soft warm lighting, silk sheets,
iPhone 16 Pro photo, natural skin texture, intimate aesthetic`,

  `elena, explicit shower photo, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes,
fully nude wet body, bare breasts, water droplets on skin,
seductive gaze at camera, steamy bathroom, glass shower,
iPhone 16 Pro photo, natural wet skin, erotic aesthetic`,

  `elena, naked on bed, FOCUS ON FACE,
elena's face: light brown wavy hair with blonde highlights, full pouty lips, high cheekbones, angular jawline, hazel-green eyes,
lying nude on white sheets, bare breasts visible, legs slightly parted, gold body chain,
intimate confident expression, soft natural light from window,
iPhone 16 Pro photo, natural skin, boudoir photography`,
];

const NEGATIVE = `wrong face, different person, dark hair, round face, blue eyes, heavy makeup, artificial, cartoon, anime`;

function buildWorkflow(prompt, weight, cfg, seed, prefix) {
  return {
    "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "z_image_bf16.safetensors", "weight_dtype": "default" }},
    "2": { "class_type": "LoraLoaderModelOnly", "inputs": { "model": ["1", 0], "lora_name": "elena_zimage_v3_comfyorg.safetensors", "strength_model": weight }},
    "3": { "class_type": "CLIPLoader", "inputs": { "clip_name": "qwen_3_4b_bf16.safetensors", "type": "lumina2" }},
    "4": { "class_type": "VAELoader", "inputs": { "vae_name": "ae.safetensors" }},
    "5": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": prompt }},
    "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["3", 0], "text": NEGATIVE }},
    "7": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1344, "batch_size": 1 }},
    "8": { "class_type": "KSampler", "inputs": { "seed": seed, "steps": 30, "cfg": cfg, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1.0, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0] }},
    "9": { "class_type": "VAEDecode", "inputs": { "samples": ["8", 0], "vae": ["4", 0] }},
    "10": { "class_type": "SaveImage", "inputs": { "filename_prefix": prefix, "images": ["9", 0] }}
  };
}

async function gen(weight, cfg, idx) {
  const seed = Math.floor(Math.random() * 1000000000);
  const prefix = `elena_explicit_w${weight}_cfg${cfg}_${idx}`;
  const workflow = buildWorkflow(PROMPTS[idx], weight, cfg, seed, prefix);

  console.log(`Generating: w${weight} cfg${cfg} scene${idx+1}`);
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });
  if (!res.ok) { console.error('Queue failed'); return; }
  const { prompt_id } = await res.json();
  console.log(`  Queued: ${prompt_id}`);

  await new Promise(r => {
    const ws = new WebSocket(`${WS_URL}?clientId=${randomUUID()}`);
    const t = setTimeout(() => { ws.close(); console.log('  timeout'); r(); }, 180000);
    ws.on('message', d => {
      try {
        const m = JSON.parse(d.toString());
        if (m.type === 'progress') process.stdout.write(`\r  ${m.data.value}/${m.data.max}  `);
        if (m.type === 'executing' && m.data.node === null) { clearTimeout(t); ws.close(); console.log(' ✅'); r(); }
      } catch(e) {}
    });
    ws.on('error', () => { clearTimeout(t); r(); });
  });
}

async function main() {
  console.log('=== Weight 1.0, CFG 2.5 ===');
  for (let i = 0; i < 3; i++) await gen(1.0, 2.5, i);

  console.log('\n=== Weight 1.1, CFG 2.5 ===');
  for (let i = 0; i < 3; i++) await gen(1.1, 2.5, i);

  console.log('\n✅ Done - 6 images generated');
}

main();
