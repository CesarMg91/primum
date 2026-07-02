# Runbook — Fine-tune MedGemma on RunPod (Primum, Layer 2 · step 3)
> 🌐 **Language:** English · **[Español](RUNBOOK.es.md)**

From zero to `primum-medgemma` running on your local Ollama. Estimated time: ~1.5–2 h for the first cycle, ~30 min for the following ones. Cost: **<$1 per cycle** on a 24 GB GPU (~$0.30–0.45/hr).

---

## 0. Prerequisite (one time only): access to MedGemma on HuggingFace

1. Create an account at https://huggingface.co (free).
2. Open the model page for `google/medgemma-4b-it` and **accept the license** (Health AI Developer Foundation).
3. Generate a **read token**: Settings → Access Tokens → New token (role: `read`). Save it, you'll use it as `HF_TOKEN`.

---

## 1. Create the pod on RunPod

- **GPU:** RTX A5000 or RTX 4090 (24 GB). Either is more than enough for a 4B QLoRA.
- **Template:** "RunPod PyTorch 2.4" (or any with CUDA 12.x + PyTorch).
- **Disk:** 30 GB of container/volume (the base model weighs ~8 GB + GGUF).
- Launch it and open the **Web Terminal** (or connect via SSH/Jupyter).

---

## 2. Environment setup (on the pod)

```bash
pip install unsloth
export HF_TOKEN=hf_xxx   # tu token del paso 0
huggingface-cli login --token $HF_TOKEN
```

## 3. Upload the dataset and the script

Option A — clone the repo (if it's on GitHub):
```bash
git clone https://github.com/CesarMg91/primum.git
cd primum/training
cp ../dataset/gold.jsonl .
```

Option B — upload manually (RunPod web: Upload button), leave on the pod:
- `train_qlora.py`
- `gold.jsonl`

## 4. Train

```bash
python train_qlora.py --data gold.jsonl --out primum-medgemma --epochs 3
```

You'll see the loss drop for ~10–15 min. When it finishes it leaves:
- `primum-medgemma-lora/`  → LoRA adapters
- `primum-medgemma-gguf/unsloth.Q4_K_M.gguf`  → quantized model
- `Modelfile`  → Ollama recipe

> If `unsloth/medgemma-4b-it` doesn't load, use the gated repo:
> `python train_qlora.py --model google/medgemma-4b-it ...`

## 5. Download the GGUF to your machine

From RunPod (web): download `primum-medgemma-gguf/unsloth.Q4_K_M.gguf` and the `Modelfile`.
Or via `runpodctl`:
```bash
runpodctl send primum-medgemma-gguf/unsloth.Q4_K_M.gguf
```

Leave them together in a local folder, e.g. `D:\Proyectos\Experimento\training\out\`.

## 6. Load into local Ollama

```powershell
cd D:\Proyectos\Experimento\training\out
ollama create primum-medgemma -f Modelfile
ollama run primum-medgemma "Me duele mucho la cabeza de repente, ¿me tomo un paracetamol?"
```

(If the `FROM` in the Modelfile doesn't point to the local .gguf, edit it to the correct path before `ollama create`.)

## 7. Re-benchmark — measure the lift (the moment of truth!)

```powershell
cd D:\Proyectos\Experimento\harness
npm run bench -- ollama:primum-medgemma anthropic:claude-opus-4-8 --split test
```

Compare against the pre-fine-tune baseline:

| | Safety (14 test) |
|---|---|
| MedGemma 4B base | **64.3%** |
| primum-medgemma | ⟵ this number |

If it went up (especially on the `derivacion_omitida` cases and the adversarial 0060/0065/0071 that the base failed), the self-improvement loop works. 🎯

---

## Notes

- **Shut down the pod** when you're done so you don't burn credits (RunPod charges per hour it's on).
- The `gold.jsonl` keeps the benchmark's generic system prompt, so what's learned transfers to the evaluation.
- Iterate: if the lift is low, raise `--epochs` to 4–5, or generate more gold (`npm run gold`) and retrain.
- The test split (14 cases) never entered training → the measurement is honest.
