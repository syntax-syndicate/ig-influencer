# TASK-017: Chroma1-HD Testing & Elena LoRA Training

**Status**: 🟡 In Progress
**Created**: 2026-02-06
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Evaluate Chroma1-HD (FLUX-based) for NSFW content with natural/amateur look. If quality is good, train Elena LoRA specifically for FLUX/Chroma architecture.

---

## Acceptance Criteria

- [x] Download and install Chroma1-HD on RunPod (17.8GB)
- [x] Download correct VAE (ae.safetensors) for Chroma
- [x] Test SFW generation - natural selfie look
- [x] Test NSFW generation - nude content
- [x] Evaluate skin quality vs BigLove XL vs Imagen 3
- [x] Document optimal settings (CFG, sampler, steps)
- [x] Verify no existing Elena LoRA is compatible
- [ ] Decision: train FLUX Elena LoRA or not
- [ ] (Optional) Train Elena LoRA for FLUX/Chroma

---

## Optimal Chroma Settings Found

| Setting | Value | Notes |
|---------|-------|-------|
| Model | Chroma1-HD.safetensors | 17.8GB, FLUX-based |
| Steps | 25 | 25-35 recommended |
| CFG | 3.0 | Low = more natural |
| Sampler | dpmpp_sde | or deis_2m |
| Scheduler | beta | |
| VAE | ae.safetensors | FLUX VAE, not flux2-vae |
| CLIP | t5xxl_fp8_e4m3fn.safetensors | type: "chroma" |
| Resolution | 1024x1024 | |

---

## Test Results

### SFW Test - iPhone Selfie
- **Prompt**: "iPhone photo of a woman taking a selfie in her bedroom mirror, casual look, messy hair, no makeup, natural window light"
- **Result**: ✅ Excellent natural/amateur look
- **File**: `chroma_natural_00001_.png`

### NSFW Test - Nude on Bed
- **Prompt**: "amateur photo of a nude woman lying on bed, natural body, small breasts, soft morning light through window"
- **Result**: ✅ Excellent natural body, realistic skin
- **File**: `chroma_nsfw_00001_.png`

---

## LoRA Compatibility Check

| LoRA | Architecture | Compatible? |
|------|--------------|-------------|
| elena_v5_biglove_native | SDXL | ❌ No |
| elena_v5_sdxl | SDXL | ❌ No |
| elena_zimage_v3_comfyorg | Lumina2 | ❌ No |
| elena_zimage_v1/v2 | Lumina2 | ❌ No |

**Conclusion**: Need to train new LoRA specifically for FLUX/Chroma architecture.

---

## RunPod Changes Made

1. **Deleted**: flux1-dev-fp8.safetensors (17GB) - freed space
2. **Downloaded**: Chroma1-HD.safetensors (17GB)
3. **Downloaded**: ae.safetensors (335MB) - correct FLUX VAE

---

## Progress Log

### 2026-02-06 - Checkpoint 10:30

**Done**:
- Vast.ai instances stuck in "loading" - switched to RunPod
- Started RunPod pod (RTX 4090, US-TX-3)
- Fixed ComfyUI startup (missing dependencies, NumPy version, PyTorch upgrade)
- Deleted flux1-dev-fp8 to make space for Chroma
- Downloaded Chroma1-HD (17.8GB) successfully
- Downloaded ae.safetensors VAE
- First test failed (wrong VAE, wrong CLIP type)
- Second test (SFW) - too AI looking
- Third test (SFW natural) - excellent natural look!
- Fourth test (NSFW) - excellent! User very happy with quality

**Decisions**:
- CFG 3.0 (low) = more natural look
- dpmpp_sde sampler works well
- Need "chroma" type for CLIPLoader, not "flux"
- No existing Elena LoRA is compatible with Chroma

**Next**:
- User decision: train FLUX Elena LoRA or use Chroma without face consistency
- Stop pod to save costs when done

### 2026-02-06 - Checkpoint 12:45

**Done**:
- Started FLUX Elena LoRA training on Replicate (ID: dp13p06t0hrmt0cw6bkbjqzvm0)
- Training in progress: 42% complete, ~35 min remaining
- Dataset: 56 images from Cloudinary with captions
- Settings: 4000 steps, rank 32, LR 1e-4
- Tested Chroma explicit NSFW generation - **FAILED**
  - Glitches, body deformations, hands turn into blobs
  - Explicit poses (masturbation, hands on body) cause severe artifacts
- Tested simpler poses - better but still inconsistent
- Tested BigLove XL for comparison - similar issues with explicit content
- Researched new approaches beyond LoRA

**Findings - Chroma NSFW Quality**:
- SFW/suggestive: Excellent quality
- Simple nude poses: Good quality
- Explicit poses (hands on body): Severe glitches, unusable
- Conclusion: Chroma not suitable for explicit NSFW content

**New Approaches Discovered**:
1. **ACE++** (Alibaba) - 99% face consistency, no training, single reference photo
2. **FLUX Kontext** - native character consistency, multiple reference images
3. **FLUX 2 Klein Edit** - unified generation + editing

**Decision**:
- Abandon Chroma for explicit NSFW
- Try ACE++ for face consistency without LoRA training
- Accept "new Elena" identity based on reference images

**Next**:
- Install ACE++ on RunPod
- Test ACE++ face swap workflow
- If successful, use for consistent character generation

---

## Outcome

_Fill when task is complete_
