#!/usr/bin/env bash
# Primum · RunPod bootstrap — clone-and-run the full MedGemma fine-tune.
#
# On a fresh pod (Web Terminal):
#   git clone https://github.com/CesarMg91/primum.git
#   cd primum/training
#   export HF_TOKEN=hf_xxx          # your Read token (MedGemma license accepted)
#   bash runpod_bootstrap.sh
#
# Optional overrides:
#   EPOCHS=4 BASE_MODEL=google/medgemma-1.5-4b-it bash runpod_bootstrap.sh
set -e

: "${HF_TOKEN:?Falta el token. Corre primero: export HF_TOKEN=hf_xxx}"
EPOCHS="${EPOCHS:-3}"
BASE_MODEL="${BASE_MODEL:-unsloth/medgemma-4b-it}"
DATA="${DATA:-../dataset/gold.jsonl}"

echo "[1/4] Instalando unsloth (puede tardar unos minutos)…"
pip install -q unsloth huggingface_hub

echo "[2/4] Login en HuggingFace…"
# The HF_TOKEN env var is what actually authenticates downloads; an explicit
# login is optional. (huggingface-cli is deprecated -> use the new `hf` CLI.)
hf auth login --token "$HF_TOKEN" --add-to-git-credential 2>/dev/null \
  || echo "  (login opcional omitido — HF_TOKEN ya está en el entorno)"

echo "[3/4] Verificando dataset…"
test -f "$DATA" || { echo "No encuentro $DATA"; exit 1; }
echo "  $(wc -l < "$DATA") ejemplos gold en $DATA"

echo "[4/4] Fine-tune ($BASE_MODEL, $EPOCHS épocas)…"
python train_qlora.py --data "$DATA" --model "$BASE_MODEL" --out primum-medgemma --epochs "$EPOCHS"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Listo. Archivos para bajar:"
echo "     primum-medgemma-gguf/unsloth.Q4_K_M.gguf"
echo "     Modelfile"
echo "  Apaga el pod después de bajarlos para no gastar créditos."
echo "════════════════════════════════════════════"
