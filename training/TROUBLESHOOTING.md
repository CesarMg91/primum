# Troubleshooting — fine-tuning MedGemma 4B → Ollama (lecciones aprendidas)

Bitácora de los problemas reales que encontramos al pasar de QLoRA a un GGUF
corriendo en Ollama, y cómo se resolvieron. Si repites el ciclo (o lo haces con
`medgemma-1.5-4b-it`), lee esto primero — te ahorra horas.

## El camino que SÍ funciona (resumen)

1. **Entrenar** (`train_qlora.py`) → guarda `primum-medgemma-lora` (adapters). ✅
2. **Fusionar con peft** sobre el base **16-bit** (`merge_peft.py`, llamado por
   `export_gguf.sh`) → `primum-medgemma-merged`. NO usar el merge de unsloth.
3. **Extraer el modelo de texto** del merged multimodal (`make_text_model.py`,
   llamado por `export_text_gguf.sh`) → `primum-medgemma-text` → GGUF q8_0.
4. **Bajar** el `.gguf` + `Modelfile`, `ollama create`, benchmark con `--split test`.

Atajo si ya tienes `primum-medgemma-merged`: corre directo `export_text_gguf.sh`.

## Gotchas (en orden de aparición)

**Chat template de Gemma** exige alternancia estricta user/assistant y NO acepta
rol `system`. Nuestros casos meten varios turnos de paciente seguidos → error
`Conversation roles must alternate`. Fix: `normalize_messages()` en
`train_qlora.py` (pliega system en el primer user + fusiona turnos consecutivos).

**`huggingface-cli` está deprecado** → usar `hf`. Y de hecho no hace falta login:
la variable de entorno `HF_TOKEN` basta para descargar modelos gated.

**El merge de unsloth está roto** en esta versión: `save_pretrained_gguf` Y
`save_pretrained_merged` fallan con `# of LoRAs = 400 does not match # of saved
modules = 0` (después de que el entrenamiento terminó y el LoRA se guardó bien).
Fix: fusionar con `peft` directo (`merge_peft.py`).

**El adapter apunta al base 4-bit.** `adapter_config.json` tiene
`base_model_name_or_path = ...-unsloth-bnb-4bit`. peft NO puede fusionar LoRA en
capas 4-bit. Fix: fusionar sobre el base **16-bit** (quitar el sufijo
`-unsloth-bnb-4bit`). Es el patrón estándar de QLoRA (entrenas en 4-bit, fusionas
en 16-bit).

**Disco: el container (`/`) es chico (~20 GB)** y ahí vive `/root/.cache`. El base
16-bit (~8.6 GB) lo desborda. Fix: `export HF_HOME=/workspace/hf` — `/workspace`
es un volumen de red enorme (TBs). Hazlo SIEMPRE en el pod.

**MedGemma es multimodal** (`Gemma3ForConditionalGeneration`). El modelo fusionado
trae la torre de visión (437 tensores) + el texto bajo `model.language_model.model.*`
(444 tensores). llama.cpp no mapea ese prefijo → `Can not map tensor
'model.model.embed_tokens.weight'`. Fix: `make_text_model.py` conserva solo los
tensores de texto, les quita el prefijo `model.language_model.` (→ `model.*`),
tira la visión, y escribe un config `Gemma3ForCausalLM`. Eso convierte limpio.

**Ollama no aplica un adapter safetensors sobre un base GGUF.** El plan de
`FROM medgemma:4b` + `ADAPTER <lora safetensors>` falla (`no safetensors files
found`): Ollama necesita base y adapter del mismo tipo. Por eso terminamos
generando el GGUF completo del modelo afinado.

**`convert_lora_to_gguf.py` también choca** con el config multimodal de MedGemma
(`text_config` sin `architectures` → `NoneType not subscriptable`). Otra razón
para ir por el GGUF del modelo de texto completo, no por el adapter.

## Gotchas de entorno (Windows / RunPod)

- **Pegar en la terminal web de RunPod:** `Ctrl+Shift+V` (no `Ctrl+V`).
- **La `~` (tilde) en teclado español** es difícil → usa rutas absolutas `/root`
  en vez de `~`. (`~/.cache` = `/root/.cache`).
- **Autocompletar nombres largos:** escribe el inicio y aprieta `Tab`.
- **npm en Windows se come `--split`** (lo trata como config de npm). Fix: el
  benchmark también lee `PRIMUM_SPLIT` (env var), o llama `tsx` directo sin npm.
- **Los `.ps1` deben ser ASCII puro** — PowerShell de Windows malinterpreta
  guiones largos (—), `¿`, y acentos UTF-8 → errores de parseo. Sin caracteres
  especiales en scripts PowerShell.
- **Bajar archivos del pod:** Jupyter Lab (puerto 8888) → panel izquierdo →
  navega a `/workspace` → clic derecho en el archivo → Download. Para carpetas,
  empácalas primero: `tar czf /workspace/x.tar.gz carpeta`.
- **Apaga el pod (Stop) al terminar** para no gastar créditos.

## Pod GPU (dev loop rápido) — disco y Ollama

Correr el harness en el pod GPU (Ollama servido por GPU) hace adversario/benchmark
5-10x más rápido que en CPU local. Lecciones de disco (se llena fácil):

- **Volumen de 80GB SIEMPRE** para el pipeline 4B. El pico (caché HF ~12GB + modelo
  texto 8GB + gguf 4GB + modelo Ollama 4GB + checkpoints) supera 25-30GB. Un volumen
  de 20-40GB da "disk quota exceeded" / "no space left on device".
- **Ollama guarda en `/root/.ollama` (container chico) por defecto** → llena el container.
  Fix: `export OLLAMA_MODELS=/workspace/ollama-models` antes de `ollama serve`.
- **El `df -h /workspace` engaña**: muestra el disco de red (TBs), no tu cuota. Usa
  `du -sh /workspace` para el uso real contra cuota.
- **Container disk se llena en `pip install`** (unsloth jala torch ~5GB): `pip --no-cache-dir`
  + `TMPDIR=/workspace/tmp` (ver runpod_bootstrap.sh).
- **Importar GGUF externo a Ollama del pod falla** (`failed to validate GGUF with
  llama-quantize`): el Ollama del pod usa otra llama.cpp. Fix: importar el safetensors
  de texto y dejar que Ollama cuantice — `ollama create NAME --quantize q4_K_M -f Modelfile`
  con `FROM ./primum-medgemma-text`.
- Limpia entre pasos: `rm -rf outputs *.gguf llama.cpp /workspace/hf primum-medgemma-merged`.

Flujo: deploy pod (volumen 80GB) → `pod_allinone.sh` → entrenar → `ollama create` del
safetensors → correr harness en el pod (localhost Ollama GPU). Datos sincronizan por git.
