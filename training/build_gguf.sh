#!/usr/bin/env bash
# Primum · LoRA -> GGUF, the proven one-command path (cycle 2+).
#
# Consolidates everything we learned the hard way in cycle 1:
#   merge with peft onto the 16-bit base  ->  extract the text-only model from
#   the multimodal merge  ->  convert with llama.cpp.  No unsloth save (broken),
#   no full-multimodal convert (fails on tensor names).
#
# Run AFTER training (primum-medgemma-lora exists), from primum/training:
#   bash build_gguf.sh
set -e

export HF_HOME="${HF_HOME:-/workspace/hf}"
LORA="${1:-primum-medgemma-lora}"
QUANT="${QUANT:-q8_0}"

test -d "$LORA" || { echo "No encuentro $LORA — ¿corrió el entrenamiento?"; exit 1; }

echo "[1/4] Fusionando LoRA -> 16-bit con peft…"
rm -rf primum-medgemma-merged
python merge_peft.py "$LORA" primum-medgemma-merged

echo "[2/4] Extrayendo el modelo de texto (tira la visión)…"
python make_text_model.py primum-medgemma-merged primum-medgemma-text
# free disk early: the HF cache and the merged model aren't needed past here
# (small /workspace quotas overflow otherwise)
rm -rf "$HF_HOME" primum-medgemma-merged 2>/dev/null || true

echo "[3/4] Preparando llama.cpp…"
test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
pip install -q -r llama.cpp/requirements.txt

echo "[4/4] Convirtiendo -> GGUF ($QUANT)…"
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
echo "  Baja el .gguf a tu PC y corre load_and_bench.ps1."
echo "════════════════════════════════════════════"
