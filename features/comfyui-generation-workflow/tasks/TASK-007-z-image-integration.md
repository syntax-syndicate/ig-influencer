# TASK-007: Z-Image Turbo Skin Quality Test

**Status**: ❌ Blocked (RunPod infrastructure issues)
**Created**: 2026-01-28
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Test if Z-Image-Turbo produces realistic skin texture (not plastic like FLUX) and can replace BigLove XL as our primary generation model.

---

## Acceptance Criteria

- [ ] Z-Image-Turbo model downloaded to RunPod volume
- [ ] Basic workflow script `elena-z-image-test.mjs` created
- [ ] Test generation produces image with **realistic skin** (not AI-clean/plastic)
- [ ] Compare output quality to BigLove XL reference
- [ ] Elena LoRA compatibility tested (if model supports SDXL LoRAs)
- [ ] Document findings: skin quality, speed, VRAM usage

---

## Approach

1. SSH to RunPod pod
2. Check disk space: `df -h /workspace`
3. Download Z-Image-Turbo from HuggingFace (`Tongyi-MAI/Z-Image`)
4. Create `elena-z-image-test.mjs` workflow script
5. Run test generation with Elena-style prompt
6. Download and evaluate skin quality
7. Compare to BigLove XL output
8. Document results

---

## Files Involved

- `app/scripts/elena-z-image-test.mjs` — New workflow script (CREATE)
- RunPod volume: `/workspace/comfyui/models/checkpoints/` — Z-Image model

---

## Constraints

- RunPod volume: 50GB total, need to check available space
- Z-Image-Turbo: ~6GB (much smaller than FLUX)
- RTX 4090 (24GB VRAM) should handle easily
- Use **DPMPP SDE sampler** (recommended for realistic skin)
- Use **8 steps** (Z-Image-Turbo is optimized for few steps)

---

## Technical Details

**Download source:**
```bash
# HuggingFace - Tongyi-MAI
https://huggingface.co/Tongyi-MAI/Z-Image-Turbo/resolve/main/z-image-turbo.safetensors
```

**Workflow parameters (from research):**
```javascript
const CONFIG = {
  checkpoint: 'z-image-turbo.safetensors',
  steps: 8,           // Z-Image optimized for few steps
  cfg: 4.0,           // Low CFG like SDXL
  sampler: 'dpmpp_sde', // Best for realistic skin
  scheduler: 'karras',
  width: 1024,
  height: 1024,
};
```

---

## Key Question

Does Z-Image-Turbo produce **film-grain natural skin** like BigLove XL, or **plastic AI-clean skin** like FLUX?

Research suggests Z-Image should produce natural skin textures, but we need to verify.

---

## Progress Log

### 2026-01-28
- Task created
- Context: FLUX (both Klein 9B and [dev] 32B) rejected due to plastic skin
- Perplexity research shows Z-Image produces "natural skin textures with film-grain aesthetics"
- Z-Image-Turbo is 6B params (vs FLUX 32B) = more efficient
- Waiting for RunPod GPU availability (US-TX-3 shortage)

### 2026-01-29 - Ralph Session 1 (BLOCKED)
- **Attempted datacenters**: US-TX-3 (no GPUs), US-NC-1 (stuck), US-TX-4 (stuck), EUR-IS-1 (stuck)
- **GPU types tried**: RTX 4090, RTX 3090, L40S
- **Issue**: All pods get stuck at "Rented" status without starting
- **Root cause**: RunPod platform-wide infrastructure issue
- **Recommendation**: Wait and retry later, or try during off-peak hours

---

## Outcome

_Fill when test complete_

---

## Ralph Sessions

_Automatically filled when Ralph completes iterations_
