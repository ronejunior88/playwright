#requires -Version 5.1
param(
  [string]$Stage = "pre-commit"
)

$ErrorActionPreference = "Stop"

# Ir para raiz do repositório
try {
  $repoRoot = git rev-parse --show-toplevel 2>$null
  if (-not $repoRoot) { $repoRoot = $PWD.Path }
} catch {
  $repoRoot = $PWD.Path
}
Set-Location $repoRoot

Write-Host "[validar-local] Stage: $Stage"
Write-Host "[validar-local] Repo: $repoRoot"

# Verificar Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "[ERRO] Docker não encontrado no PATH." -ForegroundColor Red
  exit 127
}

$anterior = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  docker --version 2>$null | Out-Null
  $codigoVersao = $LASTEXITCODE
  docker compose version 2>$null | Out-Null
  $codigoCompose = $LASTEXITCODE
  docker info 2>$null | Out-Null
  $codigoInfo = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $anterior
}

if ($codigoVersao -ne 0) {
  Write-Host "[ERRO] Docker não encontrado no PATH." -ForegroundColor Red
  exit 127
}
if ($codigoCompose -ne 0) {
  Write-Host "[ERRO] 'docker compose' não disponível." -ForegroundColor Red
  exit 127
}
if ($codigoInfo -ne 0) {
  Write-Host "[ERRO] Docker daemon indisponível ou sem permissão de acesso. Inicie o Docker Desktop/Engine e tente novamente." -ForegroundColor Red
  exit 127
}

# Verificar compose
if (-not (Test-Path "compose.yaml") -and -not (Test-Path "docker-compose.yml")) {
  Write-Host "[ERRO] compose.yaml/docker-compose.yml não encontrado." -ForegroundColor Red
  exit 127
}

Write-Host "[validar-local] Docker e daemon OK"

function Invoke-Container {
  param(
    [string]$Descricao,
    [string[]]$Argumentos
  )
  Write-Host "[validar-local] Executando: $Descricao"
  $inicio = Get-Date
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    docker compose run --rm -T validar @Argumentos
    $codigo = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $anterior
  }
  $duracao = [int](((Get-Date) - $inicio).TotalSeconds)
  if ($codigo -eq 0) {
    Write-Host "[validar-local] APROVADO (${duracao}s)" -ForegroundColor Green
  } else {
    Write-Host "[validar-local] REPROVADO (código $codigo, ${duracao}s)" -ForegroundColor Red
    Write-Host "[validar-local] Ação recomendada: verifique a saída acima e o estado do Docker." -ForegroundColor Yellow
  }
  return $codigo
}

if ($Stage -eq "pre-commit") {
  $codigo = Invoke-Container "typecheck" @("sh", "-c", "npm run typecheck")
  exit $codigo
}
elseif ($Stage -eq "pre-push") {
  $codigo = Invoke-Container "typecheck + contratos + análise de impacto + testes" @("sh", "scripts/validar-container-pre-push.sh")
  exit $codigo
}
else {
  Write-Host "[ERRO] Stage inválido: $Stage" -ForegroundColor Red
  exit 2
}
