#!/usr/bin/env bash
# Validador local único para Playwright + Docker
# Uso: validar-local.sh --stage pre-commit|pre-push

set -e

STAGE="pre-commit"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)
      STAGE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Ir para raiz do repositório
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "[validar-local] Stage: $STAGE"
echo "[validar-local] Repo: $REPO_ROOT"

# Verificar Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERRO] Docker não encontrado no PATH. Instale o Docker Desktop/Engine." >&2
  exit 127
fi

# Verificar Docker Compose
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] 'docker compose' não disponível." >&2
  exit 127
fi

# Verificar se arquivo compose existe
if [[ ! -f "compose.yaml" && ! -f "docker-compose.yml" ]]; then
  echo "[ERRO] compose.yaml/docker-compose.yml não encontrado." >&2
  exit 127
fi

echo "[validar-local] Docker OK"

# Determinar comando a executar dentro do container
if [[ "$STAGE" == "pre-commit" ]]; then
  echo "[validar-local] Executando: typecheck"
  # Pre-commit: rápido - typecheck obrigatório
  docker compose run --rm -T validar sh -c "npm run typecheck"
  exit $?
elif [[ "$STAGE" == "pre-push" ]]; then
  echo "[validar-local] Executando: typecheck + contratos + análise de impacto + testes"
  # Pre-push: validações completas e regressão direcionada/completa
  docker compose run --rm -T validar sh scripts/validar-container-pre-push.sh
  exit $?
else
  echo "[ERRO] Stage inválido: $STAGE" >&2
  exit 2
fi
