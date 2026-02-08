#!/usr/bin/env node
/**
 * Chroma NSFW v2 - Simpler prompts, better quality
 */
import fs from 'fs';

const COMFYUI_URL = 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

// Simpler, cleaner prompts - less chance of glitches
const prompts = [
  {
    name: 'nsfw_v2_bedroom',
    prompt: 'photo of beautiful naked woman lying on white bed sheets, natural body, relaxed pose, hand between her thighs, soft natural light, looking at camera, intimate bedroom, amateur photo quality'
  },
  {
    name: 'nsfw_v2_shower',
    prompt: 'photo of wet naked woman in shower, water droplets on skin, one hand on breast, eyes looking at camera, steamy glass, natural body, soft lighting, intimate moment'
  },
  {
    name: 'nsfw_v2_selfie',
    prompt: 'nude selfie of woman in bedroom mirror, holding phone, natural breasts, relaxed expression, messy bed behind her, morning light, casual intimate photo'
  }
];

async function generateImage(prompt, name) {
  const workflow = {
    "4": {
      "inputs": { "unet_name": "Chroma1-HD.safetensors", "weight_dtype": "default" },
      "class_type": "UNETLoader"
    },
    "10": {
      "inputs": { "vae_name": "ae.safetensors" },
      "class_type": "VAELoader"
    },
    "11": {
      "inputs": { "clip_name": "t5xxl_fp8_e4m3fn.safetensors", "type": "chroma" },
      "class_type": "CLIPLoader"
    },
    "6": {
      "inputs": { "text": prompt, "clip": ["11", 0] },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
      "class_type": "EmptyLatentImage"
    },
    "3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": 35,
        "cfg": 2.5,
        "sampler_name": "euler",
        "scheduler": "beta",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["6", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "8": {
      "inputs": { "samples": ["3", 0], "vae": ["10", 0] },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": { "filename_prefix": name, "images": ["8", 0] },
      "class_type": "SaveImage"
    }
  };

  console.log(`Generating: ${name}`);
  console.log(`Prompt: ${prompt.substring(0, 80)}...`);

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
          console.log(`Done: ${img.filename}`);

          const imgRes = await fetch(`${COMFYUI_URL}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type}`);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const localPath = `${name}.png`;
          fs.writeFileSync(localPath, buffer);
          console.log(`Saved: ${localPath}\n`);
          return localPath;
        }
      }
    }
  }
}

async function main() {
  console.log('Chroma NSFW v2 - Cleaner prompts');
  console.log('Settings: 35 steps, CFG 2.5, euler sampler');
  console.log('================================\n');

  for (const p of prompts) {
    try {
      await generateImage(p.prompt, p.name);
    } catch (err) {
      console.error(`Failed ${p.name}:`, err.message);
    }
  }

  console.log('Done! Check images.');
}

main().catch(console.error);
