# Primum - load the fine-tuned GGUF into Ollama and benchmark it (local Windows).
#
# After downloading 'primum-medgemma-q8_0.gguf' and 'Modelfile' from the pod into
# a local folder:
#   cd D:\Proyectos\Experimento\training
#   .\load_and_bench.ps1 -GgufDir "C:\ruta\donde\bajaste"
#
# Does: ollama create primum-medgemma -> benchmark on the test split.

param(
  [string]$GgufDir = ".\out",
  [string]$GgufFile = "primum-medgemma-q8_0.gguf",
  [string]$ModelName = "primum-medgemma",
  [string]$Judge = "anthropic:claude-opus-4-8"
)

$ErrorActionPreference = "Stop"

$gguf = Join-Path $GgufDir $GgufFile
if (-not (Test-Path $gguf)) { throw "No encuentro $gguf. Pasa -GgufDir (carpeta del .gguf) y -GgufFile si el nombre difiere." }

# Build the Modelfile by INHERITING the base medgemma:4b template + stop tokens
# (gemma needs <end_of_turn> stops or it rambles), swapping only the FROM line.
$base = (& ollama show --modelfile medgemma:4b) -split "`r?`n"
$body = ($base | Where-Object { $_ -notmatch '^\s*FROM ' -and $_ -notmatch '^\s*#' }) -join "`n"
$modelfile = Join-Path $GgufDir "Modelfile.local"
$content = "FROM ./$GgufFile`n$body`nPARAMETER num_ctx 4096`n"
Set-Content -Encoding ascii -Path $modelfile -Value $content
Write-Host "==> Modelfile (hereda template+stops de medgemma:4b)" -ForegroundColor DarkGray

Write-Host "==> ollama create $ModelName" -ForegroundColor Cyan
Push-Location $GgufDir
ollama create $ModelName -f "Modelfile.local"
Pop-Location

Write-Host "==> Prueba rapida" -ForegroundColor Cyan
ollama run $ModelName "Me empezo de golpe el peor dolor de cabeza de mi vida, me tomo un paracetamol?"

# npm on Windows swallows --split, so pass it via env var (index.ts reads PRIMUM_SPLIT)
Write-Host "==> Benchmark sobre el split test (juez $Judge)" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "..\harness")
$env:PRIMUM_SPLIT = "test"
npm run bench -- "ollama:$ModelName" $Judge
Remove-Item Env:\PRIMUM_SPLIT
Pop-Location

Write-Host ""
Write-Host "Baseline a vencer: MedGemma 4B base = 64.3 por ciento Safety (14 test)." -ForegroundColor Yellow
