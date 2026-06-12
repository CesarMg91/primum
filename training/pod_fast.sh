#!/usr/bin/env bash
# Serve a model from the pod's GPU over the network, so the LOCAL harness can
# point OLLAMA_HOST at the pod and run adversary/benchmark 5-10x faster.
#
# Run AFTER build_gguf.sh produced primum-medgemma-q8_0.gguf + Modelfile:
#   bash pod_fast.sh primum-medgemma-c3
#
# Then on your PC (PowerShell):
#   $env:OLLAMA_HOST = "https://<podid>-11434.proxy.runpod.net"
#   npm run adversary -- ollama:primum-medgemma-c3 anthropic:claude-sonnet-4-6 anthropic:claude-opus-4-8 --candidates 15
set -e

NAME="${1:-primum-medgemma}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[ollama] instalando…"
  curl -fsSL https://ollama.com/install.sh | sh
fi

# bind to 0.0.0.0 so the RunPod proxy can reach it (localhost is NOT reachable)
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "[ollama] arrancando server en 0.0.0.0:11434…"
  OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > /workspace/ollama.log 2>&1 &
  for i in $(seq 1 20); do curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
fi

test -f Modelfile || { echo "Falta Modelfile — corre build_gguf.sh primero."; exit 1; }
echo "[ollama] creando modelo $NAME desde Modelfile…"
ollama create "$NAME" -f Modelfile
ollama list

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Ollama sirviendo '$NAME' en 0.0.0.0:11434"
echo "  En tu PC (PowerShell):"
echo "     \$env:OLLAMA_HOST = \"https://<PODID>-11434.proxy.runpod.net\""
echo "  (el PODID y la URL salen en RunPod → Connect → puerto 11434 HTTP)"
echo "════════════════════════════════════════════"
