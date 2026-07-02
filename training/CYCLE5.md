# Cycle 5 — training runbook
> 🌐 **Language:** English · **[Español](CYCLE5.es.md)**

**Goal:** attack hallucination (weakness #1: 7/8 broken in c3 and c4) with a reinforced corpus
+ regularized training against the catastrophic forgetting that sank c4.

**What changed vs previous cycles:**
- Train corpus: hallucination 7 → 22 cases (+15 anti-hallucination with verified gold), and
  thin categories balanced (sobre_alcance/localizacion/dosis).
- Regularized hyperparameters: `--epochs 2 --lr 1e-4 --dropout 0.05`
  (previously 3 / 2e-4 / 0.0). Fewer steps + lower LR + dropout = the model learns the
  new material without trampling `interaccion`/`dosis` the way c4 did.

**Baseline to beat (honest test of 56):** c3 = 52.7% safety · soup = 52.7% / 30.5% effectiveness.
**Complementarity ceiling c3∪c4 = 69%** — that's what we're aiming for.

---

## 0. Prerequisites (one time)
- HuggingFace token with the `google/medgemma-4b-it` license accepted → `HF_TOKEN`.
- `ANTHROPIC_API_KEY` (for benchmarking at the end).

## 1. RunPod pod
- 24 GB GPU (RTX A5000 / 4090). **80 GB Volume** (hard lesson: less = "disk quota exceeded").
- PyTorch + CUDA 12.x template. Open the Web Terminal.

## 2. Setup + code + data (on the pod, from `/workspace`)
```bash
export HF_TOKEN=hf_xxx
export HF_HOME=/workspace/hf
git clone https://github.com/CesarMg91/primum.git
cd primum/training
pip install --no-cache-dir unsloth
```
> The corpus + gold already travel in the repo (`../dataset/gold.jsonl`, `../cases/split.json`).
> `train_qlora.py` filters gold down to the `train` split ids → zero test leakage.

## 3. Train cycle 5 (regularized)
```bash
python train_qlora.py --data ../dataset/gold.jsonl --out primum-medgemma-c5 \
  --epochs 2 --lr 1e-4 --dropout 0.05 --no-gguf
```
> `--no-gguf`: unsloth's export is broken for gemma3 multimodal; we use the proven path below.
> Leaves `primum-medgemma-c5-lora/` when done (~10-15 min on GPU).

## 4. Export to GGUF (proven path, not unsloth's)
```bash
QUANT=q8_0 bash build_gguf.sh primum-medgemma-c5-lora
```
> Does: peft merge → 16-bit → extract text model (drops vision) → llama.cpp convert.
> Result: `primum-4b-c5.gguf` (or whatever name it prints at the end).

## 5. Download the GGUF to your machine
RunPod web → navigate to `primum/training/`, download the `.gguf` (~4 GB) to
`D:\Proyectos\Experimento\training\out\`.

## 6. Create the model in Ollama + benchmark (local, PowerShell)
```powershell
cd D:\Proyectos\Experimento\training\out
ollama show --modelfile primum-medgemma-c3 > Modelfile.c5
```
Edit `Modelfile.c5`: change the 1st line `FROM ...` to `FROM ./primum-4b-c5.gguf`. Then:
```powershell
ollama create primum-medgemma-c5 -f Modelfile.c5
cd D:\Proyectos\Experimento\harness
npx tsx src/index.ts ollama:primum-medgemma-c5 anthropic:claude-opus-4-8 --split test
```
> The bench is resumable (cache by model+split) and has a 420s/call timeout — it survives reboots.

## 7. Verdict
Compare c5's safety/effectiveness vs c3 (52.7%) and soup (52.7%/30.5%), plus the per-category
breakdown (did hallucination rise from 1/8? did interaccion/dosis hold?). If c5 wins → new `primum`.

> **Optional — c5 soup:** if c5 has strengths distinct from c3/c4, try
> `python soup_gguf.py primum-4b-c5.gguf primum-4b-c3.gguf primum-4b-soup-c5c3.gguf`.
