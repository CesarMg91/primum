#!/usr/bin/env bash
# Serve the fine-tuned GGUF on the pod's GPU via llama.cpp's llama-server
# (OpenAI-compatible). This is the RELIABLE GPU path: Ollama's import mangles
# the gemma3 tokenizer (UNK_BYTE) or rejects the external GGUF. llama-server
# loads our convert_hf_to_gguf GGUF directly — correct tokenizer + template.
#
# Run on the pod AFTER build_gguf.sh produced the .gguf:
#   bash pod_serve_llama.sh primum-medgemma-q8_0.gguf
# Then, in the same pod terminal, run the harness pointing at it:
#   cd ../harness && export OLLAMA_HOST=http://localhost:11434
#   npx tsx src/adversary.ts ollama:primum anthropic:claude-sonnet-4-6 anthropic:claude-opus-4-8 --candidates 15
set -e

GGUF="${1:-primum-medgemma-q8_0.gguf}"
PORT="${2:-11434}"
test -f "$GGUF" || { echo "Falta $GGUF — corre build_gguf.sh primero."; exit 1; }

if [ ! -x llama.cpp/build/bin/llama-server ]; then
  echo "[build] compilando llama-server con CUDA (~10 min, una sola vez)…"
  command -v cmake >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq cmake build-essential; }
  test -d llama.cpp || git clone --depth 1 https://github.com/ggerganov/llama.cpp
  cmake -S llama.cpp -B llama.cpp/build -DGGML_CUDA=ON -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF >/dev/null
  cmake --build llama.cpp/build --config Release -j --target llama-server >/dev/null
fi

echo "[serve] llama-server en 0.0.0.0:$PORT (GPU)…"
pkill -f llama-server 2>/dev/null || true
nohup ./llama.cpp/build/bin/llama-server -m "$GGUF" -ngl 99 -c 4096 \
  --host 0.0.0.0 --port "$PORT" > /workspace/llama-server.log 2>&1 &
for i in $(seq 1 40); do curl -s "http://localhost:$PORT/health" >/dev/null 2>&1 && break; sleep 2; done

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Sirviendo $GGUF en localhost:$PORT (GPU)"
echo "  En la MISMA terminal del pod:"
echo "    cd ../harness"
echo "    export OLLAMA_HOST=http://localhost:$PORT"
echo "    npx tsx src/adversary.ts ollama:primum anthropic:claude-sonnet-4-6 anthropic:claude-opus-4-8 --candidates 15"
echo "    npx tsx src/index.ts   ollama:primum anthropic:claude-opus-4-8 --split test   # benchmark"
echo "════════════════════════════════════════════"
