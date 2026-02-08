#!/usr/bin/env node
/**
 * Chroma NSFW Explicit Test - Amateur style with faces
 */
import fs from 'fs';

const COMFYUI_URL = 'https://qfzhjk1ojpy70r-8188.proxy.runpod.net';

const prompts = [
  {
    name: 'bedroom_masturbation_1',
    prompt: 'amateur iphone photo of a young woman masturbating on her bed, touching herself, eyes closed in pleasure, messy hair, natural body, small breasts, fingers between legs, soft morning light through curtains, realistic skin texture, intimate moment, genuine expression'
  },
  {
    name: 'mirror_selfie_explicit',
    prompt: 'amateur mirror selfie of a naked woman in bathroom, one hand holding phone, other hand touching her pussy, looking at camera with aroused expression, wet hair, steamy mirror, realistic amateur photo, natural lighting, visible face'
  },
  {
    name: 'couch_pleasure',
    prompt: 'candid photo of woman on couch masturbating, legs spread, fingers inside herself, head tilted back in pleasure, natural breasts, messy living room background, afternoon sunlight, amateur quality, genuine orgasm expression, visible face'
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
        "steps": 25,
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

  // Wait for completion
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

          // Download image
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
  console.log('Chroma NSFW Explicit Test - Amateur Style');
  console.log('=========================================\n');

  for (const p of prompts) {
    try {
      await generateImage(p.prompt, p.name);
    } catch (err) {
      console.error(`Failed ${p.name}:`, err.message);
    }
  }

  console.log('All done! Check the generated images.');
}

main().catch(console.error);
