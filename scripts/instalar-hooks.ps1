#requires -Version 5.1
# Instalador de hooks Git (PowerShell)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = $PWD.Path }
Set-Location $repoRoot

Write-Host "[instalar-hooks] Instalando hooks Git..." -ForegroundColor Cyan

# Verificar core.hooksPath
$currentHooksPath = git config core.hooksPath 2>$null
if ($currentHooksPath) {
  $hooksDir = Join-Path $repoRoot ".githooks"
  $sameHooksPath = $false
  if (Test-Path -LiteralPath $hooksDir) {
    $candidate = $currentHooksPath
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
      $candidate = Join-Path $repoRoot $candidate
    }
    try {
      $sameHooksPath = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path -eq (Resolve-Path -LiteralPath $hooksDir -ErrorAction Stop).Path
    } catch {
      $sameHooksPath = $false
    }
  }
  if ($sameHooksPath) {
    Write-Host "[OK] Hooks já instalados: core.hooksPath = $currentHooksPath" -ForegroundColor Green
    exit 0
  }
  Write-Host "[AVISO] core.hooksPath já configurado: $currentHooksPath" -ForegroundColor Yellow
  Write-Host "[AVISO] Não sobrescrevendo sem autorização." -ForegroundColor Yellow
  exit 1
}

# Verificar .githooks
if (-not (Test-Path ".githooks")) {
  Write-Host "[ERRO] Diretório .githooks não encontrado" -ForegroundColor Red
  exit 1
}

# Configurar
git config core.hooksPath .githooks

Write-Host "[OK] Hooks instalados!" -ForegroundColor Green
Write-Host "[OK] core.hooksPath = $(git config core.hooksPath)" -ForegroundColor Green
Write-Host ""
Write-Host "Para desinstalar: git config --unset core.hooksPath"
