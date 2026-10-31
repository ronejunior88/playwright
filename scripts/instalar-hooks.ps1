#requires -Version 5.1
# Instalador/desinstalador de hooks Git (PowerShell)

param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$repoRoot = $null
$insideWorkTree = $null
$previousErrorAction = $ErrorActionPreference
try {
  $ErrorActionPreference = "SilentlyContinue"
  $repoRoot = git rev-parse --show-toplevel 2>$null
  $insideWorkTree = git rev-parse --is-inside-work-tree 2>$null
} finally {
  $ErrorActionPreference = $previousErrorAction
}

if (-not $repoRoot -or $insideWorkTree -ne "true") {
  Write-Host "[ERRO] Não é um repositório Git." -ForegroundColor Red
  exit 1
}
Set-Location $repoRoot

function Get-HooksPathValue {
  param([string]$Scope)
  $value = git config --$Scope --get core.hooksPath 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return $value.Trim()
}

function Test-IsOurHooksPath {
  param([string]$Candidate)
  if ([string]::IsNullOrWhiteSpace($Candidate)) { return $false }
  $normalized = $Candidate.Trim().Replace('\', '/')
  if ($normalized -eq ".githooks" -or $normalized -eq "./.githooks") { return $true }
  $hooksDir = Join-Path $repoRoot ".githooks"
  $candidatePath = $Candidate.Trim()
  if (-not [System.IO.Path]::IsPathRooted($candidatePath)) {
    $candidatePath = Join-Path $repoRoot $candidatePath
  }
  try {
    $resolvedCandidate = (Resolve-Path -LiteralPath $candidatePath -ErrorAction Stop).Path
    $resolvedHooks = (Resolve-Path -LiteralPath $hooksDir -ErrorAction Stop).Path
    return $resolvedCandidate -eq $resolvedHooks
  } catch {
    return $false
  }
}

function Test-HooksPresent {
  $preCommit = Join-Path $repoRoot ".githooks\pre-commit"
  $prePush = Join-Path $repoRoot ".githooks\pre-push"
  return (Test-Path -LiteralPath $preCommit -PathType Leaf) -and (Test-Path -LiteralPath $prePush -PathType Leaf)
}

if ($Uninstall) {
  Write-Host "[instalar-hooks] Removendo hooks Git (somente configuração local)..." -ForegroundColor Cyan

  $globalHooksPath = Get-HooksPathValue "global"
  if ($globalHooksPath) {
    Write-Host "[AVISO] core.hooksPath global definido: $globalHooksPath" -ForegroundColor Yellow
    Write-Host "[AVISO] Não alterando configuração global. Remova-a manualmente se desejar." -ForegroundColor Yellow
    exit 1
  }

  $localHooksPath = Get-HooksPathValue "local"
  if (-not $localHooksPath) {
    Write-Host "[OK] Nenhuma configuração local de core.hooksPath; nada a remover." -ForegroundColor Green
    exit 0
  }

  if (-not (Test-IsOurHooksPath $localHooksPath)) {
    Write-Host "[AVISO] core.hooksPath local personalizado: $localHooksPath" -ForegroundColor Yellow
    Write-Host "[AVISO] Não removendo configuração que não aponta para .githooks." -ForegroundColor Yellow
    exit 1
  }

  git config --local --unset core.hooksPath
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao remover core.hooksPath local." -ForegroundColor Red
    exit 1
  }

  Write-Host "[OK] Hooks removidos (core.hooksPath local)." -ForegroundColor Green
  exit 0
}

Write-Host "[instalar-hooks] Instalando hooks Git..." -ForegroundColor Cyan

$globalHooksPath = Get-HooksPathValue "global"
if ($globalHooksPath) {
  Write-Host "[AVISO] core.hooksPath global já configurado: $globalHooksPath" -ForegroundColor Yellow
  Write-Host "[AVISO] Não sobrescrevendo configuração global." -ForegroundColor Yellow
  exit 1
}

$currentHooksPath = Get-HooksPathValue "local"
if ($currentHooksPath) {
  if (Test-IsOurHooksPath $currentHooksPath) {
    if (-not (Test-HooksPresent)) {
      Write-Host "[ERRO] core.hooksPath aponta para .githooks, mas os hooks versionados estão ausentes." -ForegroundColor Red
      Write-Host "[ERRO] Restaure .githooks/pre-commit e .githooks/pre-push (git checkout -- .githooks)." -ForegroundColor Red
      exit 1
    }
    Write-Host "[OK] Hooks já instalados: core.hooksPath = $currentHooksPath" -ForegroundColor Green
    exit 0
  }
  Write-Host "[AVISO] core.hooksPath local já configurado: $currentHooksPath" -ForegroundColor Yellow
  Write-Host "[AVISO] Não sobrescrevendo sem autorização." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path ".githooks")) {
  Write-Host "[ERRO] Diretório .githooks não encontrado" -ForegroundColor Red
  exit 1
}

if (-not (Test-HooksPresent)) {
  Write-Host "[ERRO] Hooks versionados ausentes em .githooks (pre-commit/pre-push)." -ForegroundColor Red
  Write-Host "[ERRO] Restaure os arquivos antes de instalar (git checkout -- .githooks)." -ForegroundColor Red
  exit 1
}

git config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERRO] Falha ao configurar core.hooksPath local." -ForegroundColor Red
  exit 1
}

Write-Host "[OK] Hooks instalados!" -ForegroundColor Green
Write-Host "[OK] core.hooksPath = $(git config --local --get core.hooksPath)" -ForegroundColor Green
Write-Host ""
Write-Host "Para desinstalar: .\scripts\instalar-hooks.ps1 -Uninstall"
