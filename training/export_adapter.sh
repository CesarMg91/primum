#!/usr/bin/env bash
# Plan C · convert ONLY the LoRA adapter to GGUF and apply it over the existing
# medgemma:4b in Ollama.
#
# Why: converting the full MERGED multimodal Gemma3 to GGUF fails on tensor-name
# mismatches ("Can not map tensor 'model.model.embed_tokens.weight'") between
# this transformers version and llama.cpp. The LoRA adapter contains only
# language-layer deltas (no embeddings, no vision), so it converts cleanly — and
# Ollama already ships a working text GGUF of the base (medgemma:4b). We just
# overlay the adapter. Bonus: the adapter is tiny (~50MB) to download.
#
# Run from primum/training:  bash export_adapter.sh
set -e

export HF_HOME="${HF_HOME:-/workspace/hf}"
LORA="${1:-primum-medgemma-lora}"
BASE="${BASE_MODEL:-unsloth/medgemma-4b-it}"
OUT="primum-medgemma-adapter.gguf"

test -d "$LORA" || { echo "No encuentro $LORA"; exit 1; }

echo "[1/2] Preparando llama.cpp…"
test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
pip install -q -r llama.cpp/requirements.txt

echo "[2/2] Convirtiendo SOLO el adapter LoRA -> GGUF…"
python llama.cpp/convert_lora_to_gguf.py "$LORA" --base "$BASE" --outfile "$OUT"

# Ollama recipe: apply our adapter on top of the base already in Ollama.
cat > Modelfile <<EOF
# Primum · MedGemma + safety LoRA (es-MX)
# build:  ollama create primum-medgemma -f Modelfile
FROM medgemma:4b
ADAPTER ./$OUT
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
EOF

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Listo: $OUT  (+ Modelfile)"
echo "  Baja esos 2 archivos. En tu PC necesitas tener 'ollama pull medgemma:4b'."
echo "════════════════════════════════════════════"
