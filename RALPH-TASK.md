# Ralph Launcher

**Target Task**: features/comfyui-generation-workflow/tasks/TASK-019-zit-elena-lora-training.md

## Quick Context

Train Elena character LoRA on Z-Image Turbo (2026 quality) using Ostris AI Toolkit with de-distillation adapter. Use existing 56-image dataset with face-enhanced captions. 4000 training steps, rank 16. Then test SFW + NSFW generation with face consistency.

**Critical**: Z-Image Turbo is a distilled model — MUST use Ostris training adapter v2 during training, then REMOVE it at inference.

## Acceptance Criteria

- [x] ZiT checkpoint downloaded (Z-Image Turbo bf16 from Tongyi-MAI, 22.9GB sharded)
- [x] Qwen 3 4B text encoder downloaded (7.5GB sharded)
- [x] VAE present (diffusers format, 160MB)
- [x] Ostris AI Toolkit installed
- [x] Ostris de-distillation training adapter v2 downloaded (325MB)
- [x] 56-image Elena dataset + captions uploaded to pod
- [x] Captions adapted for Z-Image Turbo format (trigger token `<elena>`)
- [x] LoRA training completed (4000 steps, rank 16, LR 1e-4) — on Vast.ai H100 SXM
- [ ] Generate SFW test images with Elena LoRA on ZiT (needs inference pod)
- [ ] Generate NSFW test images (nude, explicit poses) (needs inference pod)
- [ ] Face consistency assessed (target: 90%+) — ~90% from training samples
- [ ] Skin quality assessed vs BigLove XL baseline — clearly superior from samples
- [ ] Document optimal inference settings
- [ ] Decision: ZiT + Elena LoRA viable for Fanvue pipeline? Y/N

## Key Info

- **RunPod pod**: Running (qfzhjk1ojpy70r), SSH: `ssh -i ~/.runpod/ssh/RunPod-Key-Go root@209.170.80.132 -p 13315`
- **Volume**: `aml40rql5h` (50GB, US-TX-3) — ~26GB used, need to free ~7GB more
- **GPU**: RTX 4090 (24GB VRAM)
- **Dataset**: `lora-dataset-elena-zimage/` (56 JPG, local) — upload to pod
- **Captions script**: `app/scripts/generate-elena-captions-v3-biglove.mjs` (56 face-enhanced captions)
- **Training adapter**: https://huggingface.co/ostris/zimage_turbo_training_adapter (v2, 340MB)
- **Z-Image Turbo split files**: https://huggingface.co/Comfy-Org/z_image_turbo/tree/main/split_files
- **Ostris AI Toolkit**: https://github.com/ostris/ai-toolkit
- **Disk plan**: Delete BigLove XL (6.5GB) + old LoRAs (~1GB) → ~33GB free → download ZiT (12.3GB) + Qwen (8GB) = ~13GB free

## Training Config Summary

| Param | Value |
|---|---|
| Steps | 4000 |
| Rank | 16 |
| LR | 1e-4 |
| Trigger | `<elena>` |
| Adapter | v2 (de-distillation) |
| Optimizer | adamw8bit |
| Batch | 1 (grad accum 2) |
| Resolution | 512, 768, 1024 (multi-res) |
| Noise scheduler | flowmatch |
| dtype | bf16 |

## Inference Settings

| Param | Value |
|---|---|
| Steps | 8 |
| CFG | 0 |
| Sampler | euler |
| Scheduler | sgm_uniform |
| LoRA weight | 0.8-1.0 |

---

Run `/ralph` to start autonomous execution.
