#!/usr/bin/env node
/**
 * BigLove XL NSFW Test - Compare with Chroma
 */
import fs from 'fs';

const COMFYUI_URL = 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const prompts = [
  {
    name: 'biglove_bedroom',
    prompt: 'photo of beautiful naked woman lying on white bed, natural body, hand between thighs, soft light, looking at camera, intimate, amateur photo'
  },
  {
    name: 'biglove_selfie',
    prompt: 'nude mirror selfie, woman holding phone, natural breasts, relaxed, messy bedroom, morning light, amateur quality'
  }
];

async function generateImage(prompt, name) {
  // BigLove XL workflow (SDXL)
  const workflow = {
    "1": {
      "inputs": { "ckpt_name": "bigLove_xl1.safetensors" },
      "class_type": "CheckpointLoaderSimple"
    },
    "6": {
      "inputs": { "text": prompt, "clip": ["1", 1] },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": { "text": "ugly, deformed, bad anatomy, extra limbs, blurry, watermark", "clip": ["1", 1] },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
      "class_type": "EmptyLatentImage"
    },
    "3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": 25,
        "cfg": 4.0,
        "sampler_name": "dpmpp_2m_sde",
        "scheduler": "karras",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "8": {
      "inputs": { "samples": ["3", 0], "vae": ["1", 2] },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": { "filename_prefix": name, "images": ["8", 0] },
      "class_type": "SaveImage"
    }
  };

  console.log(`Generating: ${name}`);

  const response = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });

  const result = await response.json();
  if (result.error) {
    console.error('Error:', result.error);
    return null;
  }

  const promptId = result.prompt_id;
  console.log(`Queued: ${promptId}`);

  while (true) {
    await new Promise(r => setTimeout(r, 3000));
    const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    const history = await historyRes.json();

    if (history[promptId]?.outputs) {
      const outputs = history[promptId].outputs;
      for (const nodeId in outputs) {
        if (outputs[nodeId].images) {
          const img = outputs[nodeId].images[0];
          const imgRes = await fetch(`${COMFYUI_URL}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type}`);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(`${name}.png`, buffer);
          console.log(`Saved: ${name}.png\n`);
          return;
        }
      }
    }
  }
}

async function main() {
  console.log('BigLove XL NSFW Test');
  console.log('====================\n');

  for (const p of prompts) {
    await generateImage(p.prompt, p.name);
  }
  console.log('Done!');
}

main().catch(console.error);
