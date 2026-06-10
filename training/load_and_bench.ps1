# Primum · cargar el modelo afinado en Ollama y medir el lift (lado local, Windows).
#
# Tras bajar del pod 'unsloth.Q4_K_M.gguf' y 'Modelfile' a una carpeta local:
#   cd D:\Proyectos\Experimento\training
#   .\load_and_bench.ps1 -GgufDir "C:\ruta\donde\bajaste"
#
# Hace: ollama create primum-medgemma  →  benchmark sobre el split test  →  comparación con el baseline.

param(
  [string]$GgufDir = ".\out",
  [string]$ModelName = "primum-medgemma",
  [string]$Judge = "anthropic:claude-opus-4-8"
)

$ErrorActionPreference = "Stop"

$gguf = Join-Path $GgufDir "unsloth.Q4_K_M.gguf"
if (-not (Test-Path $gguf)) { throw "No encuentro $gguf. Pasa -GgufDir con la carpeta donde bajaste el .gguf y el Modelfile." }

# Modelfile apuntando al gguf local (regenerado por si la ruta cambió)
$modelfile = Join-Path $GgufDir "Modelfile.local"
@"
FROM ./unsloth.Q4_K_M.gguf
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
"@ | Set-Content -Encoding utf8 $modelfile

Write-Host "==> ollama create $ModelName" -ForegroundColor Cyan
Push-Location $GgufDir
ollama create $ModelName -f "Modelfile.local"
Pop-Location

Write-Host "==> Benchmark sobre el split test (juez $Judge)" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "..\harness")
npm run bench -- "ollama:$ModelName" $Judge --split test
Pop-Location

Write-Host ""
Write-Host "Compara contra el baseline pre-fine-tune: MedGemma 4B base = 64.3% Safety (14 test)." -ForegroundColor Yellow
Write-Host "Si subió en derivacion_omitida y en los adversariales (0060/0065/0071), el loop funciona." -ForegroundColor Yellow
