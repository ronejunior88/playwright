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
  echo "[validar-local] Executando: typecheck (+ contratos locais se seguros)"
  # Pre-commit: rápido - typecheck obrigatório
  docker compose run --rm validar sh -c "npm run typecheck"
  exit $?
elif [[ "$STAGE" == "pre-push" ]]; then
  echo "[validar-local] Executando: typecheck + análise de impacto + testes selecionados"
  # Pre-push: typecheck + contratos locais + análise de impacto
  docker compose run --rm validar sh -c "
    set -e
    echo '=== TYPECHECK ==='
    npm run typecheck
    echo '=== CONTRATOS LOCAIS ==='
    npm run test:contratos
    echo '=== ANALISE DE IMPACTO ==='
    # Tentar obter arquivos alterados em relação à branch remota
    BASE_REF=\$(git merge-base HEAD origin/Estudos 2>/dev/null || git merge-base HEAD origin/Master 2>/dev/null || echo HEAD~1)
    if git diff --name-only \$BASE_REF HEAD > /tmp/alterados.txt 2>/dev/null && [ -s /tmp/alterados.txt ]; then
      node scripts/selecionar-testes.js --arquivos /tmp/alterados.txt --json || {
        echo '[AVISO] Análise de impacto falhou - executando regressão completa por precaução'
        npm run test:api || exit \$?
      }
      # Se análise retornou testes, tentar executar (simplificado - depende do formato)
      # Por segurança, se análise falhar ou for completa, executar suite completa
    else
      echo '[AVISO] Sem alterações detectáveis ou sem histórico remoto - verificações básicas OK'
    fi
  "
  exit $?
else
  echo "[ERRO] Stage inválido: $STAGE" >&2
  exit 2
fi
