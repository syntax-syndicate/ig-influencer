# TASK-011: Train Z-Image Elena LoRA for Face+Body Consistency

**Status**: 🟡 In Progress (training running on Vast.ai)
**Created**: 2026-01-30
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Train a custom Elena LoRA specifically for Z-Image model to achieve face+body consistency without relying on broken TextEncodeZImageOmni face reference. This LoRA will enable generating Elena images with Z-Image's superior skin quality while maintaining identity.

---

## Acceptance Criteria

- [x] 56 training images downloaded from Cloudinary to local dataset folder
- [x] Images resized/preprocessed to 1024x1024 PNG format
- [x] Captions generated for each image using trigger token `ohwx` (rare token, better than `<elena>`)
- [x] Z-Image Turbo + Training Adapter downloaded to Vast.ai pod (better approach than de-distilled)
- [x] Ostris AI Toolkit installed on Vast.ai pod
- [🟡] LoRA training in progress: rank 32, 3500 steps, LR 5e-5 (ETA ~5h)
- [ ] Training checkpoints saved every 500 steps
- [ ] Best checkpoint selected based on sample outputs
- [ ] Final LoRA tested in ComfyUI with Z-Image Full model
- [ ] Face consistency verified: Elena identity recognizable across poses
- [ ] Body consistency verified: proportions match reference
- [ ] LoRA file saved as `elena_zimage_v1.safetensors`

---

## Approach

### Phase 1: Dataset Preparation (Local Mac)

1. Create dataset folder: `lora-dataset-elena-zimage/`
2. Download all 56 images from Cloudinary URLs
3. Resize images to 1024x1024 (center crop or pad)
4. Convert to PNG format for training
5. Generate caption files: `{filename}.txt` with `<elena>, {description}`

### Phase 2: Environment Setup (Vast.ai)

1. Rent RTX 4090 (24GB) on Vast.ai EU
2. Install Ostris AI Toolkit or ComfyUI-Realtime-Lora
3. Download Z-Image De-Distilled model from HuggingFace:
   - `https://huggingface.co/ostris/Z-Image-De-Turbo`
4. Upload training dataset via SCP

### Phase 3: Training

1. Configure training parameters:
   ```json
   {
     "model": "z-image-de-turbo",
     "image_size": 1024,
     "steps": 4000,
     "batch_size": 1,
     "learning_rate": 5e-5,
     "lora_rank": 64,
     "checkpoint_every": 500,
     "trigger_token": "<elena>"
   }
   ```
2. Start training, monitor loss curve
3. Generate samples at each checkpoint
4. Select best checkpoint (identity retention + flexibility)

### Phase 4: Testing

1. Load trained LoRA in ComfyUI
2. Test with Z-Image Full (not Turbo) for best quality
3. Generate test images with various prompts:
   - `<elena>, portrait, soft lighting`
   - `<elena>, full body, beach setting`
   - `<elena>, luxury hotel room, morning light`
4. Verify face and body consistency

---

## Files Involved

- `lora-dataset-elena-zimage/` — Training dataset (CREATE)
- `app/scripts/download-elena-zimage-dataset.mjs` — Dataset download script (CREATE)
- `app/scripts/elena-zimage-lora-test.mjs` — Test trained LoRA (CREATE)
- `~/ComfyUI/models/loras/elena_zimage_v1.safetensors` — Final LoRA (OUTPUT)

---

## Training Images (56 total)

```
1. https://res.cloudinary.com/dily60mr0/image/upload/v1768847547/elena-scheduled/carousel-2-1768847547.jpg
2. https://res.cloudinary.com/dily60mr0/image/upload/v1768847319/elena-scheduled/carousel-1-1768847318.jpg
3. https://res.cloudinary.com/dily60mr0/image/upload/v1768844736/elena-scheduled/carousel-1-1768844735.jpg
4. https://res.cloudinary.com/dily60mr0/image/upload/v1768763692/elena-scheduled/carousel-3-1768763692.jpg
5. https://res.cloudinary.com/dily60mr0/image/upload/v1768763641/elena-scheduled/carousel-2-1768763641.jpg
6. https://res.cloudinary.com/dily60mr0/image/upload/v1768763588/elena-scheduled/carousel-1-1768763588.jpg
7. https://res.cloudinary.com/dily60mr0/image/upload/v1768739598/elena-scheduled/carousel-3-1768739597.jpg
8. https://res.cloudinary.com/dily60mr0/image/upload/v1768677268/elena-scheduled/carousel-2-1768677268.jpg
9. https://res.cloudinary.com/dily60mr0/image/upload/v1768677197/elena-scheduled/carousel-1-1768677196.jpg
10. https://res.cloudinary.com/dily60mr0/image/upload/v1768656524/elena-scheduled/carousel-2-1768656524.jpg
11. https://res.cloudinary.com/dily60mr0/image/upload/v1768656426/elena-scheduled/carousel-1-1768656426.jpg
12. https://res.cloudinary.com/dily60mr0/image/upload/v1768653117/elena-scheduled/carousel-1-1768653117.jpg
13. https://res.cloudinary.com/dily60mr0/image/upload/v1768591221/elena-scheduled/carousel-3-1768591221.jpg
14. https://res.cloudinary.com/dily60mr0/image/upload/v1768591177/elena-scheduled/carousel-2-1768591177.jpg
15. https://res.cloudinary.com/dily60mr0/image/upload/v1768591118/elena-scheduled/carousel-1-1768591118.jpg
16. https://res.cloudinary.com/dily60mr0/image/upload/v1768518016/elena-fanvue-daily/morning_selfie_above-1768518015.jpg
17. https://res.cloudinary.com/dily60mr0/image/upload/v1768517864/elena-fanvue-daily/yoga_from_above-1768517863.jpg
18. https://res.cloudinary.com/dily60mr0/image/upload/v1768511997/elena-scheduled/carousel-2-1768511997.jpg
19. https://res.cloudinary.com/dily60mr0/image/upload/v1768511907/elena-scheduled/carousel-1-1768511906.jpg
20. https://res.cloudinary.com/dily60mr0/image/upload/v1768506296/elena-scheduled/carousel-1-1768506295.jpg
21. https://res.cloudinary.com/dily60mr0/image/upload/v1768484265/elena-scheduled/carousel-1-1768484265.jpg
22. https://res.cloudinary.com/dily60mr0/image/upload/v1768418450/elena-scheduled/carousel-2-1768418450.jpg
23. https://res.cloudinary.com/dily60mr0/image/upload/v1768418393/elena-scheduled/carousel-1-1768418392.jpg
24. https://res.cloudinary.com/dily60mr0/image/upload/v1768394526/elena-scheduled/carousel-2-1768394525.jpg
25. https://res.cloudinary.com/dily60mr0/image/upload/v1768332035/elena-scheduled/carousel-3-1768332034.jpg
26. https://res.cloudinary.com/dily60mr0/image/upload/v1768331913/elena-scheduled/carousel-1-1768331913.jpg
27. https://res.cloudinary.com/dily60mr0/image/upload/v1768307935/elena-scheduled/carousel-2-1768307935.jpg
28. https://res.cloudinary.com/dily60mr0/image/upload/v1768245687/elena-scheduled/carousel-3-1768245686.jpg
29. https://res.cloudinary.com/dily60mr0/image/upload/v1768245583/elena-scheduled/carousel-1-1768245582.jpg
30. https://res.cloudinary.com/dily60mr0/image/upload/v1768234884/elena-fanvue-daily/morning_bed_stretch-1768234884.jpg
31. https://res.cloudinary.com/dily60mr0/image/upload/v1768158808/elena-scheduled/carousel-1-1768158807.jpg
32. https://res.cloudinary.com/dily60mr0/image/upload/v1767954077/elena-trending-test/bozekkek0rc8nrrotr6w.jpg
33. https://res.cloudinary.com/dily60mr0/image/upload/v1767951368/elena-trending-test/ljnvpscynjz5qutszpn8.jpg
34. https://res.cloudinary.com/dily60mr0/image/upload/v1767554094/elena-scheduled/carousel-3-1767554094.jpg
35. https://res.cloudinary.com/dily60mr0/image/upload/v1767554047/elena-scheduled/carousel-2-1767554046.jpg
36. https://res.cloudinary.com/dily60mr0/image/upload/v1766651337/elena-scheduled/reel-2-1766651337.jpg
37. https://res.cloudinary.com/dily60mr0/image/upload/v1766653839/elena-scheduled/reel-1-1766653839.jpg
38. https://res.cloudinary.com/dily60mr0/image/upload/v1766654049/elena-scheduled/reel-3-1766654049.jpg
39. https://res.cloudinary.com/dily60mr0/image/upload/v1766572399/elena-fanvue-pack1/elena-pack1-photo_3-1766572398786.jpg
40. https://res.cloudinary.com/dily60mr0/image/upload/v1766572346/elena-fanvue-pack1/elena-pack1-photo_2-1766572345325.jpg
41. https://res.cloudinary.com/dily60mr0/image/upload/v1766561004/elena-scheduled/reel-2-1766561004.jpg
42. https://res.cloudinary.com/dily60mr0/image/upload/v1766561049/elena-scheduled/reel-3-1766561048.jpg
43. https://res.cloudinary.com/dily60mr0/image/upload/v1766501180/elena-scheduled/reel-2-1766501180.jpg
44. https://res.cloudinary.com/dily60mr0/image/upload/v1766499727/elena-scheduled/reel-3-1766499726.jpg
45. https://res.cloudinary.com/dily60mr0/image/upload/v1766499665/elena-scheduled/reel-2-1766499655.jpg
46. https://res.cloudinary.com/dily60mr0/image/upload/v1766499613/elena-scheduled/reel-1-1766499613.jpg
47. https://res.cloudinary.com/dily60mr0/image/upload/v1766478271/elena-scheduled/carousel-1-1766478271.jpg
48. https://res.cloudinary.com/dily60mr0/image/upload/v1766445336/elena-scheduled/reel-1-1766445335.jpg
49. https://res.cloudinary.com/dily60mr0/image/upload/v1766443939/elena-scheduled/reel-3-1766443938.jpg
50. https://res.cloudinary.com/dily60mr0/image/upload/v1766403548/elena-vacation-reels/elena-yacht-1-1766403547908.jpg
51. https://res.cloudinary.com/dily60mr0/image/upload/v1766307117/elena-carousel/zbnnquow5kfkpkkrerx5.jpg
52. https://res.cloudinary.com/dily60mr0/image/upload/v1766263301/elena-carousel/epoavhydrokfrvsw9pxp.jpg
53. https://res.cloudinary.com/dily60mr0/image/upload/v1766263353/elena-carousel/vcuijiegd85mr7fydqwy.jpg
54. https://res.cloudinary.com/dily60mr0/image/upload/v1766230840/elena-carousel/bkp8fmzwzrbocg64da7e.jpg
55. https://res.cloudinary.com/dily60mr0/image/upload/v1766144591/elena-carousel/bhkia2z0mmqxp0xxdpvr.jpg
56. https://res.cloudinary.com/dily60mr0/image/upload/v1766144546/elena-carousel/rygy3bbill3ob4vbnfbl.jpg
```

---

## Constraints

- Use Z-Image De-Distilled (base) for training, NOT Z-Image Turbo
- Trained LoRA will work with both Z-Image Full and Turbo at inference
- 24GB VRAM required (RTX 4090 on Vast.ai)
- Training time: ~2-3 hours for 4000 steps
- Use bf16 mixed precision to prevent NaN loss
- Trigger token must be rare: `<elena>` or `sks`

---

## Technical References

- [Ostris AI Toolkit - Z-Image LoRA Training](https://huggingface.co/blog/content-and-code/training-a-lora-for-z-image-turbo)
- [Z-Image De-Distilled Model](https://huggingface.co/ostris/Z-Image-De-Turbo)
- [Best Practices for Z-Image LoRA 2026](https://dev.to/gary_yan_86eb77d35e0070f5/best-practices-for-training-lora-models-with-z-image-complete-2026-guide-4p7h)

---

## Progress Log

### 2026-01-30
- Task created
- Context: Z-Image Omni face reference (TASK-010) failed all 8 configurations
- Alternative approach: train dedicated LoRA for face+body consistency
- 56 Cloudinary image URLs provided by user

### 2026-01-30 - Ralph Iteration 1-5 (Dataset Prep + Training Start)
- **Working on**: Download dataset, setup Vast.ai, start training
- **Actions**:
  - Downloaded 56 images from Cloudinary
  - Resized to 1024x1024 PNG (center crop)
  - Generated caption files with trigger token `ohwx`
  - Created Vast.ai pod (RTX 3090 Hungary, $0.145/hr)
  - Installed Ostris AI Toolkit
  - Downloaded Z-Image training adapter v1
  - Upgraded PyTorch 2.4→2.5.1 (fixed `enable_gqa` error)
  - Training started: rank 32, 3500 steps, LR 5e-5, bf16
- **Result**: Training in progress (~5.6s/step, ETA ~5 hours)
- **Problems**:
  - PyTorch 2.4 incompatible with diffusers (scaled_dot_product_attention)
  - Pod crashed once during setup
- **Solutions**: Upgraded to PyTorch 2.5.1+cu124

### Training Status (ACTIVE)
- **Pod**: `ssh -p 29366 root@ssh5.vast.ai`
- **Log**: `/workspace/training.log`
- **Output**: `/workspace/output/elena_zimage_v1/`
- **Started**: 2026-01-30 11:52 UTC
- **Steps**: 3500 @ ~5.6s/step = ~5.4 hours
- **Last Check**: Step 273/3500 (7.8%), loss 0.28-0.68, healthy
- **ETA Completion**: ~17:20 UTC (2026-01-30)

### How to Resume
```bash
# 1. Check if pod still running
cd /Users/edouardtiem/Cursor\ Projects/IG-influencer
node app/scripts/vastai-connect.mjs --status

# 2. SSH and check training progress
ssh -p 29366 root@ssh5.vast.ai "tail -20 /workspace/training.log"

# 3. Check for saved checkpoints
ssh -p 29366 root@ssh5.vast.ai "ls -la /workspace/output/elena_zimage_v1/"

# 4. When training complete, download LoRA
scp -P 29366 root@ssh5.vast.ai:/workspace/output/elena_zimage_v1/elena_zimage_v1.safetensors ~/ComfyUI/models/loras/
```

---

## Outcome

_Fill when task is complete, then rename file to DONE-011-zimage-elena-lora-training.md_

---

## Ralph Sessions

_Automatically filled when Ralph completes iterations_
