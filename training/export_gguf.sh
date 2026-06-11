#!/usr/bin/env bash
# Primum · export GGUF from saved LoRA adapters.
#
# Recovery path that AVOIDS unsloth's buggy save_pretrained_gguf
# ("# of LoRAs = 400 does not match # of saved modules = 0"): reload the saved
# adapters, merge to 16-bit via the working code path, then convert to GGUF
# with llama.cpp's pure-python converter (q8_0 needs no compiled binary).
#
# Run after training, from primum/training (where primum-medgemma-lora/ lives):
#   bash export_gguf.sh
set -e

LORA="${1:-primum-medgemma-lora}"
OUT="${2:-primum-medgemma}"
QUANT="${QUANT:-q8_0}"   # q8_0 = pure-python convert, ~4.3GB, high quality

test -d "$LORA" || { echo "No encuentro $LORA — ¿corrió el entrenamiento?"; exit 1; }

# clean any partial merge from a previous failed attempt to free disk
rm -rf "${OUT}-merged"

echo "[1/3] Fusionando LoRA -> 16-bit (reusa el base 4-bit en caché, sin re-descargar)…"
python - "$LORA" "${OUT}-merged" <<'PY'
import sys
from unsloth import FastModel
lora, out = sys.argv[1], sys.argv[2]
# load_in_4bit=True reuses the cached 4-bit base (no 8GB 16-bit re-download);
# save_pretrained_merged dequantizes to 16-bit for a valid GGUF source.
model, tok = FastModel.from_pretrained(lora, max_seq_length=4096, load_in_4bit=True)
model.save_pretrained_merged(out, tok, save_method="merged_16bit")
print("  merge 16-bit OK")
PY

echo "[2/3] Preparando llama.cpp (convertidor)…"
test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
pip install -q -r llama.cpp/requirements.txt

echo "[3/3] Convirtiendo -> GGUF ($QUANT)…"
python llama.cpp/convert_hf_to_gguf.py "${OUT}-merged" \
  --outfile "${OUT}-${QUANT}.gguf" --outtype "$QUANT"

# Ollama Modelfile pointing at the produced gguf
cat > Modelfile <<EOF
# Primum · MedGemma fine-tuned (es-MX) — build: ollama create primum-medgemma -f Modelfile
FROM ./${OUT}-${QUANT}.gguf
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
EOF

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Listo: ${OUT}-${QUANT}.gguf  + Modelfile"
echo "  Baja esos dos archivos y apaga el pod."
echo "════════════════════════════════════════════"
