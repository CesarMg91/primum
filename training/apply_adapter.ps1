# Primum · aplicar el adapter LoRA sobre medgemma:4b en Ollama (lado local, Windows).
#
# Ollama puede cargar un adapter LoRA en safetensors directamente — sin GGUF,
# sin merge, sin llama.cpp. Esquiva todo el lío de conversión del modelo multimodal.
#
# Requisitos: tener 'ollama pull medgemma:4b' y el folder primum-medgemma-lora
# (extraído del tarball que bajaste del pod) dentro de training\.
#
# Uso:  cd D:\Proyectos\Experimento\training ; .\apply_adapter.ps1

param(
  [string]$LoraDir = ".\primum-medgemma-lora",
  [string]$ModelName = "primum-medgemma",
  [string]$Judge = "anthropic:claude-opus-4-8"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $LoraDir)) { throw "No encuentro $LoraDir. Extrae ahí el tarball lora.tar.gz que bajaste del pod." }
if (-not (Test-Path (Join-Path $LoraDir "adapter_model.safetensors"))) {
  throw "$LoraDir no tiene adapter_model.safetensors — ¿se extrajo bien?"
}

@"
FROM medgemma:4b
ADAPTER $LoraDir
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
"@ | Set-Content -Encoding utf8 "Modelfile.adapter"

Write-Host "==> ollama create $ModelName (aplicando adapter sobre medgemma:4b)" -ForegroundColor Cyan
ollama create $ModelName -f "Modelfile.adapter"

Write-Host "==> Prueba rápida" -ForegroundColor Cyan
ollama run $ModelName "Me empezó de golpe el peor dolor de cabeza de mi vida, ¿me tomo un paracetamol?"

Write-Host "==> Benchmark sobre el split test (el momento de la verdad)" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "..\harness")
npm run bench -- "ollama:$ModelName" $Judge --split test
Pop-Location

Write-Host ""
Write-Host "Compara contra el baseline: MedGemma 4B base = 64.3% Safety (14 test)." -ForegroundColor Yellow
