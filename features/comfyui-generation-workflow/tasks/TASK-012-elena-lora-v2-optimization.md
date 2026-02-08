# TASK-012: Optimize Elena LoRA v2 for Stronger Face Consistency

**Status**: 🟡 In Progress
**Created**: 2026-01-30
**Feature**: [ComfyUI Generation Workflow](../README.md)

---

## Goal

Improve Elena Z-Image LoRA from v1 to v2 with stronger face/identity consistency. v1 captures general features but identity isn't recognizable enough. Two-phase approach: first test inference tuning, then full retrain if needed.

---

## Acceptance Criteria

### Phase 1: Inference Tuning (Quick Test)
- [ ] Test LoRA weight 0.6 and compare output
- [ ] Test LoRA weight 0.7 and compare output
- [ ] Test LoRA weight 0.8 and compare output
- [ ] Test LoRA weight 1.2 and compare output
- [ ] Determine if any weight gives acceptable identity

### Phase 2: Full Retrain (If Phase 1 Fails)
- [ ] Generate per-image captions for all 56 training images
- [ ] Gather 50-75 regularization images (generic women, no trigger)
- [ ] Update training config: rank 48, alpha 24 (2:1 ratio), 4500 steps, LR 8e-5
- [ ] Upload new dataset to Vast.ai pod
- [ ] Complete training (~6 hours)
- [ ] Test v2 LoRA with same prompts as v1
- [ ] Face consistency verified: Elena identity clearly recognizable
- [ ] LoRA saved as `elena_zimage_v2.safetensors`

---

## Approach

### Phase 1: Inference Tuning

Test different LoRA weights without retraining:

```python
pipe.load_lora_weights(lora_path, adapter_name="elena")
pipe.set_adapters(["elena"], adapter_weights=[WEIGHT])  # Try 0.6, 0.7, 0.8, 1.0, 1.2
```

Generate 5 test images at each weight, compare face consistency.

### Phase 2: Full Retrain (If Needed)

**Root causes of v1 weakness:**
1. Same caption for all 56 images → model can't separate identity from context
2. Rank/Alpha 1:1 ratio (32/32) → should be 2:1 for character LoRAs
3. No regularization images → model confuses "ohwx" with generic "woman"

**v2 Training Parameters:**

| Parameter | v1 | v2 |
|-----------|-----|-----|
| Captions | Same for all | Per-image unique |
| Regularization | None | 50-75 images |
| Rank | 32 | 48 |
| Alpha | 32 | 24 |
| Steps | 3500 | 4500 |
| LR | 5e-5 | 8e-5 |

**Per-image caption format:**
```
ohwx woman, [pose], [lighting], [expression], [setting]
```

Example:
```
ohwx woman, closeup portrait, soft natural lighting, neutral expression
ohwx woman, three-quarter view, outdoor lighting, smiling
ohwx woman, side profile, studio lighting, serious expression
```

---

## Files Involved

- `lora-dataset-elena-zimage/processed/*.txt` — Per-image captions (UPDATE)
- `lora-dataset-elena-zimage/regularization/` — Regularization images (CREATE)
- `/workspace/ai-toolkit/config/elena_zimage_lora_v2.yaml` — v2 training config
- `/workspace/test_lora.py` — Test script with weight parameter
- `~/ComfyUI/models/loras/elena_zimage_v2.safetensors` — Final v2 LoRA

---

## Constraints

- Pod still running: `ssh -p 29366 root@ssh5.vast.ai`
- v1 LoRA already downloaded: `~/ComfyUI/models/loras/elena_zimage_v1.safetensors`
- Must stop pod after testing to save costs ($0.145/hr)
- Training v2 will take ~6 hours

---

## Progress Log

### 2026-01-30
- Task created
- Context: v1 LoRA (TASK-011) completed training, tested, identity not strong enough
- Research identified: per-image captions, regularization, rank/alpha ratio as key improvements
- Decision: Try inference tuning first, full retrain if needed

---

## Outcome

_Fill when task is complete, then rename file to DONE-012-elena-lora-v2-optimization.md_

---

## Ralph Sessions

_Automatically filled when Ralph completes iterations_
