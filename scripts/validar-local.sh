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

echo "[VALIDACAO LOCAL] Iniciando validação por Docker"
echo "[validar-local] Stage: $STAGE"
echo "[validar-local] Repo: $REPO_ROOT"

# Verificar Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERRO] Docker não encontrado no PATH. Instale o Docker Desktop/Engine." >&2
  echo "[VALIDACAO LOCAL] Execução bloqueada" >&2
  echo "[VALIDACAO LOCAL] Código de saída: 127" >&2
  echo "[VALIDACAO LOCAL] Motivo: Docker não instalado" >&2
  exit 127
fi

# Verificar Docker Compose
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] 'docker compose' não disponível." >&2
  echo "[VALIDACAO LOCAL] Execução bloqueada" >&2
  echo "[VALIDACAO LOCAL] Código de saída: 127" >&2
  echo "[VALIDACAO LOCAL] Motivo: Docker Compose indisponível" >&2
  exit 127
fi

# Verificar se o daemon está acessível
if ! docker info >/dev/null 2>&1; then
  echo "[ERRO] Docker daemon indisponível ou sem permissão de acesso. Inicie o Docker Desktop/Engine e tente novamente." >&2
  echo "[VALIDACAO LOCAL] Execução bloqueada" >&2
  echo "[VALIDACAO LOCAL] Código de saída: 127" >&2
  echo "[VALIDACAO LOCAL] Motivo: Docker daemon indisponível" >&2
  exit 127
fi

# Verificar se arquivo compose existe
if [[ ! -f "compose.yaml" && ! -f "docker-compose.yml" ]]; then
  echo "[ERRO] compose.yaml/docker-compose.yml não encontrado." >&2
  echo "[VALIDACAO LOCAL] Execução bloqueada" >&2
  echo "[VALIDACAO LOCAL] Código de saída: 127" >&2
  echo "[VALIDACAO LOCAL] Motivo: Arquivo compose.yaml/docker-compose.yml não encontrado" >&2
  exit 127
fi

echo "[validar-local] Docker e daemon OK"

executar_container() {
  descricao="$1"
  shift
  echo "[validar-local] Executando: $descricao"
  echo "[validar-local] Comando: docker compose run --rm -T validar $*"
  inicio="$(date +%s)"
  if docker compose run --rm -T validar "$@"; then
    echo "[validar-local] APROVADO ($(( $(date +%s) - inicio ))s)"
    return 0
  else
    codigo=$?
    echo "[validar-local] REPROVADO (código $codigo, $(( $(date +%s) - inicio ))s)" >&2
    echo "[VALIDACAO LOCAL] Execução bloqueada" >&2
    echo "[VALIDACAO LOCAL] Código de saída: $codigo" >&2
    echo "[VALIDACAO LOCAL] Motivo: Falha na execução do container" >&2
    echo "[validar-local] Ação recomendada: verifique a saída acima e o estado do Docker." >&2
    return "$codigo"
  fi
}

# Determinar comando a executar dentro do container
if [[ "$STAGE" == "pre-commit" ]]; then
  # Pre-commit: rápido - typecheck obrigatório
  executar_container "typecheck" sh -c "npm run typecheck"
  exit $?
elif [[ "$STAGE" == "pre-push" ]]; then
  # Pre-push: validações completas e regressão direcionada/completa
  executar_container "typecheck + contratos + análise de impacto + testes" sh scripts/validar-container-pre-push.sh
  exit $?
else
  echo "[ERRO] Stage inválido: $STAGE" >&2
  exit 2
fi
