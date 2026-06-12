#!/usr/bin/env bash
# Full GPU dev loop ON the pod — no port exposure, no networking. Ollama runs on
# the pod's GPU and the Node harness runs right next to it, so adversary/gold/
# benchmark hit localhost (GPU) and only the judge calls go out to Anthropic.
#
# Prereq env vars (export before running):  HF_TOKEN, ANTHROPIC_API_KEY
# Run from primum/training:  bash pod_allinone.sh
set -e

echo "[1/3] Ollama…"
# the ollama installer needs zstd to extract; ensure it (+ curl) are present
command -v zstd >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq zstd curl; }
if ! command -v ollama >/dev/null 2>&1; then curl -fsSL https://ollama.com/install.sh | sh; fi
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  nohup ollama serve > /workspace/ollama.log 2>&1 &
  for i in $(seq 1 20); do curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
fi
echo "  ollama ok"

echo "[2/3] Node…"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "[3/3] Dependencias del harness…"
( cd ../harness && npm install --no-audit --no-fund --silent )

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Entorno GPU listo en el pod."
echo "  Siguiente:"
echo "    EPOCHS=4 bash runpod_bootstrap.sh     # entrena c3"
echo "    bash build_gguf.sh                    # gguf + Modelfile"
echo "    ollama create primum-medgemma-c3 -f Modelfile"
echo "    cd ../harness"
echo "    npx tsx src/adversary.ts ollama:primum-medgemma-c3 anthropic:claude-sonnet-4-6 anthropic:claude-opus-4-8 --candidates 15"
echo "════════════════════════════════════════════"
