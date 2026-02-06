# Decisions — Elena Image Generation

Chronological log of decisions made and why.

---

## 2026-02-06: Z-Image Turbo + Elena LoRA = 2026 Production Pipeline

**Context**: After testing BigLove XL (SDXL = 2024 quality), FLUX (plastic skin), HiDream (no face tools), Chroma (NSFW glitches), and ACE++ (abandoned by Alibaba), needed a 2026-quality solution with face consistency + NSFW support.

**Options considered**:
1. BigLove XL + Elena LoRA v5 → SDXL = 2024 quality, skin not realistic enough
2. FLUX + LoRA → Plastic skin, no natural pores
3. Chroma + LoRA → Explicit NSFW causes deformations/glitches
4. HiDream → No face consistency tools (IP-Adapter incompatible)
5. ACE++ (Alibaba) → Abandoned project, pale skin, dead community
6. **Z-Image Turbo + Ostris AI Toolkit LoRA** → S3-DiT architecture, natural skin, uncensored, 8-step inference

**Decision**: Z-Image Turbo + Elena LoRA trained with Ostris AI Toolkit

**Reason**:
- Z-Image Turbo has the best skin quality of any model tested (natural pores, grain, film-like)
- Ostris AI Toolkit supports Z-Image LoRA training with de-distillation adapter v2
- 8-step inference = fast generation
- Native NSFW support without deformations
- ~90% face consistency from training samples

**Training Details**:
- Trigger: `<elena>`, Rank 16, LR 1e-4, 4000 steps, batch 2
- Dataset: 56 images with detailed captions
- Trained on Vast.ai H100 SXM in 2h45m (~$4.10)
- Final LoRA: 81MB (`elena_zit_lora_v1.safetensors`)

**Result**: Training complete. Inference testing pending. Looks very promising from training samples.

---

## 2026-02-06: Vast.ai > RunPod for Training

**Context**: RunPod pod went down mid-training (step ~1500/4000). Needed to restart training.

**Options considered**:
1. Wait for RunPod pod to come back → Unknown downtime, data might be lost
2. Vast.ai RTX 4090 → Same speed, cheaper ($0.30/hr)
3. **Vast.ai H100 SXM** → 2.8x faster, $1.49/hr, reliable

**Decision**: Vast.ai H100 SXM for training, destroy after completion

**Reason**: H100 80GB VRAM allows batch_size 2, 1.78-2.87s/step vs 3.5s on 4090. Total cost ~$4.10 for full training. No persistent storage needed — LoRA is 81MB, easy to download.

**Result**: Training completed in 2h45m. Instance destroyed immediately. Cost-effective and reliable.

---

## 2026-02-06: Chroma1-HD Tested — Excellent Natural/Amateur Quality for NSFW

**Context**: Tested Chroma1-HD (FLUX-based, 17.8GB) as alternative to Imagen 3 for NSFW content with natural/amateur look.

**Key Findings**:

1. **Chroma1-HD produces excellent natural/amateur quality**:
   - Skin texture: natural pores, not "AI-perfect"
   - Lighting: natural, not studio-like
   - Overall vibe: amateur/iPhone look (what we want for Fanvue)
   - NSFW: fully uncensored, no filters

2. **Best Settings Found**:
   - Steps: 25
   - CFG: 3.0 (low = more natural)
   - Sampler: dpmpp_sde
   - Scheduler: beta
   - VAE: ae.safetensors (FLUX VAE)
   - CLIP: t5xxl_fp8 with type "chroma"

3. **LoRA Compatibility**: NONE of existing Elena LoRAs work
   - elena_v5_biglove = SDXL architecture
   - elena_zimage_v3 = Lumina2 architecture
   - Chroma = FLUX architecture (different)

**Test Results**:
| Test | Result |
|------|--------|
| SFW Selfie | ✅ Natural iPhone look |
| NSFW Nude | ✅ Excellent, natural body |
| Skin Quality | 9/10 (natural, not AI-perfect) |
| Face Consistency | ❌ No Elena LoRA available |

**Decision**: Chroma1-HD is excellent for NSFW amateur content, but needs FLUX-trained Elena LoRA for face consistency

**Next Steps**:
- Consider training Elena LoRA specifically for FLUX/Chroma
- Use Chroma for generic NSFW content (no specific face needed)
- Keep BigLove XL + elena_v5 for Elena-specific content

**RunPod Setup**:
- Deleted flux1-dev-fp8 (17GB) to make space
- Downloaded Chroma1-HD.safetensors (17GB)
- Downloaded ae.safetensors VAE (335MB)
- Works with existing t5xxl_fp8 encoder

---

## 2026-02-04: HiDream-I1 Evaluated — NSFW Works with Uncensored Version, No Face Consistency

**Context**: Evaluated HiDream-I1 (17B params) as potential BigLove XL replacement.

**Key Findings**:

1. **Official HiDream-I1** (Comfy-Org) has **built-in NSFW censorship** — generates bikinis/lingerie instead of nudity

2. **Uncensored HiDream-I1** (HuggingFace `e-n-v-y/hidream-uncensored`) **works for full NSFW**:
   - Full nudity, nipples, explicit content
   - No censorship issues
   - Skin quality: 9/10 (excellent freckles, pores, natural tones)

3. **Face consistency NOT possible** — IP-Adapter FaceID is SDXL-architecture only, incompatible with HiDream's DiT architecture

**Test Results (Uncensored Model)**:
| Test | Result |
|------|--------|
| NSFW Nude (explicit) | ✅ Full nudity |
| NSFW Topless (beach) | ✅ Topless |
| Skin Quality | 9/10 |
| Face Consistency | ❌ Not compatible |

**Decision**: Stay with BigLove XL for Elena (requires face consistency)

**Reason**:
- Elena needs consistent face across all images
- IP-Adapter/FaceID doesn't work with HiDream DiT architecture
- BigLove XL + Elena LoRA v5 remains the best solution

**Potential use case**:
- HiDream-I1 Uncensored could be used for generic NSFW content where no specific face is needed
- Watch for future DiT-compatible face consistency solutions

**Models tested**:
- Official: `hidream_i1_fast_fp8.safetensors` (Comfy-Org) — censored
- Uncensored: `hidream_i1_fast_uncensored_fp8_v0.2.safetensors` (e-n-v-y/hidream-uncensored) — works

---

## 2026-02-02: Retrain BigLove LoRA v5 with Face-Focused Captions

**Context**: Z-Image Full + LoRA v3 gives good Elena face but weird anatomy. Z-Image Turbo has good anatomy but LoRA doesn't transfer face. Need NSFW content with both good face AND anatomy for Fanvue.

**Analysis of previous BigLove v4 LoRA failure**:
- Trigger token: `ohwx` (generic) instead of `elena` (identity)
- Captions: Same generic caption for ALL 56 images
- Steps: Only 1500
- Alpha: 32 (too aggressive)

**Options considered**:
1. Accept Z-Image anatomy limitations
2. Use Z-Image Turbo + ReActor face swap → Plastic AI look
3. Inpainting for anatomy → Didn't work well
4. Retrain BigLove LoRA with Z-Image v3 approach → Best option

**Decision**: Train new Elena LoRA v5 for BigLove XL with:
- Trigger: `elena` (identity-specific)
- Captions: Per-image detailed, face-focused
- Steps: 4000 (increased from 1500)
- Rank/Alpha: 32/16 (not 32/32)
- Face details in every caption: "full pouty lips, high cheekbones, angular jawline, hazel-green eyes, beauty mark"

**Reason**:
- Z-Image v3 with detailed captions worked well for face
- BigLove XL has better NSFW anatomy than Z-Image
- Combining both approaches should give face + anatomy

**Status**: Task created (TASK-015), ready for /ralph execution

---

## 2026-01-28: FLUX abandonné - Peau plastique inhérente à l'architecture

**Context**: Tested FLUX.1 [dev] Full (32B) après FLUX.2 Klein 9B, espérant que le modèle complet aurait une meilleure qualité de peau.

**Tests effectués**:
| Modèle | Params | Résultat |
|--------|--------|----------|
| FLUX.2 Klein 9B | 9B (distillé) | Peau plastique ❌ |
| FLUX.1 [dev] Full | 32B (complet) | Peau plastique ❌ |
| BigLove XL | SDXL | Peau réaliste ✅ |

**Constat**: Le problème de peau "AI-clean" n'est PAS dû à la distillation. C'est inhérent à l'architecture FLUX elle-même. Le modèle complet 32B produit le même rendu plastique que le distillé 9B.

**Decision**: Abandonner FLUX pour la génération photoréaliste

**Reason**:
- FLUX (toutes versions) = peau plastique, éclairage trop parfait
- BigLove XL = texture de peau naturelle, imperfections, réalisme
- Inutile d'investir plus de temps dans FLUX pour ce use case

**Recommendation**:
- Garder BigLove XL comme checkpoint principal
- Focus sur amélioration face via FaceDetailer ou autres méthodes SDXL
- FLUX potentiellement utile pour d'autres styles (illustrations, etc.) mais pas pour photoréalisme

**Status**: Décision finale - FLUX abandonné pour Elena

---

## 2026-01-28: FLUX.2 [dev] Full vs Klein vs BigLove (historique)

**Context**: Face refinement needs improvement. Tested FLUX.2 Klein 9B but results were "too AI-clean" (plastique skin).

**Options considered**:
1. **BigLove XL seul** — Realistic skin but face ~85% accurate
2. **BigLove → FLUX Klein refinement** — Two-stage, realistic base + face fix
3. **FLUX.2 Klein seul** — Fast but AI-clean look (distilled = speed not quality)
4. **FLUX.2 [dev] Full** — 32B params, should match/exceed BigLove quality

**Decision**: Install FLUX.2 [dev] Full (32B) to test

**Result**: ❌ FAILED - Same plastic skin as Klein. Issue is FLUX architecture, not distillation.

---

## 2026-01-28: FLUX.2 Klein installed, Qwen models removed

**Context**: Needed space for FLUX models on RunPod volume (50GB limit)

**Action taken**:
- Removed Qwen models (~28GB): qwen_2.5_vl_7b, qwen-image-edit GGUF, qwen_image_vae
- Installed FLUX.2 Klein 9B FP8 (9.5GB)
- Installed Qwen 3 8B FP8 (8.3GB) - FLUX text encoder
- Installed flux2-vae (321MB)

**Result**: ~23GB free space remaining. Enough for FLUX.2 [dev] (~16GB) if we remove Klein.

---

## 2026-01-24: Qwen-Image-Edit working on new RunPod pod

**Context**: Original pod (US-NC-1) unavailable due to GPU shortage. Created new pod in US-TX-3.

**New pod setup**:
- Pod ID: `dortewt0b3tom3`
- Volume: `aml40rql5h` (elena-comfyui-US-TX-3, 50GB)
- Datacenter: US-TX-3
- ComfyUI URL: `https://dortewt0b3tom3-8188.proxy.runpod.net`

**Qwen-Image-Edit models installed**:
| Model | Size | Source |
|-------|------|--------|
| Qwen UNet GGUF | 12.3GB | HuggingFace (unsloth) |
| Qwen Text Encoder | 16GB | HuggingFace (Comfy-Org) |
| Qwen VAE | 243MB | HuggingFace (Comfy-Org) |

**Key finding**: Qwen face refinement on 4096x4096 images is VERY slow (~54s per step). Optimal workflow:
1. Generate at 1024x1024 with BigLove + LoRA
2. Qwen face refinement at 1024x1024 (~30-50s)
3. 4x-UltraSharp upscale to 4096x4096 (~10s)

**Result**: Qwen-Image-Edit generation test successful (~50s for 1024x1024).

**Next**: Complete BigLove XL upload, test full workflow with face refinement.

---

## 2026-01-24: RunPod workflow setup

**Context**: RunPod back online, need to set up full Elena workflow for fast generation

**Setup completed**:
- Pod: `l2qs6633hmvp4c` (RTX 4090, 24GB VRAM)
- Image: `runpod/comfyui:latest`
- ComfyUI URL: `https://l2qs6633hmvp4c-8188.proxy.runpod.net`

**Models installed**:
| Model | Size | Source |
|-------|------|--------|
| SDXL Base | 6.5GB | HuggingFace (wget on pod) |
| Elena LoRA | 218MB | SCP from Mac |
| IP-Adapter FaceID | 1.4GB | HuggingFace (wget on pod) |
| CLIP Vision | 2.4GB | HuggingFace (wget on pod) |
| Face ref | 495KB | SCP from Mac |

**Custom nodes installed**:
- ComfyUI_IPAdapter_plus
- insightface + onnxruntime-gpu

**Result**: Generation works, ~24s/image (vs 5min local). BigLove XL not installed (CivitAI requires token).

**Next**: Install Qwen for face refinement, upload BigLove XL

---

## 2026-01-24: Voyeur silhouettes don't work in SDXL prompts

**Context**: "Luxury Wife" concept with room service silhouette in background

**Attempts**:
- "blurred male silhouette in doorway"
- "male shadow on wall"
- "room service cart with hand visible"

**Result**: SDXL ignores these elements or generates another woman instead of male silhouette.

**Decision**: Voyeur effect needs compositing (add silhouette in post) rather than prompt engineering.

---

## 2026-01-24: FaceDetailer (Impact Pack) for skin/face enhancement

**Context**: Looking for "CodeFormer for body" - something to improve skin texture quality

**Options considered**:
1. CodeFormer — Only restores faces, not body
2. SegmentAnything + Inpainting — Complex, manual masking
3. FaceDetailer (Impact Pack) — Auto-detects and enhances faces/skin

**Decision**: Install and use FaceDetailer from ComfyUI-Impact-Pack

**Reason**: 
- Auto-detects faces using YOLO (UltralyticsDetectorProvider)
- Can enhance both face AND body with SAM segmentation
- Inpaints detected regions with higher detail
- Denoise 0.4 gives subtle enhancement without changing identity

**Result**: FaceDetailer working. Required Python 3.10 upgrade (3.9 incompatible due to union types syntax).

**Setup required**:
- ComfyUI-Impact-Pack
- ComfyUI-Impact-Subpack
- Models: `bbox/face_yolov8m.pt`, `segm/person_yolov8m-seg.pt`, `sam_vit_b_01ec64.pth`

---

## 2026-01-24: Python 3.10 venv upgrade

**Context**: Impact Pack wouldn't load on Python 3.9

**Options considered**:
1. Downgrade Impact Pack to 3.9-compatible version — Old version, missing features
2. Upgrade ComfyUI venv to Python 3.10 — Breaking change but future-proof

**Decision**: Recreate venv with Python 3.10.19

**Reason**: 
- Impact Pack uses `type | None` syntax requiring Python 3.10+
- Better to stay current with dependencies
- Python 3.10 already installed via Homebrew

**Result**: All Impact Pack nodes now load correctly. Old venv deleted.

---

## 2026-01-24: Elena "Luxury Wife" niche concept

**Context**: Defining Elena's character niche for Fanvue positioning

**Decision**: Combine:
- Épouse de luxe (luxury wife)
- Domination douce (soft domination in captions, not photos)
- Voyeurisme/Exhibitionnisme (room service catches her)

**Reason**: 
- Creates narrative hook for captions and stories
- Voyeur element adds intrigue without requiring complex scene generation
- Luxury setting justifies high production value

**Implementation**: Room service silhouette suggested in background (blurred shadow, cart visible at frame edge). Elena doesn't notice.

**Result**: Pack generated. Voyeur element didn't render well (model ignored silhouettes). Need to refine prompts or use compositing.

---

## 2026-01-23: Body proportions via prompt (D cup)

**Context**: Elena's body proportions needed adjustment (larger breasts)

**Options considered**:
1. Retrain LoRA with different body photos — Complex, need nude photos
2. Use body-specific LoRA from CivitAI — Additional model to manage
3. Prompt engineering — Simple, no extra model

**Decision**: Use prompt `natural breasts D cup`

**Reason**: 
- BigLove XL understands body descriptors well
- `DD cup` was too large, `D cup` is balanced
- Combined with negative prompt `small breasts, flat chest`
- No additional models needed

**Result**: Body proportions consistent and controllable via prompt.

---

## 2026-01-23: CodeFormer not relevant for face consistency

**Context**: Evaluating tools to improve face from 85% to 95%

**Options considered**:
1. CodeFormer — Restores/improves existing face quality
2. Qwen2.5-VL — Intelligent editing with instructions
3. ReActor — Face swap (replaces face entirely)

**Decision**: Skip CodeFormer

**Reason**: 
- CodeFormer **améliore la qualité** d'un visage (netteté, détails)
- Mais le besoin est de **copier le visage de référence** d'Elena
- CodeFormer ne change pas l'identité, juste la qualité
- Qwen peut potentiellement faire du face editing intelligent

**Result**: Tâche CodeFormer supprimée. Focus sur Qwen pour copier/appliquer le visage de référence.

---

## 2026-01-23: Qwen for Face Refinement (wait for RunPod)

**Context**: Face accuracy at 85%, need 95%+. RunPod in maintenance.

**Options considered**:
1. CodeFormer locally — Available now, restores/improves face
2. Qwen2.5-VL on RunPod — Intelligent editing, best quality
3. ReActor face swap — Replaces face entirely

**Decision**: Wait for RunPod to use Qwen

**Reason**: 
- Qwen can intelligently edit the face with text instructions
- More control than CodeFormer
- CodeFormer only restores, doesn't fix identity issues
- RunPod should be back soon

**Result**: Task blocked, pods stopped to avoid charges. Resume when RunPod stable.

---

## 2026-01-23: Simplified Workflow (CFG 4.0 + LoRA 0.7 + Single IP-Adapter)

**Context**: Body consistency good but grain issues, complex dual IP-Adapter setup

**Options considered**:
1. Keep current setup (CFG 7.0, LoRA 1.0, dual IP-Adapter)
2. Simplify: Lower CFG, lower LoRA, single IP-Adapter
3. Switch to Flux model

**Decision**: Simplify the workflow
- CFG: 7.0 → **4.0**
- LoRA weight: 1.0 → **0.7**
- Remove style IP-Adapter (face only)
- Add 4x-UltraSharp upscale

**Reason**: 
- Lower CFG reduces grain on SDXL models
- LoRA at 0.7 allows more model flexibility
- Style can come from prompt, no need for second IP-Adapter
- Upscale adds detail and compensates for any loss

**Result**: Body consistency and image quality now excellent. Face still needs work (85% → 95% target).

**New script**: `app/scripts/elena-simple-test.mjs`

---

## 2026-01-21: BigLove XL over BigLust

**Context**: Needed better face and skin quality for Elena generations

**Options considered**:
1. BigLust v16 (current) — 85% face similarity, good but skin too saturated
2. BigLove XL (CivitAI 897413) — Recommended for realistic skin
3. Juggernaut — Not tested

**Decision**: Switch to BigLove XL

**Reason**: Perplexity search showed it's the best for realistic skin texture. Tests confirmed more natural colors and better face quality.

**Result**: Face similarity improved, skin looks more natural. Grain still present (separate issue).

---

## 2026-01-21: InstantID post-processing instead of FaceID with LoRA

**Context**: Face consistency was only 85% with LoRA alone. Needed 95%+.

**Options considered**:
1. LoRA + FaceID together during generation → Plastic/artificial faces ❌
2. InstantID during generation → Slow, interferes with LoRA
3. InstantID as post-processing → Two-step but works well ✅

**Decision**: Generate with LoRA first, then apply InstantID to fix face

**Reason**: 
- LoRA handles body/style excellently
- InstantID fixes face without interfering with body
- Separating concerns = better results

**Result**: 95% Elena similarity achieved. Body remains excellent.

**Parameters**: InstantID weight 0.85, face ref `elena_face_ref.jpg`

---

## 2026-01-20: bf16 instead of fp16 for training

**Context**: LoRA V3 training had NaN loss from step 1, corrupting the model

**Options considered**:
1. Keep fp16, lower learning rate
2. Switch to bf16 (bfloat16)
3. Use full fp32 (slower)

**Decision**: Use bf16 mixed precision

**Reason**: bf16 is more numerically stable than fp16, especially for gradient computations. Recommended by kohya_ss community for SDXL training.

**Result**: V4 training completed without NaN. Loss stable at 0.116.

---

## 2026-01-20: Learning rate 5e-5 instead of 1e-4

**Context**: V3 training with 1e-4 caused immediate NaN loss

**Options considered**:
1. 1e-4 (original) — Too aggressive, NaN
2. 5e-5 (half) — More conservative
3. 1e-5 (very low) — Might underfit

**Decision**: Use 5e-5 with longer warmup (200 steps)

**Reason**: Lower LR combined with bf16 should prevent NaN while still learning effectively.

**Result**: Training completed successfully, loss decreased smoothly.

---

## 2026-01-20: Network Dim 32 (to revisit)

**Context**: Choosing LoRA rank for SDXL training

**Options considered**:
1. Dim 8 (local training) — Fast but low capacity
2. Dim 32 (used for V4) — Balance
3. Dim 64 — Recommended for faces

**Decision**: Used Dim 32 for V4

**Reason**: Wanted to test if 32 was sufficient before going higher.

**Result**: Body learned well, face identity not learned. **Should try Dim 64 next time.**

---

## 2026-01-20: Trigger word "elena" (to revisit)

**Context**: Choosing trigger word for LoRA training

**Options considered**:
1. "elena" — Descriptive but common word
2. "sks" — Rare token, commonly used for LoRA
3. "elx" or "dcai" — Made-up rare tokens

**Decision**: Used "elena"

**Reason**: More intuitive to use in prompts.

**Result**: Works for body/style but may contribute to face identity issues. **Should try rare token next time.**

---

## 2026-01-21: Do NOT use ImageSharpen on grainy images

**Context**: Trying to reduce grain in generated images

**Options considered**:
1. ImageSharpen node — Post-processing sharpening
2. Upscaler — 4x then downscale
3. Denoising — Light denoise pass

**Decision**: Avoid ImageSharpen

**Reason**: Testing showed it amplifies grain instead of reducing it.

**Result**: Image quality degraded when using ImageSharpen. Other methods needed.

---

## 2026-01-21: Use RunPod for upscaling (not local Mac)

**Context**: Local upscalers (4x-UltraSharp, RealESRGAN) threw tensor errors

**Options considered**:
1. Debug local setup — Time-consuming
2. Use RunPod GPU — Known working environment
3. Use cloud API (Replicate) — Extra cost

**Decision**: Use RunPod for all heavy processing

**Reason**: Already have RunPod setup working. GPU handles these tasks easily.

**Result**: Upscaling works perfectly on RunPod. 4x upscale of 832x1216 → 3328x4864 in seconds.
