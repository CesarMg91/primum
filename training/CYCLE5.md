# Cycle 5 — runbook de entrenamiento

**Objetivo:** atacar la alucinación (debilidad #1: 7/8 rota en c3 y c4) con corpus reforzado
+ entrenamiento regularizado contra el olvido catastrófico que hundió a c4.

**Qué cambió vs cycles previos:**
- Corpus train: alucinación 7 → 22 casos (+15 anti-alucinación con gold verificado), y
  categorías delgadas balanceadas (sobre_alcance/localizacion/dosis).
- Hiperparámetros regularizados: `--epochs 2 --lr 1e-4 --dropout 0.05`
  (antes 3 / 2e-4 / 0.0). Menos pasos + LR más bajo + dropout = el modelo aprende lo
  nuevo sin pisar `interaccion`/`dosis` como hizo c4.

**Baseline a superar (test honesto de 56):** c3 = 52.7% safety · soup = 52.7% / 30.5% efectiv.
**Techo de complementariedad c3∪c4 = 69%** — ahí apuntamos.

---

## 0. Prerequisitos (una vez)
- Token HuggingFace con licencia `google/medgemma-4b-it` aceptada → `HF_TOKEN`.
- `ANTHROPIC_API_KEY` (para benchmarkear al final).

## 1. Pod RunPod
- GPU 24 GB (RTX A5000 / 4090). **Volume 80 GB** (lección dura: menos = "disk quota exceeded").
- Template PyTorch + CUDA 12.x. Abre la Web Terminal.

## 2. Setup + código + datos (en el pod, desde `/workspace`)
```bash
export HF_TOKEN=hf_xxx
export HF_HOME=/workspace/hf
git clone https://github.com/CesarMg91/primum.git
cd primum/training
pip install --no-cache-dir unsloth
```
> El corpus + gold ya viajan en el repo (`../dataset/gold.jsonl`, `../cases/split.json`).
> `train_qlora.py` filtra gold a los ids del split `train` → cero leakage del test.

## 3. Entrenar cycle 5 (regularizado)
```bash
python train_qlora.py --data ../dataset/gold.jsonl --out primum-medgemma-c5 \
  --epochs 2 --lr 1e-4 --dropout 0.05 --no-gguf
```
> `--no-gguf`: el export de unsloth está roto para gemma3 multimodal; usamos el path probado abajo.
> Deja `primum-medgemma-c5-lora/` al terminar (~10-15 min en GPU).

## 4. Exportar a GGUF (path probado, no el de unsloth)
```bash
QUANT=q8_0 bash build_gguf.sh primum-medgemma-c5-lora
```
> Hace: merge peft → 16-bit → extrae modelo de texto (tira visión) → llama.cpp convert.
> Resultado: `primum-4b-c5.gguf` (o el nombre que imprima al final).

## 5. Bajar el GGUF a tu máquina
RunPod web → navega a `primum/training/`, descarga el `.gguf` (~4 GB) a
`D:\Proyectos\Experimento\training\out\`.

## 6. Crear modelo en Ollama + benchmark (local, PowerShell)
```powershell
cd D:\Proyectos\Experimento\training\out
ollama show --modelfile primum-medgemma-c3 > Modelfile.c5
```
Edita `Modelfile.c5`: cambia la 1ª línea `FROM ...` por `FROM ./primum-4b-c5.gguf`. Luego:
```powershell
ollama create primum-medgemma-c5 -f Modelfile.c5
cd D:\Proyectos\Experimento\harness
npx tsx src/index.ts ollama:primum-medgemma-c5 anthropic:claude-opus-4-8 --split test
```
> El bench es resumible (caché por modelo+split) y tiene timeout de 420s/llamada — sobrevive reboots.

## 7. Veredicto
Compara safety/efectiv de c5 vs c3 (52.7%) y soup (52.7%/30.5%), y el desglose por categoría
(¿subió alucinación de 1/8? ¿se mantuvo interaccion/dosis?). Si c5 gana → nuevo `primum`.

> **Opcional — soup de c5:** si c5 tiene fortalezas distintas a c3/c4, prueba
> `python soup_gguf.py primum-4b-c5.gguf primum-4b-c3.gguf primum-4b-soup-c5c3.gguf`.
