#!/bin/bash
# Setup script for Elena LoRA v5 BigLove XL training on new Vast.ai pod
# Usage: Run this after SSH into the new pod

set -e

echo "=============================================="
echo "Setting up Elena LoRA v5 BigLove XL Training"
echo "=============================================="

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
pip install xformers torchvision --upgrade -q
pip install accelerate transformers safetensors -q

# 2. Clone kohya sd-scripts
echo "[2/6] Cloning kohya sd-scripts..."
cd /workspace
if [ ! -d "sd-scripts" ]; then
    git clone --depth 1 https://github.com/kohya-ss/sd-scripts.git
    cd sd-scripts
    pip install -r requirements.txt -q
else
    echo "sd-scripts already exists"
fi

# 3. Download BigLove XL from CivitAI
echo "[3/6] Downloading BigLove XL (~6.5GB)..."
mkdir -p /workspace/models
cd /workspace/models

# BigLove XL v2 from CivitAI (direct download link)
if [ ! -f "biglovexl_v2.safetensors" ]; then
    # Using aria2c for faster download if available
    if command -v aria2c &> /dev/null; then
        aria2c -x 16 -s 16 -o biglovexl_v2.safetensors \
            "https://civitai.com/api/download/models/1081163?type=Model&format=SafeTensor&size=pruned&fp=fp16"
    else
        wget -O biglovexl_v2.safetensors \
            "https://civitai.com/api/download/models/1081163?type=Model&format=SafeTensor&size=pruned&fp=fp16"
    fi
else
    echo "BigLove XL already downloaded"
fi

# Verify download
if [ -f "biglovexl_v2.safetensors" ]; then
    SIZE=$(stat -f%z biglovexl_v2.safetensors 2>/dev/null || stat -c%s biglovexl_v2.safetensors)
    echo "BigLove XL size: $SIZE bytes"
    if [ "$SIZE" -lt 1000000000 ]; then
        echo "WARNING: File seems too small, download may have failed"
    fi
fi

# 4. Create dataset directory structure
echo "[4/6] Creating dataset structure..."
mkdir -p /workspace/elena-dataset-kohya/10_elena

# 5. Create training script
echo "[5/6] Creating training script..."
cat > /workspace/train_elena_v5_biglove_native.sh << 'TRAINSCRIPT'
#!/bin/bash
# Elena LoRA v5 for BigLove XL (trained ON BigLove XL)

set -e
export CUDA_VISIBLE_DEVICES=0

BASE_MODEL="/workspace/models/biglovexl_v2.safetensors"
DATASET_DIR="/workspace/elena-dataset-kohya"
OUTPUT_DIR="/workspace/output/elena_v5_biglove_native"
OUTPUT_NAME="elena_v5_biglove_native"

mkdir -p $OUTPUT_DIR

echo "=============================================="
echo "Elena LoRA v5 - Training ON BigLove XL"
echo "=============================================="
echo "Base model: $BASE_MODEL"
echo "Dataset: $DATASET_DIR"
echo "Output: $OUTPUT_DIR/$OUTPUT_NAME"
echo "Steps: 4000"
echo "Rank: 32, Alpha: 16"
echo "=============================================="

cd /workspace/sd-scripts

accelerate launch --num_cpu_threads_per_process 4 \
  sdxl_train_network.py \
  --pretrained_model_name_or_path="$BASE_MODEL" \
  --train_data_dir="$DATASET_DIR" \
  --output_dir="$OUTPUT_DIR" \
  --output_name="$OUTPUT_NAME" \
  --resolution=1024,1024 \
  --train_batch_size=1 \
  --learning_rate=5e-5 \
  --text_encoder_lr=5e-6 \
  --max_train_steps=4000 \
  --save_every_n_steps=500 \
  --save_model_as=safetensors \
  --mixed_precision=bf16 \
  --save_precision=bf16 \
  --network_module=networks.lora \
  --network_dim=32 \
  --network_alpha=16 \
  --optimizer_type=AdamW8bit \
  --lr_scheduler=cosine_with_restarts \
  --lr_warmup_steps=300 \
  --cache_latents \
  --caption_extension=.txt \
  --shuffle_caption \
  --enable_bucket \
  --bucket_reso_steps=64 \
  --min_bucket_reso=512 \
  --max_bucket_reso=1536 \
  --xformers \
  --gradient_checkpointing \
  --seed=42 \
  --logging_dir="$OUTPUT_DIR/logs" \
  2>&1 | tee "$OUTPUT_DIR/training.log"

echo "=============================================="
echo "Training complete!"
echo "Output: $OUTPUT_DIR/$OUTPUT_NAME.safetensors"
echo "=============================================="
TRAINSCRIPT

chmod +x /workspace/train_elena_v5_biglove_native.sh

echo "[6/6] Setup complete!"
echo ""
echo "=============================================="
echo "NEXT STEPS:"
echo "=============================================="
echo "1. Copy dataset from first pod:"
echo "   scp -P 27228 root@ssh3.vast.ai:/workspace/elena-dataset-kohya/10_elena/* /workspace/elena-dataset-kohya/10_elena/"
echo ""
echo "2. Start training:"
echo "   nohup /workspace/train_elena_v5_biglove_native.sh > /workspace/training_biglove.log 2>&1 &"
echo ""
echo "3. Monitor progress:"
echo "   tail -f /workspace/training_biglove.log"
echo "=============================================="
