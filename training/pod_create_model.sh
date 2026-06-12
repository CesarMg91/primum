#!/usr/bin/env bash
# Create an Ollama model from the text safetensors with a WORKING gemma chat
# template. The template Ollama auto-generates from the safetensors can be
# unparseable ("Unable to generate parser for this template" -> 500). We inherit
# the known-good template from gemma3:4b (same arch/tokens as medgemma).
#
#   bash pod_create_model.sh primum-medgemma-c3 [text_dir]
set -e

NAME="${1:-primum-medgemma}"
DIR="${2:-primum-medgemma-text}"
test -d "$DIR" || { echo "Falta $DIR — corre build_gguf.sh primero."; exit 1; }

echo "[1/3] Bajando template base de gemma3:4b…"
ollama pull gemma3:4b >/dev/null

echo "[2/3] Armando Modelfile (FROM $DIR + template gemma3)…"
ollama show --modelfile gemma3:4b | grep -vE '^(FROM |#)' > /tmp/tmpl.modelfile
{ echo "FROM ./$DIR"; cat /tmp/tmpl.modelfile; } > Modelfile.gen

echo "[3/3] Creando $NAME (cuantizando a q4_K_M)…"
ollama rm "$NAME" 2>/dev/null || true
ollama create "$NAME" --quantize q4_K_M -f Modelfile.gen
ollama list
echo ""
echo "✅ $NAME creado con el template de gemma3 (ya no da 500)."
