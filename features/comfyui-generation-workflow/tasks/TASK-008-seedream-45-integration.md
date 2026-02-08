# TASK-008: Seedream 4.5 ComfyUI Integration

**Status**: 🟡 In Progress
**Created**: 2026-01-29
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Install and test Seedream 4.5 via ComfyUI custom nodes on RunPod for NSFW image generation, bypassing ByteDance's API content filter.

---

## Background

- Seedream 4.5 via Replicate API blocks NSFW content: `Content flagged for: sexual`
- Local/self-hosted ComfyUI has no content filter
- Seedream 4.5 is known for excellent portraits, realistic skin, and lighting
- GGUF weights are available for local inference

---

## Acceptance Criteria

- [ ] Seedream 4.5 GGUF model downloaded to RunPod volume (`/workspace/comfyui/models/unet/`)
- [ ] Custom node for Seedream 4.5 installed (via ComfyUI Manager or manual)
- [ ] New workflow script `elena-seedream-test.mjs` created
- [ ] NSFW test generation works without content filter blocking
- [ ] Compare output quality to BigLove XL: skin texture, face consistency
- [ ] Document VRAM usage and generation speed
- [ ] No linter errors introduced

---

## Approach

### 1. Find Seedream 4.5 GGUF Weights

Search Hugging Face for:
- `Seedream-4.5-GGUF`
- `ByteDance/Seedream-4.5`
- Community quantized versions (Q4_K_M, Q8)

**Note**: RTX 4090 has 24GB VRAM, current usage ~18-19GB with all models. Seedream GGUF must fit in ~5GB headroom OR unload BigLove during generation.

### 2. Install Custom Nodes

Options from Perplexity search:
1. **ComfyUI Manager**: Auto-install missing nodes when loading workflow JSON
2. **Manual**: `git clone` Seedream node package to `custom_nodes/`
3. **z-image.ai workflow**: Import their Seedream 4.5 JSON template

Key nodes needed:
- GGUF loader node
- Seedream-specific sampler (if any)

### 3. Create Workflow Script

```javascript
// elena-seedream-test.mjs
const workflow = {
  // Load GGUF model
  "1": {
    class_type: "UNETLoaderGGUF", // or equivalent
    inputs: { unet_name: "seedream-4.5-q4.gguf" }
  },
  // CLIP encoder (may need separate or use existing)
  "2": { ... },
  // Sampler
  "3": {
    class_type: "KSampler",
    inputs: {
      steps: 25,
      cfg: 5.5, // Perplexity suggests 5.5-7 for Seedream
      ...
    }
  },
  // VAE decode + save
  ...
};
```

### 4. Test NSFW Generation

Use same prompt that was blocked on Replicate:
```
A photorealistic intimate boudoir photo of a beautiful 24-year-old French woman...
```

### 5. Compare Quality

Generate side-by-side with BigLove XL:
- Face consistency (with Elena reference)
- Skin texture (natural vs plastic)
- Overall realism

---

## Files Involved

- `app/scripts/elena-seedream-test.mjs` — CREATE: Seedream workflow script
- RunPod: `/workspace/comfyui/models/unet/seedream-4.5-*.gguf` — NEW model
- RunPod: `/workspace/comfyui/custom_nodes/` — Seedream custom nodes

---

## Constraints

- RunPod volume: 50GB, ~23GB free (after FLUX.1 dev installation)
- VRAM: RTX 4090 24GB, ~5-6GB headroom
- May need to unload BigLove to fit Seedream GGUF
- HuggingFace may require token for gated models

---

## Research (Perplexity Search)

From `docs/perplexity-searches/2026-01-29-0913.seedream-45-comfyui-local-installation-self-hosted.md`:

### Key Steps:
1. Download GGUF weights from HuggingFace (search "Seedream-4.5-GGUF")
2. Place in `ComfyUI/models/unet/` or `checkpoints/`
3. Install ComfyUI-GGUF custom node (already on RunPod ✅)
4. Import workflow JSON from z-image.ai or similar
5. ComfyUI Manager auto-installs missing nodes

### Settings:
- CFG: 5.5-7 (moderate for text legibility)
- Steps: 24-26
- Resolution: Test at 512x512 first, then upscale

### Citations:
- https://z-image.ai/blog/seedream-4-5-comfyui
- https://seed.bytedance.com/en/seedream4_5
- HuggingFace for GGUF weights

---

## Progress Log

### 2026-01-29
- Task created
- Context: Seedream 4.5 Replicate API blocks NSFW content
- Perplexity search completed: GGUF local installation is viable
- ComfyUI-GGUF already installed on RunPod volume
- Need to find and download Seedream 4.5 GGUF weights

---

## Outcome

_Fill when task is complete, then rename file to DONE-008-seedream-45-integration.md_

---

## Ralph Sessions

_Automatically filled when Ralph completes this task_
