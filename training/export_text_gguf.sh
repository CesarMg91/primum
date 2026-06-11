#!/usr/bin/env bash
# Primum · final GGUF export — extract the text-only model from the existing
# merged multimodal model, then convert. Reuses primum-medgemma-merged (already
# on disk): no re-train, no re-merge, no big download.
#
# Run from primum/training:  bash export_text_gguf.sh
set -e

export HF_HOME="${HF_HOME:-/workspace/hf}"
MERGED="${1:-primum-medgemma-merged}"
QUANT="${QUANT:-q8_0}"

test -d "$MERGED" || { echo "No existe $MERGED — corre export_gguf.sh primero para fusionar."; exit 1; }

echo "[1/3] Extrayendo modelo de texto (tira la visión)…"
python make_text_model.py "$MERGED" primum-medgemma-text

echo "[2/3] Preparando llama.cpp…"
test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
pip install -q -r llama.cpp/requirements.txt

echo "[3/3] Convirtiendo modelo de texto -> GGUF ($QUANT)…"
python llama.cpp/convert_hf_to_gguf.py primum-medgemma-text \
  --outfile "primum-medgemma-${QUANT}.gguf" --outtype "$QUANT"

cat > Modelfile <<EOF
# Primum · MedGemma fine-tuned (es-MX) — build: ollama create primum-medgemma -f Modelfile
FROM ./primum-medgemma-${QUANT}.gguf
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
EOF

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Listo: primum-medgemma-${QUANT}.gguf  (+ Modelfile)"
echo "  Baja esos 2 archivos a tu PC."
echo "════════════════════════════════════════════"
