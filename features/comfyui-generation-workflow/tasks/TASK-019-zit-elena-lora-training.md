# TASK-019: Z-Image Turbo NSFW (ZiT) + Elena LoRA Training

**Status**: 🟡 In Progress
**Created**: 2026-02-06
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Train an Elena character LoRA on Z-Image Turbo using Ostris AI Toolkit, then test NSFW generation with face consistency. This is the 2026 approach: Z-Image skin quality + trained LoRA for face identity + native NSFW support.

---

## Why ZiT + LoRA

| What we tried | Problem |
|---|---|
| BigLove XL + Elena LoRA v5 | SDXL = 2024 quality |
| Chroma | Explicit NSFW = glitches/deformations |
| FLUX | Plastic skin |
| HiDream | No face consistency tools |
| ACE++ | Abandoned by Alibaba |
| IP-Adapter FaceID | Distorts face |

**Z-Image Turbo** = S3-DiT architecture, natural skin with pores/grain, uncensored, 8-step inference.
**ZiT v4.0** = NSFW-optimized merge by 6tZ (top CivitAI creator).
**Ostris AI Toolkit** = LoRA training for Z-Image Turbo with de-distillation adapter.
**Result** = 2026-quality skin + Elena face consistency + explicit NSFW.

---

## Acceptance Criteria

- [ ] ZiT checkpoint downloaded on RunPod (or base Z-Image Turbo bf16)
- [ ] Qwen 3 4B text encoder downloaded (8GB)
- [ ] ae.safetensors VAE present (already have)
- [ ] Ostris AI Toolkit installed on RunPod
- [ ] Ostris de-distillation training adapter v2 downloaded (340MB)
- [ ] 56-image Elena dataset + captions uploaded to pod
- [ ] Captions adapted for Z-Image Turbo format (trigger token `<elena>`)
- [ ] LoRA training completed (4000 steps, rank 16, LR 1e-4)
- [ ] Generate SFW test images with Elena LoRA on ZiT
- [ ] Generate NSFW test images (nude, explicit poses)
- [ ] Face consistency assessed (target: 90%+)
- [ ] Skin quality assessed vs BigLove XL baseline
- [ ] Document optimal inference settings
- [ ] Decision: ZiT + Elena LoRA viable for Fanvue pipeline? Y/N

---

## Models Required

| Model | Size | Source | Destination on Pod |
|---|---|---|---|
| `z_image_turbo_bf16.safetensors` | 12.3 GB | HuggingFace Comfy-Org/z_image_turbo | `/workspace/comfyui/models/diffusion_models/` |
| `qwen_3_4b.safetensors` | 8.04 GB | HuggingFace Comfy-Org/z_image_turbo | `/workspace/comfyui/models/text_encoders/` |
| `ae.safetensors` | 335 MB | Already on pod | `/workspace/comfyui/models/vae/` |
| `zimage_turbo_training_adapter_v2.safetensors` | 340 MB | HuggingFace ostris/zimage_turbo_training_adapter | `/workspace/ai-toolkit/` |

**Optional**: ZiT NSFW v3.0 from CivitAI (~20GB AIO) — if base Z-Image Turbo isn't NSFW enough.

**Disk budget** (50GB volume):
- Current usage: ~26GB (after deleting Chroma + FLUX Fill)
- New models: 12.3 + 8 + 0.34 = ~21GB
- Need to free BigLove XL (6.5GB) + old Elena LoRAs (~0.6GB) + other unused
- Tight but feasible

---

## Training Configuration

### Ostris AI Toolkit YAML

```yaml
job: extension
config:
  name: "elena_zit_lora_v1"
  process:
    - type: diffusion_trainer
      training_folder: "/workspace/ai-toolkit/output/elena_zit_lora_v1"
      device: "cuda"
      trigger_word: "<elena>"

      network:
        type: "lora"
        linear: 16
        linear_alpha: 16

      save:
        dtype: "bf16"
        save_every: 500
        max_step_saves_to_keep: 8

      datasets:
        - folder_path: "/workspace/datasets/elena"
          caption_ext: "txt"
          caption_dropout_rate: 0.05
          cache_latents_to_disk: true
          resolution: [512, 768, 1024]

      train:
        batch_size: 1
        gradient_accumulation: 2
        steps: 4000
        lr: 0.0001
        train_unet: true
        train_text_encoder: false
        gradient_checkpointing: true
        noise_scheduler: "flowmatch"
        optimizer: "adamw8bit"
        dtype: "bf16"

      model:
        name_or_path: "Tongyi-MAI/Z-Image-Turbo"
        arch: "zimage:turbo"
        assistant_lora_path: "ostris/zimage_turbo_training_adapter/zimage_turbo_training_adapter_v2.safetensors"

      sample:
        sampler: "flowmatch"
        sample_every: 500
        width: 1024
        height: 1024
        sample_steps: 8
        guidance_scale: 0
        seed: 42
        samples:
          - prompt: "<elena>, photorealistic portrait, natural skin, 85mm lens, soft window light"
          - prompt: "<elena>, full body photo, casual outfit, golden hour, outdoor cafe"
          - prompt: "<elena>, bedroom selfie, iPhone photo, natural morning light"
          - prompt: "<elena>, nude, lying on bed, natural body, soft morning light, amateur photo"
```

### Key Parameters

| Parameter | Value | Reason |
|---|---|---|
| Steps | 4000 | Large dataset (56 images) needs more steps |
| Rank | 16 | Good balance for character LoRA |
| LR | 1e-4 | Standard for Z-Image Turbo |
| Trigger | `<elena>` | Rare token, avoids vocab collision |
| Adapter | v2 (340MB) | Better than v1 for character work |
| Guidance | 0 | Required for Turbo distilled model |
| Inference steps | 8 | Turbo speed |

---

## Approach

### Phase 1: Environment Setup

1. Free disk space on RunPod volume:
   - Delete BigLove XL (6.5GB) — replaced by Z-Image Turbo
   - Delete old Elena LoRAs (elena_v4_cloud, ip-adapter-faceid LoRA)
   - Delete unused controlnet, clip_vision if not needed
2. Download Z-Image Turbo bf16 (12.3GB)
3. Download Qwen 3 4B text encoder (8GB)
4. Install Ostris AI Toolkit
5. Download training adapter v2

### Phase 2: Dataset Preparation

1. Upload 56 Elena images from `lora-dataset-elena-zimage/`
2. Generate captions using existing `generate-elena-captions-v3-biglove.mjs` as base
3. Adapt captions: replace trigger `elena` → `<elena>`, verify format
4. Ensure images are 1024x1024 (resize if needed)

### Phase 3: Training

1. Create YAML config
2. Run training: ~2-3 hours on RTX 4090
3. Monitor samples every 500 steps
4. Save checkpoints every 500 steps (keep 8)

### Phase 4: Testing

1. Load Z-Image Turbo + Elena LoRA in ComfyUI
2. Test SFW: portraits, selfies, different scenes
3. Test NSFW: nude, explicit poses, different lighting
4. Compare face consistency across images
5. Compare skin quality to BigLove XL baseline

### Phase 5: Evaluate

1. If face consistency >= 90% AND explicit NSFW works → SUCCESS
2. If face OK but NSFW glitches → try ZiT v3.0/v4.0 NSFW variant
3. If face not consistent → increase rank to 32, retrain
4. Document everything for future reference

---

## Dataset

- **Location**: `lora-dataset-elena-zimage/` (56 JPG images)
- **Captions**: Generate from `app/scripts/generate-elena-captions-v3-biglove.mjs` (has all 56 captions with face details)
- **Format**: `<elena>, [face details], [pose], [clothing], [scene]`
- **Face prefix**: `full pouty lips, high cheekbones, angular jawline, hazel-green eyes, tan skin, beauty mark on right cheek, brunette with blonde highlights`

---

## Inference Settings (ComfyUI)

| Setting | Value |
|---|---|
| Checkpoint | z_image_turbo_bf16.safetensors (or ZiT) |
| Text Encoder | qwen_3_4b.safetensors |
| VAE | ae.safetensors |
| LoRA | elena_zit_v1.safetensors |
| LoRA weight | 0.8-1.0 |
| Steps | 8 |
| CFG | 0 (or 1.0 for some samplers) |
| Sampler | euler |
| Scheduler | sgm_uniform |
| Resolution | 1024x1024 |

---

## Key Resources

- Ostris AI Toolkit: https://github.com/ostris/ai-toolkit
- Training adapter: https://huggingface.co/ostris/zimage_turbo_training_adapter
- Z-Image Turbo: https://huggingface.co/Comfy-Org/z_image_turbo
- ZiT NSFW v4.0: https://civitai.com/models/2237711
- Training guide: https://huggingface.co/blog/content-and-code/training-a-lora-for-z-image-turbo
- Woman041 example: https://civitai.com/models/2144960

---

## Constraints

- RunPod volume 50GB — disk space tight, must clean up
- RTX 4090 = 24GB VRAM — should be enough for rank 16 with gradient checkpointing
- Training adapter v2 is experimental but recommended
- Z-Image Turbo uses guidance_scale=0 at inference (no CFG)
- Trigger token must be rare (use `<elena>` not `elena`)

---

## Progress Log

### 2026-02-06
- Task created after extensive research
- ACE++ abandoned (dead project, peau pâle)
- Discovered ZiT NSFW + Ostris AI Toolkit as the 2026 standard
- Existing 56-image dataset + captions will be reused

### 2026-02-06 - Ralph Iterations 1-7
- **Disk cleanup**: Deleted BigLove XL, ACE++ artifacts, old LoRAs, IP-Adapter, CLIP Vision, ControlNet, T5-XXL, CLIP-L → freed 22GB
- **Comfy-Org split files incompatible**: Downloaded z_image_turbo_bf16 + qwen_3_4b from Comfy-Org but key format (fused QKV) doesn't match diffusers (split Q/K/V) → deleted and downloaded proper sharded diffusers files from Tongyi-MAI/Z-Image-Turbo
- **Disk quota issue**: HF cache (23GB) + existing models exceeded 50GB volume → switched to local directory with diffusers structure instead of HF cache
- **Meta tensor error**: `low_vram` flag caused meta tensors, assistant LoRA can't merge into meta → removed `low_vram`
- **VAE format mismatch**: Comfy-Org ae.safetensors was also incompatible → downloaded diffusers VAE (160MB)
- **PyTorch 2.4 too old**: `enable_gqa` param in SDPA requires PyTorch 2.5+ → upgrading to 2.5.1
- **Dataset uploaded**: 56 JPGs + 56 captions with `<elena>` trigger token → `/workspace/datasets/elena/`
- **Ostris AI Toolkit installed**: All deps + training adapter v2 (325MB)
- **Training config created**: `/workspace/ai-toolkit/config/elena_zit_lora.yaml`
- **Local diffusers directory**: `/workspace/z_image_turbo/` with transformer (22.9GB sharded), text_encoder (7.5GB sharded), VAE (160MB), tokenizer, scheduler configs
- **PyTorch upgraded**: 2.4.0 → 2.5.1 (needed for `enable_gqa` in SDPA attention)
- **Training RUNNING**: ~3.5s/step, loss ~0.4, 16GB/24.5GB VRAM, ETA ~4 hours for 4000 steps
- **Sampling**: Enabled at every 500 steps (skip first sample, PyTorch 2.5.1 now supports GQA)

### 2026-02-06 - Ralph Iteration 8 (Sample Review)
- **Step 500 samples**: Face emerging, skin quality already impressive, NSFW anatomy clean
- **Step 1000 samples**: Face more defined, consistent across portrait/fullbody/selfie/nude, natural skin pores
- **Step 1500 samples**: Strong face consistency (~85-90%), excellent skin realism, no NSFW deformations
- **Loss**: 0.318 at step 1500 (down from 0.4 at start — healthy convergence)
- **Speed**: 3.48-3.60s/step, ~2.5 hours remaining to step 4000
- **Checkpoints saved**: 500, 1000, 1500 (82MB each)
- **Assessment**: Z-Image Turbo skin quality is a massive upgrade over BigLove XL and FLUX. Face consistency is already viable for Fanvue pipeline at step 1500. Training to 4000 steps should push it to 90%+.
- **Waiting**: Background monitor set for ~1 hour to check step 2500-3000 range

### 2026-02-06 - RunPod pod went down
- RunPod pod `qfzhjk1ojpy70r` became unreachable (connection refused on SSH port)
- Training was at step ~1500/4000 on 4090 — checkpoints 500, 1000, 1500 saved on volume
- Decision: Switch to **Vast.ai H100 SXM** for faster re-training

### 2026-02-06 - Vast.ai H100 Training (Ralph Iteration 9)
- **Created Vast.ai instance**: H100 SXM 80GB VRAM, France, $1.49/hr (instance 31020593)
- **Full setup in parallel**: Models (30GB), AI Toolkit, dataset, adapter — all downloaded simultaneously
- **Training config**: Same as RunPod but `batch_size: 2` (80GB VRAM allows it)
- **Speed**: 1.78-2.87s/step (vs 3.5s on 4090), effective ~2.8x faster
- **Training completed**: 4000 steps in 2h45m, total cost ~$4.10
- **All checkpoints**: 500, 1000, 1500, 2000, 2500, 3000, 3500, final (82MB each)
- **32 sample images**: 4 prompts × 8 checkpoints
- **Downloaded locally**: Final LoRA + step 2000 + step 3000 checkpoints + all samples
- **Instance destroyed**: Billing stopped immediately after download

### Final Sample Assessment (Step 4000)
- **Portrait**: Excellent face consistency, natural skin with pores/grain, beautiful lighting
- **Full body cafe**: Recognizable Elena, natural proportions, great scene composition
- **Bedroom selfie**: Very convincing iPhone mirror selfie, Paris rooftops visible
- **NSFW**: Step 4000 generated lingerie (not full nude) — needs more explicit prompting at inference
- **Skin quality**: Massive upgrade over BigLove XL and FLUX — genuinely photorealistic
- **Face consistency**: ~90%+ across all poses and lighting conditions

---

## Outcome

### Training COMPLETE
- **LoRA file**: `elena_zit_lora_v1.safetensors` (81MB, rank 16, 4000 steps)
- **Location**: `elena_lora_tests/zit_h100_final/`
- **Intermediate checkpoints**: step 2000 + step 3000 (also downloaded)
- **Sample images**: 32 images in `elena_lora_tests/zit_h100_samples/`
- **Cost**: ~$4.10 on Vast.ai H100 SXM

### Remaining Acceptance Criteria
- [x] LoRA training completed (4000 steps, rank 16, LR 1e-4)
- [ ] Generate SFW test images with Elena LoRA on ZiT (needs inference pod)
- [ ] Generate NSFW test images (nude, explicit poses) (needs inference pod)
- [ ] Face consistency assessed (target: 90%+) — looks ~90% from training samples
- [ ] Skin quality assessed vs BigLove XL baseline — clearly superior
- [ ] Document optimal inference settings
- [ ] Decision: ZiT + Elena LoRA viable for Fanvue pipeline? Y/N

### Next Steps
1. Spin up cheap inference pod (4090, ~$0.30/hr) with ComfyUI
2. Load Z-Image Turbo + Elena LoRA in ComfyUI
3. Test with diverse SFW prompts (different scenes, outfits, lighting)
4. Test explicit NSFW prompts (nude, explicit poses)
5. Compare step 2000 vs 3000 vs 4000 LoRA
6. Final go/no-go decision

---

## Ralph Sessions

### 2026-02-06 — TRAINING COMPLETE (Inference Testing Pending)
**Iterations**: 9
**Summary**: Trained Elena LoRA v1 on Z-Image Turbo using Ostris AI Toolkit. RunPod pod died mid-training, switched to Vast.ai H100 SXM for 2.8x faster re-training. All files downloaded locally.

**Problems Encountered**:
- Comfy-Org single files (fused QKV) incompatible with diffusers (split Q/K/V) → downloaded from Tongyi-MAI
- RunPod 50GB disk quota exceeded → local diffusers directory instead of HF cache
- PyTorch 2.4 too old for GQA attention → upgraded to 2.5.1
- RunPod pod went down mid-training → switched to Vast.ai H100
- libGL missing on Vast.ai container → apt-get install libgl1-mesa-glx

**Decisions Made**:
- Z-Image Turbo + LoRA is the 2026 approach (replaces BigLove XL, FLUX, Chroma, HiDream)
- Trigger token `<elena>` (rare token, avoids vocab collision)
- Rank 16, LR 1e-4, batch_size 2 on H100 (1 on 4090)
- Vast.ai H100 SXM > RunPod 4090 for training (2.8x faster, more reliable)

**Files Created/Modified**:
- `app/scripts/generate-elena-captions-zit.mjs` — caption generator with `<elena>` trigger
- `app/scripts/vastai-search-fast.mjs` — search for fast GPUs on Vast.ai
- `app/scripts/vastai-create-h100.mjs` — create H100 instance
- `elena_lora_tests/zit_h100_final/elena_zit_lora_v1.safetensors` — final LoRA (81MB)
- `elena_lora_tests/zit_h100_final/elena_zit_lora_v1_000002000.safetensors` — step 2000
- `elena_lora_tests/zit_h100_final/elena_zit_lora_v1_000003000.safetensors` — step 3000
- `elena_lora_tests/zit_h100_samples/` — 32 training sample images
