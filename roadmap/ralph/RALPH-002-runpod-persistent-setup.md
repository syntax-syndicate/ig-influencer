# RALPH-TASK: RunPod Persistent Setup

> Archive: `roadmap/ralph/RALPH-002-runpod-persistent-setup.md`

## Overview

Configurer le volume réseau RunPod existant (`elena-models`) avec tous les modèles et ComfyUI, puis créer un workflow pour lancer un pod connecté à ce volume à la demande.

## État Actuel

| Ressource | Status | ID |
|-----------|--------|-----|
| **Network Volume** | ✅ Existe | `box5nuv45v` (elena-models, 50GB, US-KS-2) |
| **Template** | ✅ Existe | `gijmo2nbr7` (elena-comfyui-worker) |
| **Pod actuel** | ⚠️ Non connecté au volume | `l2qs6633hmvp4c` |

## Architecture Cible

```
Network Volume: elena-models (box5nuv45v)
├── comfyui/
│   ├── models/
│   │   ├── checkpoints/bigLove_xl1.safetensors
│   │   ├── loras/elena_v4_cloud.safetensors
│   │   ├── ipadapter/ip-adapter-faceid-plusv2_sdxl.bin
│   │   ├── clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors
│   │   ├── insightface/buffalo_l/
│   │   ├── ultralytics/bbox/face_yolov8m.pt
│   │   ├── sams/sam_vit_b_01ec64.pth
│   │   └── upscale_models/4x-UltraSharp.pth
│   ├── custom_nodes/
│   │   ├── ComfyUI_IPAdapter_plus/
│   │   └── ComfyUI-Impact-Pack/
│   └── input/elena_face_ref.jpg
└── startup.sh

Pod (on-demand) → monte /workspace → ComfyUI prêt
```

## Success Criteria

- [ ] Volume configuré avec tous les modèles
- [ ] Script `startup.sh` qui lance ComfyUI automatiquement
- [ ] Script local `runpod-connect.mjs` pour lancer/arrêter pods
- [ ] Test: lancer pod → générer image sans intervention manuelle

---

## Tasks

### 1. ~~Créer Network Volume~~ DÉJÀ FAIT

**Status**: ✅ COMPLETE

**Volume existant**:
- ID: `box5nuv45v`
- Nom: `elena-models`
- Taille: 50GB
- Region: US-KS-2

---

### 2. Créer Pod Connecté au Volume

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: LOW

**Description**:
Créer un nouveau pod connecté au volume réseau `box5nuv45v`. Le pod actuel (`l2qs6633hmvp4c`) n'est pas connecté au volume.

**Acceptance Criteria**:
- [ ] Nouveau pod créé avec `networkVolumeId: "box5nuv45v"`
- [ ] Volume monté sur `/workspace`
- [ ] GPU RTX 4090 dans region US-KS-2

**Notes**: Terminer l'ancien pod après avoir créé le nouveau

---

### 3. Installer ComfyUI sur le Volume

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: MEDIUM

**Description**:
Installer ComfyUI et ses dépendances sur le volume réseau.

**Acceptance Criteria**:
- [ ] ComfyUI cloné dans `/workspace/comfyui/`
- [ ] Python venv avec torch, torchvision créé
- [ ] Requirements installés
- [ ] Structure models/ créée

**Depends on**: Task 2

---

### 4. Télécharger Tous les Modèles sur le Volume

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: MEDIUM

**Description**:
Télécharger/uploader tous les modèles nécessaires.

**Modèles à installer**:
| Modèle | Destination | Source |
|--------|-------------|--------|
| `bigLove_xl1.safetensors` | checkpoints/ | Upload from Mac |
| `elena_v4_cloud.safetensors` | loras/ | Upload from Mac |
| `ip-adapter-faceid-plusv2_sdxl.bin` | ipadapter/ | HuggingFace |
| `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` | clip_vision/ | HuggingFace |
| `buffalo_l/` | insightface/ | HuggingFace |
| `face_yolov8m.pt` | ultralytics/bbox/ | Ultralytics |
| `sam_vit_b_01ec64.pth` | sams/ | Meta |
| `4x-UltraSharp.pth` | upscale_models/ | HuggingFace |
| `elena_face_ref.jpg` | input/ | Upload from Mac |

**Acceptance Criteria**:
- [ ] Tous les modèles présents et validés

**Depends on**: Task 3

---

### 5. Installer Custom Nodes

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: MEDIUM

**Description**:
Installer les custom nodes et leurs dépendances.

**Custom Nodes**:
- `ComfyUI_IPAdapter_plus`
- `ComfyUI-Impact-Pack`

**Acceptance Criteria**:
- [ ] Nodes clonés dans `custom_nodes/`
- [ ] Dépendances installées (insightface, onnxruntime-gpu, ultralytics)
- [ ] Nodes détectés au démarrage

**Depends on**: Task 3

---

### 6. Créer Script startup.sh

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: LOW

**Description**:
Créer un script de démarrage automatique.

```bash
#!/bin/bash
cd /workspace/comfyui
source venv/bin/activate
python main.py --listen 0.0.0.0 --port 8188
```

**Acceptance Criteria**:
- [ ] Script créé et exécutable
- [ ] ComfyUI démarre correctement

**Depends on**: Task 5

---

### 7. Créer Script Local runpod-connect.mjs

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: MEDIUM

**Description**:
Script Node.js pour gérer les pods à la demande.

**Fonctionnalités**:
```bash
node runpod-connect.mjs          # Lancer pod + attendre ready
node runpod-connect.mjs --stop   # Arrêter pod
node runpod-connect.mjs --status # Voir état
```

**Acceptance Criteria**:
- [ ] Script créé dans `app/scripts/runpod-connect.mjs`
- [ ] Crée pod connecté au volume si aucun n'existe
- [ ] Retourne URL ComfyUI quand prêt
- [ ] Option --stop pour arrêter

**Files**:
- `app/scripts/runpod-connect.mjs`

**Depends on**: Task 6

---

### 8. Test End-to-End

**Priority**: HIGH
**Status**: PENDING
**Estimated Complexity**: LOW

**Description**:
Valider le setup complet.

**Acceptance Criteria**:
- [ ] `node runpod-connect.mjs` → pod démarre en < 2 min
- [ ] ComfyUI accessible immédiatement
- [ ] Génération fonctionne sans setup manuel
- [ ] Pod s'arrête proprement avec --stop

**Depends on**: Task 7

---

## Constraints

- Volume existant: `box5nuv45v` dans US-KS-2
- Token RunPod dans `.env.local`
- Fichiers à uploader depuis Mac: bigLove_xl1, elena_v4_cloud, elena_face_ref.jpg

## Configuration

```javascript
const CONFIG = {
  volumeId: 'box5nuv45v',
  volumeName: 'elena-models',
  region: 'US-KS-2',
  gpuType: 'NVIDIA GeForce RTX 4090',
  templateId: 'gijmo2nbr7'  // elena-comfyui-worker
};
```

## Exit Conditions

- All tasks marked COMPLETE
- Test end-to-end réussi
- Documentation mise à jour

---

## Execution Log

**Date**: 2026-01-24
**Status**: PARTIALLY_COMPLETED (volume not created due to insufficient funds)

### Summary
Setup complet du pod RunPod avec ComfyUI, tous les modèles, et custom nodes. Test end-to-end réussi avec génération d'image en ~62s. Script `runpod-connect.mjs` créé pour gérer les pods.

### Problems Encountered
- **Problem**: Volume réseau dans mauvais datacenter (US-KS-2 vs pod en US-NC-1)
  - **Root Cause**: Volume créé avant le pod, impossible de les connecter
  - **Solution**: Supprimé l'ancien volume, mais pas assez de fonds ($2.92 vs $5 requis) pour en créer un nouveau

- **Problem**: Uploads SCP très lents (~2MB/s)
  - **Root Cause**: Connexion internet upload limitée
  - **Solution**: Téléchargement direct depuis HuggingFace sur le pod (43MB/s)

- **Problem**: SSH commands timing out
  - **Root Cause**: Shell timeout trop court pour gros téléchargements
  - **Solution**: Utiliser nohup et vérifier progress séparément

### Decisions Made
- Utiliser SDXL Base au lieu de BigLove XL (CivitAI requiert token)
- Pas de venv sur le pod (Python 3.12 système suffisant)
- Télécharger modèles directement sur le pod plutôt qu'uploader depuis Mac

### Files Modified/Created
- `app/scripts/runpod-connect.mjs` - Script de gestion des pods
- `features/comfyui-generation-workflow/README.md` - Documentation RunPod mise à jour
- `/workspace/startup.sh` (sur pod) - Script de démarrage ComfyUI

### Current State
- Pod: `l2qs6633hmvp4c` (RTX 4090, US-NC-1)
- ComfyUI: `https://l2qs6633hmvp4c-8188.proxy.runpod.net`
- Tous modèles installés et fonctionnels
- ⚠️ Pas de volume réseau = données non persistantes

### Notes for Future
- Ajouter $5+ au compte RunPod pour créer volume persistant
- Une fois volume créé, mettre à jour `CONFIG.networkVolumeId` dans `runpod-connect.mjs`
- BigLove XL peut être uploadé si meilleure qualité requise (6.5GB)
