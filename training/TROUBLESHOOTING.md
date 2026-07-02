# Troubleshooting — fine-tuning MedGemma 4B → Ollama (lessons learned)

> 🌐 **Language:** English · **[Español](TROUBLESHOOTING.es.md)**

A log of the real problems we hit going from QLoRA to a GGUF running in Ollama,
and how they were solved. If you repeat the cycle (or do it with
`medgemma-1.5-4b-it`), read this first — it'll save you hours.

## The path that DOES work (summary)

1. **Train** (`train_qlora.py`) → saves `primum-medgemma-lora` (adapters). ✅
2. **Merge with peft** onto the **16-bit** base (`merge_peft.py`, called by
   `export_gguf.sh`) → `primum-medgemma-merged`. Do NOT use the unsloth merge.
3. **Extract the text model** from the multimodal merged one (`make_text_model.py`,
   called by `export_text_gguf.sh`) → `primum-medgemma-text` → GGUF q8_0.
4. **Download** the `.gguf` + `Modelfile`, `ollama create`, benchmark with `--split test`.

Shortcut if you already have `primum-medgemma-merged`: run `export_text_gguf.sh` directly.

## Gotchas (in order of appearance)

**Gemma's chat template** requires strict user/assistant alternation and does NOT
accept the `system` role. Our cases stack several patient turns in a row → error
`Conversation roles must alternate`. Fix: `normalize_messages()` in
`train_qlora.py` (folds system into the first user + merges consecutive turns).

**`huggingface-cli` is deprecated** → use `hf`. And in fact no login is needed:
the `HF_TOKEN` environment variable is enough to download gated models.

**The unsloth merge is broken** in this version: both `save_pretrained_gguf` and
`save_pretrained_merged` fail with `# of LoRAs = 400 does not match # of saved
modules = 0` (after training finished and the LoRA was saved fine).
Fix: merge with `peft` directly (`merge_peft.py`).

**The adapter points at the 4-bit base.** `adapter_config.json` has
`base_model_name_or_path = ...-unsloth-bnb-4bit`. peft CANNOT merge a LoRA into
4-bit layers. Fix: merge onto the **16-bit** base (strip the
`-unsloth-bnb-4bit` suffix). This is the standard QLoRA pattern (you train in 4-bit,
merge in 16-bit).

**Disk: the container (`/`) is small (~20 GB)** and `/root/.cache` lives there. The
16-bit base (~8.6 GB) overflows it. Fix: `export HF_HOME=/workspace/hf` — `/workspace`
is a huge network volume (TBs). ALWAYS do this on the pod.

**MedGemma is multimodal** (`Gemma3ForConditionalGeneration`). The merged model
carries the vision tower (437 tensors) + the text under `model.language_model.model.*`
(444 tensors). llama.cpp doesn't map that prefix → `Can not map tensor
'model.model.embed_tokens.weight'`. Fix: `make_text_model.py` keeps only the
text tensors, strips the `model.language_model.` prefix (→ `model.*`),
drops the vision tower, and writes a `Gemma3ForCausalLM` config. That converts cleanly.

**Ollama won't apply a safetensors adapter on top of a GGUF base.** The plan of
`FROM medgemma:4b` + `ADAPTER <lora safetensors>` fails (`no safetensors files
found`): Ollama needs base and adapter of the same type. That's why we ended up
generating the full GGUF of the fine-tuned model.

**`convert_lora_to_gguf.py` also chokes** on MedGemma's multimodal config
(`text_config` without `architectures` → `NoneType not subscriptable`). Another reason
to go with the full text-model GGUF, not the adapter.

## Environment gotchas (Windows / RunPod)

- **Pasting into the RunPod web terminal:** `Ctrl+Shift+V` (not `Ctrl+V`).
- **The `~` (tilde) on a Spanish keyboard** is hard → use absolute paths `/root`
  instead of `~`. (`~/.cache` = `/root/.cache`).
- **Autocompleting long names:** type the beginning and hit `Tab`.
- **npm on Windows eats `--split`** (it treats it as an npm config). Fix: the
  benchmark also reads `PRIMUM_SPLIT` (env var), or call `tsx` directly without npm.
- **`.ps1` files must be pure ASCII** — Windows PowerShell misinterprets
  em dashes (—), `¿`, and UTF-8 accents → parse errors. No special
  characters in PowerShell scripts.
- **Downloading files from the pod:** Jupyter Lab (port 8888) → left panel →
  navigate to `/workspace` → right-click the file → Download. For folders,
  pack them first: `tar czf /workspace/x.tar.gz folder`.
- **Stop the pod (Stop) when you're done** so you don't burn credits.

## GPU pod (fast dev loop) — disk and Ollama

Running the harness on the GPU pod (Ollama served by the GPU) makes the adversary/benchmark
5-10x faster than on local CPU. Disk lessons (it fills up easily):

- **80GB volume ALWAYS** for the 4B pipeline. The peak (HF cache ~12GB + text model
  8GB + gguf 4GB + Ollama model 4GB + checkpoints) exceeds 25-30GB. A 20-40GB volume
  gives "disk quota exceeded" / "no space left on device".
- **Ollama saves to `/root/.ollama` (the small container) by default** → fills the container.
  Fix: `export OLLAMA_MODELS=/workspace/ollama-models` before `ollama serve`.
- **`df -h /workspace` is misleading**: it shows the network disk (TBs), not your quota. Use
  `du -sh /workspace` for real usage against quota.
- **Container disk fills up during `pip install`** (unsloth pulls torch ~5GB): `pip --no-cache-dir`
  + `TMPDIR=/workspace/tmp` (see runpod_bootstrap.sh).
- **Do NOT use Ollama on the pod to serve the model** — its version (0.30.7) does NOT get along with
  our gemma3: importing the external GGUF fails (`failed to validate GGUF with llama-quantize`)
  AND importing the safetensors with `--quantize` **breaks the tokenizer** (you get garbage with
  `[UNK_BYTE_0xe29681…]` = the SentencePiece `▁` mis-mapped → generates broken text and then
  `Failed to parse input`). The auto-generated jinja template doesn't parse either (`Unable to generate
  parser for this template`).
- **Correct GPU fix: llama.cpp's `llama-server`** (`pod_serve_llama.sh`). It loads the GGUF from
  `convert_hf_to_gguf` directly (correct tokenizer + template), exposes an
  OpenAI-compatible endpoint. The harness points at it with `export OLLAMA_HOST=http://localhost:11434`.
- **Turn alternation at inference:** Gemma's strict template rejects consecutive turns
  from the same role → `gemmaNormalize()` in `models.ts` (ollama client) merges them
  before sending.
- Clean up between steps: `rm -rf outputs *.gguf llama.cpp /workspace/hf primum-medgemma-merged`.

**Recommended GPU flow** (everything on the pod, 80GB volume): `pod_allinone.sh` (Ollama only to
pull the base template if needed; Node+deps) → train (`runpod_bootstrap.sh`) →
`build_gguf.sh` → `pod_serve_llama.sh primum-medgemma-q8_0.gguf` → in the harness
`export OLLAMA_HOST=http://localhost:11434` and run the adversary/benchmark. Data via git.
