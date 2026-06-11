#!/usr/bin/env bash
# Disk-frugal finish when primum-medgemma-merged already exists but /workspace
# ran out of quota. Frees the HF cache and the merged model as soon as they're
# no longer needed, so the text model + GGUF fit in a small quota.
#
# Run from primum/training:  bash finish_gguf.sh
set -e

QUANT="${QUANT:-q8_0}"
test -d primum-medgemma-merged || { echo "Falta primum-medgemma-merged — corre build_gguf.sh primero."; exit 1; }

echo "[limpieza] liberando caché HF y artefactos viejos…"
rm -rf "${HF_HOME:-/workspace/hf}" primum-medgemma-text "primum-medgemma-${QUANT}.gguf" 2>/dev/null || true
df -h /workspace 2>/dev/null || true

echo "[1/2] Extrayendo modelo de texto…"
python make_text_model.py primum-medgemma-merged primum-medgemma-text
rm -rf primum-medgemma-merged   # ~8GB liberados; ya no se necesita

echo "[2/2] Convirtiendo -> GGUF ($QUANT)…"
test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
pip install -q -r llama.cpp/requirements.txt
python llama.cpp/convert_hf_to_gguf.py primum-medgemma-text \
  --outfile "primum-medgemma-${QUANT}.gguf" --outtype "$QUANT"

cat > Modelfile <<EOF
FROM ./primum-medgemma-${QUANT}.gguf
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
EOF

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Listo: primum-medgemma-${QUANT}.gguf"
echo "  Baja el .gguf a tu PC y apaga el pod."
echo "════════════════════════════════════════════"
