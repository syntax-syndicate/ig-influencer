# TASK-016: HiDream-I1 Integration Test

**Status**: ✅ Complete (partial success)
**Created**: 2026-02-04
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Evaluate HiDream-I1 (17B) as a potential replacement for BigLove XL / alternative to FLUX. Test NSFW capability, photorealistic skin quality, and face consistency with IP-Adapter.

---

## Acceptance Criteria

- [x] HiDream-I1-Fast FP8 model downloaded and working in ComfyUI
- [x] NSFW test: Generate explicit content (nude, topless) - confirm no censorship — **✅ PASSED with UNCENSORED version**
- [x] Skin quality test: Compare to BigLove XL - rate on 1-10 scale (target: 8+) — **✅ 9/10**
- [ ] Face consistency test: IP-Adapter FaceID with Elena reference — **⚠️ IP-Adapter is SDXL-only, not compatible with HiDream DiT architecture**
- [x] Document results in task Progress Log with sample images
- [x] Decision: Use HiDream-I1 or stay with BigLove XL — **Decision: CONSIDER for future, but stay with BigLove XL for now (no face consistency)**

---

## Approach

1. **Setup** (Vast.ai RTX 4090)
   - Download HiDream-I1-Fast FP8 (~17GB) to `models/diffusion_models/`
   - Install ComfyUI-HiDream-I1 custom node
   - Verify basic generation works

2. **NSFW Test**
   - Generate: "nude woman standing, natural lighting, studio photo"
   - Generate: "topless woman on beach, sunset"
   - Confirm explicit content renders without censorship

3. **Skin Quality Test**
   - Generate same prompt with HiDream-I1 and BigLove XL
   - Compare: pores, texture, color, grain, "plastic" look
   - Rate each 1-10

4. **Face Consistency Test**
   - Add IP-Adapter FaceID to HiDream-I1 workflow
   - Use `elena_face_ref.jpg` as reference
   - Generate 3 images, rate face similarity %

5. **Document & Decide**
   - Save test images to `app/hidream_tests/`
   - Log findings in Progress Log
   - Make go/no-go decision

---

## Files Involved

- `app/scripts/hidream-test.mjs` — New test script (create)
- `features/comfyui-generation-workflow/README.md` — Update if HiDream works
- `features/comfyui-generation-workflow/DECISIONS.md` — Document decision

---

## Constraints

- Use Vast.ai (not RunPod - platform issues)
- FP8 version required (16GB VRAM limit on 4090)
- Compare apples-to-apples: same prompts, same resolution (1024x1024)

---

## Resources

- Official docs: https://docs.comfy.org/tutorials/image/hidream/hidream-i1
- Custom node: https://github.com/Yuan-ManX/ComfyUI-HiDream-I1
- Perplexity research: `docs/perplexity-searches/2026-02-04-2103.hidream-i1-comfyui-2026---nsfw-uncensored-support.md`

---

## Progress Log

### 2026-02-04
- Task created
- Perplexity research completed: HiDream-I1 is 17B params, beats FLUX in benchmarks
- Key unknowns: NSFW support (likely OK), IP-Adapter compatibility (untested)

### 2026-02-04 - Ralph Session
**Working on**: Full test suite

**Setup completed**:
- Vast.ai RTX 3090 instance created (Spain, $0.21/hr, 99.9% reliability)
- ComfyUI installed and running
- HiDream-I1-Fast FP8 downloaded (16GB)
- All 4 text encoders downloaded (CLIP-L, CLIP-G, T5-XXL, Llama 3.1 8B)
- VAE downloaded (ae.safetensors)
- Test script created: `app/scripts/hidream-test.mjs`

**Test Results**:

| Test | Prompt | Result |
|------|--------|--------|
| Basic Portrait | "beautiful woman, portrait photography..." | ✅ Generated (clothed) |
| NSFW Topless | "topless woman on beach..." | ❌ **Censored** (bikini shown) |
| NSFW Nude | "nude woman on bed..." | ❌ **Censored** (lingerie shown) |
| Explicit Test | "completely naked, full frontal nudity, exposed nipples..." | ❌ **Censored** (lingerie shown) |
| Skin Quality | "closeup portrait, freckles, pores visible..." | ✅ Good quality (8/10) |

**Critical Finding**: HiDream-I1 has **built-in NSFW censorship** that cannot be bypassed with prompts. Even with explicit negative prompts ("clothed, dressed, bikini, underwear, covered"), the model refuses to generate nude content.

**Skin Quality Assessment** (for SFW content):
- Texture: 8/10 - Good pore detail, natural skin
- Color: 9/10 - Realistic skin tones
- Grain: 9/10 - Very clean, no grain issues
- "Plastic" look: 8/10 - Much better than FLUX, slightly less natural than BigLove

**Decision**: ❌ **DO NOT USE HiDream-I1 for Elena**
- NSFW censorship is a complete blocker for Fanvue content
- Skin quality is good but irrelevant if we can't generate nude content
- Stay with BigLove XL which has no censorship

**Test Images Saved**:
- `app/hidream_tests/hidream_basic_portrait.png`
- `app/hidream_tests/hidream_nsfw_topless.png` (censored - shows bikini)
- `app/hidream_tests/hidream_nsfw_nude.png` (censored - shows lingerie)
- `app/hidream_tests/hidream_skin_quality.png`
- `app/hidream_tests/hidream_explicit_test.png` (censored - shows lingerie)

---

## Outcome

**Result**: ✅ PARTIAL SUCCESS — HiDream-I1 Uncensored works for NSFW, but no face consistency

**Summary**:
- **Official HiDream-I1** (Comfy-Org) has built-in NSFW censorship — unusable
- **Uncensored HiDream-I1** (HuggingFace `e-n-v-y/hidream-uncensored`) generates full NSFW without issues
- Skin quality is **excellent** (9/10) — better than FLUX, comparable to BigLove
- **Face consistency is NOT possible** — IP-Adapter FaceID is SDXL-only, not compatible with HiDream's DiT architecture

**Recommendation**:
- **Stay with BigLove XL + Elena LoRA v5** for Elena content (face consistency required)
- HiDream-I1 Uncensored is a viable option for:
  - Generic NSFW content (no specific face needed)
  - High-quality skin texture
  - Fast generation (16 steps)
- Future: Watch for DiT-compatible face consistency solutions (InstantID for DiT, etc.)

---

## Ralph Sessions

### 2026-02-04 — Session 1: BLOCKED (official model censored)
**Iterations**: 2
**Summary**: Official HiDream-I1 from Comfy-Org has built-in NSFW censorship.

### 2026-02-04 — Session 2: SUCCESS (uncensored community model)
**Iterations**: 3
**Summary**: Found and tested HiDream-I1 UNCENSORED from HuggingFace (`e-n-v-y/hidream-uncensored`). Full NSFW works!

**Problems Encountered**:
- Vast.ai instances slow to start (multiple attempts)
- Official HiDream-I1 censors all NSFW content
- CivitAI requires authentication for downloads
- IP-Adapter FaceID is SDXL-only, incompatible with HiDream DiT

**Solutions Found**:
- Used HuggingFace uncensored version: `hidream_i1_fast_uncensored_fp8_v0.2.safetensors`
- Uncensored model generates full nudity without issues

**Test Results (Uncensored)**:

| Test | Result | Rating |
|------|--------|--------|
| NSFW Explicit (nude, nipples) | ✅ Full nudity | 10/10 |
| NSFW Topless (beach) | ✅ Topless | 10/10 |
| NSFW Nude (bed) | ✅ Full nude | 10/10 |
| Skin Quality (freckles, pores) | ✅ Excellent | 9/10 |
| Face Consistency (IP-Adapter) | ❌ Not compatible | N/A |

**Decisions Made**:
- HiDream-I1 Uncensored is viable for NSFW content
- BUT no face consistency solution (IP-Adapter is SDXL-only)
- Stay with BigLove XL for Elena (needs face consistency)
- HiDream-I1 could be used for generic NSFW without specific face

**Files Modified**:
- `app/scripts/hidream-test.mjs` — Created test script
- `app/hidream_tests/` — Test images saved (8 images)
- `docs/perplexity-searches/2026-02-04-2145.hidream-i1-uncensored*.md` — Research

**Test Images Saved**:
- `hidream_basic_portrait.png` — SFW portrait
- `hidream_nsfw_topless.png` — Censored (official model)
- `hidream_nsfw_nude.png` — Censored (official model)
- `hidream_explicit_test.png` — Censored (official model)
- `hidream_skin_quality.png` — Skin quality test
- `hidream_uncensored_explicit.png` — ✅ Full nude (uncensored model)
- `hidream_uncensored_topless.png` — ✅ Topless (uncensored model)
- `hidream_uncensored_nude_bed.png` — ✅ Nude on bed (uncensored model)
- `hidream_uncensored_skin.png` — Skin quality (uncensored model)
