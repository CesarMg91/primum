# Runbook — Fine-tune MedGemma en RunPod (Primum, Capa 2 · paso 3)

De cero a `primum-medgemma` corriendo en tu Ollama local. Tiempo estimado: ~1.5–2 h el primer ciclo, ~30 min los siguientes. Costo: **<$1 por ciclo** en una GPU de 24 GB (~$0.30–0.45/hr).

---

## 0. Prerrequisito (una sola vez): acceso a MedGemma en HuggingFace

1. Crea cuenta en https://huggingface.co (gratis).
2. Abre la página del modelo `google/medgemma-4b-it` y **acepta la licencia** (Health AI Developer Foundation).
3. Genera un **token de lectura**: Settings → Access Tokens → New token (role: `read`). Guárdalo, lo usarás como `HF_TOKEN`.

---

## 1. Crear el pod en RunPod

- **GPU:** RTX A5000 o RTX 4090 (24 GB). Cualquiera sobra para un 4B QLoRA.
- **Template:** "RunPod PyTorch 2.4" (o cualquiera con CUDA 12.x + PyTorch).
- **Disk:** 30 GB de container/volume (el base model pesa ~8 GB + GGUF).
- Lanza y abre la **Web Terminal** (o conéctate por SSH/Jupyter).

---

## 2. Setup del entorno (en el pod)

```bash
pip install unsloth
export HF_TOKEN=hf_xxx   # tu token del paso 0
huggingface-cli login --token $HF_TOKEN
```

## 3. Subir el dataset y el script

Opción A — clonar el repo (si está en GitHub):
```bash
git clone https://github.com/CesarMg91/primum.git
cd primum/training
cp ../dataset/gold.jsonl .
```

Opción B — subir a mano (RunPod web: botón Upload), deja en el pod:
- `train_qlora.py`
- `gold.jsonl`

## 4. Entrenar

```bash
python train_qlora.py --data gold.jsonl --out primum-medgemma --epochs 3
```

Verás el loss bajar por ~10–15 min. Al terminar deja:
- `primum-medgemma-lora/`  → adaptadores LoRA
- `primum-medgemma-gguf/unsloth.Q4_K_M.gguf`  → modelo cuantizado
- `Modelfile`  → receta de Ollama

> Si `unsloth/medgemma-4b-it` no carga, usa el repo gated:
> `python train_qlora.py --model google/medgemma-4b-it ...`

## 5. Bajar el GGUF a tu máquina

Desde RunPod (web): descarga `primum-medgemma-gguf/unsloth.Q4_K_M.gguf` y el `Modelfile`.
O por `runpodctl`:
```bash
runpodctl send primum-medgemma-gguf/unsloth.Q4_K_M.gguf
```

Déjalos juntos en una carpeta local, p. ej. `D:\Proyectos\Experimento\training\out\`.

## 6. Cargar en Ollama local

```powershell
cd D:\Proyectos\Experimento\training\out
ollama create primum-medgemma -f Modelfile
ollama run primum-medgemma "Me duele mucho la cabeza de repente, ¿me tomo un paracetamol?"
```

(Si el `FROM` del Modelfile no apunta al .gguf local, edítalo a la ruta correcta antes de `ollama create`.)

## 7. Re-benchmark — medir el lift (¡el momento de la verdad!)

```powershell
cd D:\Proyectos\Experimento\harness
npm run bench -- ollama:primum-medgemma anthropic:claude-opus-4-8 --split test
```

Compara contra el baseline pre-fine-tune:

| | Safety (14 test) |
|---|---|
| MedGemma 4B base | **64.3%** |
| primum-medgemma | ⟵ este número |

Si subió (sobre todo en los `derivacion_omitida` y los adversariales 0060/0065/0071 que el base falló), el loop de auto-mejora funciona. 🎯

---

## Notas

- **Apaga el pod** al terminar para no quemar créditos (RunPod cobra por hora encendido).
- El `gold.jsonl` guarda el system prompt genérico del benchmark, así que lo aprendido transfiere a la evaluación.
- Iterar: si el lift es bajo, sube `--epochs` a 4–5, o genera más gold (`npm run gold`) y reentrena.
- El test split (14 casos) nunca entró al training → la medición es honesta.
