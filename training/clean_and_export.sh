#!/usr/bin/env bash
# Primum · limpieza de disco + exportación GGUF en un solo paso.
# Uso (desde primum/training):  bash clean_and_export.sh
set -e

echo "[limpieza] liberando espacio (no toca primum-medgemma-lora)…"
rm -rf "$HOME/.cache/huggingface/hub"/* 2>/dev/null || true
rm -rf outputs primum-medgemma-merged llama.cpp 2>/dev/null || true

echo "[disco] espacio disponible:"
df -h / /workspace 2>/dev/null || df -h

echo "[export] convirtiendo a GGUF…"
bash export_gguf.sh
