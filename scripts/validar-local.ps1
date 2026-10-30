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
try {
  docker --version | Out-Null
} catch {
  Write-Host "[ERRO] Docker não encontrado no PATH." -ForegroundColor Red
  exit 127
}

# Verificar Docker Compose
try {
  docker compose version | Out-Null
} catch {
  Write-Host "[ERRO] 'docker compose' não disponível." -ForegroundColor Red
  exit 127
}

# Verificar compose
if (-not (Test-Path "compose.yaml") -and -not (Test-Path "docker-compose.yml")) {
  Write-Host "[ERRO] compose.yaml/docker-compose.yml não encontrado." -ForegroundColor Red
  exit 127
}

Write-Host "[validar-local] Docker OK"

if ($Stage -eq "pre-commit") {
  Write-Host "[validar-local] Executando: typecheck"
  docker compose run --rm -T validar npm run typecheck
  exit $LASTEXITCODE
}
elseif ($Stage -eq "pre-push") {
  Write-Host "[validar-local] Executando: typecheck + contratos + análise de impacto + testes"
  docker compose run --rm -T validar sh scripts/validar-container-pre-push.sh
  exit $LASTEXITCODE
}
else {
  Write-Host "[ERRO] Stage inválido: $Stage" -ForegroundColor Red
  exit 2
}
