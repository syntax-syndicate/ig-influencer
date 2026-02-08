#!/usr/bin/env node
/**
 * Chroma Simple Poses - Suggestive but no complex hand positions
 */
import fs from 'fs';

const COMFYUI_URL = 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const prompts = [
  {
    name: 'simple_bed_lying',
    prompt: 'amateur photo of naked woman lying on bed, arms above her head on pillow, natural breasts, relaxed expression, looking at camera, soft morning light, white sheets, intimate bedroom moment'
  },
  {
    name: 'simple_standing_mirror',
    prompt: 'nude woman standing in front of bedroom mirror, arms at her sides, natural body, soft curves, looking at her reflection, warm afternoon light, casual intimate moment, amateur photo'
  },
  {
    name: 'simple_sitting_couch',
    prompt: 'naked woman sitting on couch, legs crossed, arms resting on knees, natural breasts, relaxed smile, looking at camera, living room with natural light, amateur candid photo'
  },
  {
    name: 'simple_back_view',
    prompt: 'amateur photo of nude woman from behind, standing by window, looking over shoulder at camera, natural body, soft morning light, bedroom setting, intimate moment'
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
        "steps": 30,
        "cfg": 3.0,
        "sampler_name": "dpmpp_sde",
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
          console.log(`Done: ${name}.png`);
          return;
        }
      }
    }
  }
}

async function main() {
  console.log('Chroma Simple Poses Test');
  console.log('========================\n');

  for (const p of prompts) {
    await generateImage(p.prompt, p.name);
  }
  console.log('\nAll done!');
}

main().catch(console.error);
