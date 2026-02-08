# TASK-018: ACE++ Face Consistency Test

**Status**: ❌ Abandoned (ACE++ development suspended by Alibaba, plastic skin, pivoted to ZiT + LoRA)
**Created**: 2026-02-06
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Test ACE++ (Alibaba) Portrait LoRA for Elena face consistency — zero-training character generation from a single reference photo. If it works, this replaces LoRA training entirely and solves the cross-architecture compatibility problem.

---

## Why ACE++

Every Elena LoRA is locked to one architecture:
- elena_v5_biglove → SDXL only
- elena_zimage_v3 → Lumina2 only
- Nothing works on FLUX/Chroma

ACE++ works on top of FLUX.1-Fill-dev and claims 92%+ face consistency from a single reference photo, no training. This would let us use ANY FLUX-based model (Chroma, HiDream, etc.) with Elena's face.

---

## Acceptance Criteria

- [ ] FLUX.1-Fill-dev FP8 downloaded on RunPod (11.9GB)
- [ ] ACE++ Portrait LoRA downloaded (`comfyui_portrait_lora64.safetensors`)
- [ ] ComfyUI-ACE_Plus custom node installed
- [ ] Disk space managed (delete unused models if needed)
- [ ] Generate SFW test: Elena face reference → new pose/scene
- [ ] Generate NSFW test: Elena face reference → nude content
- [ ] Face consistency score assessed (target: 90%+)
- [ ] Skin quality assessed vs BigLove XL baseline
- [ ] Document optimal settings (steps, CFG, guidance)
- [ ] Decision: ACE++ viable for Elena pipeline? Y/N

---

## Approach

### 1. Prepare RunPod Environment

Current volume usage (50GB limit):
- Chroma1-HD: 17GB
- BigLove XL: 7GB
- T5-XXL FP8: 4.6GB
- CLIP-L: 0.2GB
- ae.safetensors VAE: 0.3GB
- Elena LoRA v5: 0.2GB
- Other models: ~5GB
- **Free**: ~15GB estimated

Need: FLUX.1-Fill-dev FP8 (11.9GB) + ACE++ Portrait LoRA (~1-2GB)

**Plan**: Delete Chroma1-HD (17GB) to free space → download FLUX.1-Fill-dev FP8 (11.9GB) + ACE++ LoRA (~1-2GB). Chroma was tested and won't be used for explicit NSFW anyway.

### 2. Install ACE++ Custom Node

```bash
cd /workspace/ComfyUI/custom_nodes
git clone https://github.com/ali-vilab/ACE_plus.git
# Copy ComfyUI node
cp -r ACE_plus/workflow/ComfyUI-ACE_Plus ./
```

### 3. Download Models

```bash
# FLUX.1-Fill-dev FP8 (base model for ACE++)
# From HuggingFace: flux1-fill-dev-fp8.safetensors → /workspace/ComfyUI/models/diffusion_models/ or /checkpoints/

# ACE++ Portrait LoRA
# From HuggingFace: ali-vilab/ACE_Plus → portrait/comfyui_portrait_lora64.safetensors
# → /workspace/ComfyUI/models/loras/
```

### 4. Test SFW Generation

- Input: `elena_face_ref.jpg` (already on RunPod)
- Prompt: "iPhone selfie in café, natural lighting, casual outfit"
- Compare face to reference

### 5. Test NSFW Generation

- Input: `elena_face_ref.jpg`
- Prompt: explicit nude content (Fanvue use case)
- Check face consistency + body quality + skin texture

### 6. Evaluate & Document

- Compare to BigLove XL + Elena LoRA v5 baseline
- Assess: face accuracy, skin quality, pose variety
- Make go/no-go decision

---

## Files Involved

- `app/scripts/runpod-connect.mjs` — Start/stop RunPod pod
- New script: `app/scripts/ace-plus-test.mjs` — ACE++ test generation
- `features/comfyui-generation-workflow/tasks/TASK-018-ace-plus-face-consistency.md` — This task

---

## Constraints

- RunPod volume is 50GB — must manage disk space carefully
- RTX 4090 = 24GB VRAM — FLUX.1-Fill-dev FP8 should fit
- ACE++ requires FLUX.1-Fill-dev as base (not FLUX.1-dev or Chroma)
- Portrait LoRA recommended over FFT model (more stable results per docs)
- Face consistency may vary — generate multiple images for fair assessment

---

## Key Resources

- GitHub: https://github.com/ali-vilab/ACE_plus
- HuggingFace models: https://huggingface.co/ali-vilab/ACE_Plus
- ComfyUI workflows: https://www.runcomfy.com/comfyui-workflows/ace-plus-plus-character-consistency
- Base model: https://huggingface.co/black-forest-labs/FLUX.1-Fill-dev

---

## Progress Log

### 2026-02-06
- Task created
- Research complete: ACE++ uses FLUX.1-Fill-dev base + Portrait LoRA for face consistency
- Plan: delete Chroma, install FLUX.1-Fill-dev FP8 + ACE++ on RunPod

---

## Outcome

_Fill when task is complete, then rename file to DONE-018-ace-plus-face-consistency.md_

---

## Ralph Sessions

_Automatically filled when Ralph completes this task_
