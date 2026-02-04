# ComfyUI Generation Workflow

> LoRA training, checkpoints, IP-Adapter FaceID, face consistency, and image quality

**Status**: ✅ Working (end-to-end test passed)
**Last updated**: 4 February 2026 (HiDream-I1 evaluation complete)

---

## Current State

Image generation is **95% working**. Body consistency and image quality are now **excellent**. Main remaining issue is **face refinement** (face is ~85% accurate, needs to be 95%+).

### Active Configuration

| Component | Value | Notes |
|-----------|-------|-------|
| **Checkpoint** | `bigLove_xl1.safetensors` | Better than BigLust for skin |
| **LoRA** | `elena_v5_biglove_native.safetensors` | Strength: **1.1** |
| **Face consistency** | IP-Adapter FaceID v2 | Weight: 0.85 |
| **Face reference** | `elena_face_ref.jpg` | Frontal photo |
| **Resolution** | 1024x1024 | Square, upscaled 4x |
| **Steps** | 25 | |
| **CFG** | **4.0** | Low for SDXL = less grain |
| **Sampler** | `dpmpp_2m_sde` + `karras` | |
| **Post-process** | 4x-UltraSharp | Upscale to 4096x4096 |
| **Face enhancement** | FaceDetailer (Impact Pack) | denoise 0.4 |

### File Locations (Local)

- LoRA: `~/ComfyUI/models/loras/elena_v4_cloud.safetensors`
- Checkpoint: `~/ComfyUI/models/checkpoints/bigLove_xl1.safetensors`
- Face ref: `~/ComfyUI/input/elena_face_ref.jpg`
- Dataset: `lora-dataset-elena-cloud/10_elena/` (35 images)

### RunPod Configuration (US-TX-3)

| Setting | Value |
|---------|-------|
| **Pod ID** | `0nfcd8w6s1f0ux` (stopped, resume with runpod-connect.mjs) |
| **Volume** | `aml40rql5h` (elena-comfyui-US-TX-3, 50GB) ✅ PERSISTENT |
| **GPU** | RTX 4090 (24GB) |
| **ComfyUI URL** | `https://{pod-id}-8188.proxy.runpod.net` (dynamic) |
| **Speed** | ~50s/image |
| **Datacenter** | US-TX-3 |
| **PyTorch** | 2.4.0+cu121 |

**Installed Models** (persistent on volume):
- ✅ **BigLove XL** (6.94GB) - `bigLove_xl1.safetensors`
- ✅ Elena LoRA v4 (218MB)
- ✅ IP-Adapter FaceID v2 (1.4GB)
- ✅ CLIP Vision (2.4GB)
- ✅ FaceID LoRA (355MB)
- ✅ 4x-UltraSharp (64MB)
- ✅ SAM vit_b
- ✅ elena_face_ref.jpg
- ✅ **FLUX.1 [dev] FP8** (17GB) - `flux1-dev-fp8.safetensors` (unified checkpoint)
- ✅ **T5-XXL FP8** (4.6GB) - `t5xxl_fp8_e4m3fn.safetensors`
- ✅ **CLIP-L** (235MB) - `clip_l.safetensors`
- ❌ FLUX.2 Klein 9B removed (replaced by FLUX.1 [dev])
- ❌ Qwen 3 8B removed (freed space for FLUX.1 [dev])

**Custom Nodes**: ComfyUI_IPAdapter_plus, ComfyUI-Impact-Pack, **ComfyUI-GGUF**

### Quick Start RunPod

```bash
# 1. Start pod (creates/resumes)
node app/scripts/runpod-connect.mjs
# Output: ComfyUI: https://{pod-id}-8188.proxy.runpod.net

# 2. Generate image (replace URL from step 1)
COMFYUI_URL=https://{pod-id}-8188.proxy.runpod.net node app/scripts/elena-simple-test.mjs

# 3. Stop pod (saves $, data preserved)
node app/scripts/runpod-connect.mjs --stop

# Check status
node app/scripts/runpod-connect.mjs --status
```

**Note**: Data persists on volume. You can stop/terminate pods without losing models.

---

## What Works ✅

| What | Details |
|------|---------|
| **BigLove XL checkpoint** | Better skin tones than SDXL Base or BigLust |
| **LoRA V4 @ 0.7** | Excellent body proportions, less "overfit" than 1.0 |
| **IP-Adapter FaceID v2** | Good face consistency with pose freedom |
| **CFG 4.0 + dpmpp_2m_sde** | Reduces grain significantly vs CFG 7+ |
| **4x-UltraSharp upscaler** | Works locally on Mac M3 Pro |
| **FaceDetailer (Impact Pack)** | Améliore qualité visage + peau, denoise 0.4 |
| **Python 3.10 venv** | Required for Impact Pack (3.9 incompatible) |
| **Simplified workflow** | Single IP-Adapter (face only), no style adapter needed |
| **Prompt body control** | `natural breasts D cup` fonctionne bien |
| **Batch generation** | 5 photos en ~14 min local |
| **bf16 training** | Prevents NaN loss (vs fp16) |
| **LR 5e-5** | Stable training (vs 1e-4 which caused NaN) |
| **RunPod RTX 4090** | ~50s/image with Qwen, pod `dortewt0b3tom3` |
| **Qwen-Image-Edit** | Works! Generation test successful (~50s for 1024x1024) |
| **FLUX.2 Klein 9B** | Works but "AI-clean" look - distilled model limitation |
| **BigLove → FLUX refinement** | Two-stage pipeline: realistic base + face consistency |
| **ReferenceLatent (FLUX)** | Injects face reference into conditioning, works well |
| **Z-Image Full** | **AMAZING skin quality** - natural pores, freckles, film grain (34s on RTX 4090) |
| **Vast.ai** | Reliable RunPod alternative - RTX 4090 at $0.14/hr, actually works |
| **Z-Image Official Model** | 12.3GB from Comfy-Org/z_image HuggingFace - WORKING (previous 7.9GB was wrong) |
| **Elena LoRA v5 BigLove-native** | Trained ON BigLove XL, strength 1.1, 95% face consistency |
| **LoRA + FaceDetailer + UltraSharp** | Best pipeline: generate → FaceDetailer 0.5 → 4x upscale |
| **HiDream-I1 Uncensored** | NSFW works with `e-n-v-y/hidream-uncensored` (HuggingFace), skin 9/10 |

## What Doesn't Work ❌

| What | Details |
|------|---------|
| **Z-Image Omni face reference** | TextEncodeZImageOmni image1/image2/image3 inputs produce severe corruption - feature is broken |
| **Elena LoRA v2 on Z-Image Full** | LoRA trained on ostris/Z-Image-De-Turbo - incompatible architecture with Comfy-Org model |
| **CivitAI direct download** | Nécessite token API pour télécharger BigLove sur RunPod |
| **Voyeur silhouettes in prompts** | SDXL ignore les silhouettes floues en arrière-plan |
| **ImageSharpen** | Amplifies grain |
| **LoRA weight 1.0** | Too strong, reduces flexibility |
| **CFG 7.0+** | Creates grain/noise |
| **Dual IP-Adapter (face + style)** | Unnecessary complexity, style can come from prompt |
| **fp16 training** | Causes NaN loss |
| **LR 1e-4** | Too high, causes NaN |
| **FLUX.2 Klein 9B** | Rendu trop "propre", peau plastique (distilled = speed not quality) |
| **FLUX.1 [dev] Full 32B** | Même problème de peau plastique que Klein - inherent to FLUX architecture |
| **RunPod (Jan 2026)** | Platform-wide issues - pods stuck at "RUNNING" with runtime null |
| **HiDream-I1 Official** | Built-in NSFW censorship - generates bikinis/lingerie instead of nudity |
| **HiDream-I1 + IP-Adapter** | IP-Adapter FaceID is SDXL-only, not compatible with HiDream DiT architecture |

## Open Questions ❓

- Qwen2.5-VL pour copier le visage de référence ?
- Face-only LoRA from cropped headshots?

---

## Active Tasks

| # | Task | Status | Priority | Link |
|---|------|--------|----------|------|
| **015** | **Elena LoRA v5 for BigLove XL** | ✅ Complete | - | [→](./tasks/TASK-015-elena-lora-v5-biglove.md) |
| 014 | Elena LoRA on Comfy-Org Z-Image | ✅ Done (v3) | - | [→](./tasks/DONE-014-elena-lora-comfyorg-zimage.md) |
| 011 | Z-Image Elena LoRA Training (ostris) | ❌ Incompatible | - | [→](./tasks/TASK-011-zimage-elena-lora-training.md) |
| 010 | Z-Image Face Reference Fix | ❌ Failed | - | [→](./tasks/TASK-010-zimage-face-reference-fix.md) |
| 009 | Z-Image Skin Quality Test (Vast.ai) | 🟡 In Progress | High | [→](./tasks/TASK-009-local-comfyui-mac.md) |
| 004 | Face refinement (85% → 95%) | 🟡 In Progress | Medium | [→](./tasks/TASK-004-qwen-face-refinement.md) |
| 008 | Seedream 4.5 ComfyUI Integration | ❌ Blocked | Low | [→](./tasks/TASK-008-seedream-45-integration.md) |

**Status**: TASK-015 COMPLETE
- ✅ `elena_v5_biglove_native.safetensors` - trained ON BigLove XL (218MB, local)
- Best settings: LoRA 1.1, FaceDetailer 0.5, 4x-UltraSharp
- Face is 95% consistent (but NOT original Elena - "new Elena" character)

### Backlog

- Create face-only LoRA from cropped headshots
- Add 15-50 more images to dataset
- Retrain with Network Dim 64 (vs 32)
- Use unique trigger word ("sks" vs "elena")

## Blocked/Abandoned Tasks

| # | Task | Status | Link |
|---|------|--------|------|
| 006 | FLUX.1 [dev] Full installation | ❌ Blocked (plastic skin) | [→](./tasks/TASK-006-flux2-dev-installation.md) |

## Completed Tasks

| # | Task | Completed | Link |
|---|------|-----------|------|
| 016 | HiDream-I1 Integration Test | 4 Feb 2026 | [→](./tasks/DONE-016-hidream-i1-integration.md) |
| 013 | Z-Image Official Models Debug | 31 Jan 2026 | [→](./tasks/DONE-013-zimage-official-models-debug.md) |
| 001 | Grain reduction (CFG 4.0 + dpmpp_2m_sde) | 23 Jan 2026 | [→](./tasks/DONE-001-grain-reduction.md) |
| 005 | RunPod persistent setup | 25 Jan 2026 | [→](./tasks/DONE-005-runpod-persistent-setup.md) |

---

## Quick Links

- [Decisions →](./DECISIONS.md)
- [Tests →](./TESTS.md)
- [Tasks →](./tasks/)

---

## Scripts

| Script | Purpose |
|--------|---------|
| `app/scripts/elena-simple-test.mjs` | **Simplified workflow** (recommended) |
| `app/scripts/elena-detailer-test.mjs` | **FaceDetailer workflow** (best quality) |
| `app/scripts/elena-hotel-pack.mjs` | **Batch 5 photos** explicit hotel pack |
| `app/scripts/elena-luxury-wife-pack.mjs` | **Batch 5 photos** luxury wife voyeur pack |
| `app/scripts/runpod-lora-training.mjs` | RunPod pod creation & training |
| `app/scripts/test-elena-lora-simple.mjs` | Test LoRA without FaceID |
| `app/scripts/elena-instantid-test.mjs` | Test InstantID workflow |
| `app/scripts/runpod-quality-tests.mjs` | Quality tests on RunPod |
| `app/scripts/elena-biglove-batch.mjs` | Batch generation with BigLove |

---

## Elena Physical Description (for prompts)

**Face**:
- Shape: Oval/heart, soft contours, high cheekbones
- Eyes: Hazel-green with golden/honey tones
- Nose: Straight with slight slope, rounded tip
- Lips: Full, larger lower lip, defined cupid's bow
- Beauty mark: Right cheek, near cheekbone (signature!)
- Skin: Golden tan, sun-kissed, smooth texture

**Hair**:
- Color: Bronde - dark roots + golden blonde/honey balayage
- Style: Mid-length, textured beach waves

**Body**:
- Athletic but curvy
- Slim waist, wide hips
- Natural breasts D cup (use in prompt)
- Toned arms

**Signature accessories**:
- Layered gold necklaces with medallion
- Gold chain bracelet
