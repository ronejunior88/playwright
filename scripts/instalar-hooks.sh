#!/usr/bin/env bash
# Instalador de hooks Git (Git Bash / Linux / macOS)

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[instalar-hooks] Instalando hooks Git..."

# Verificar se já existe core.hooksPath personalizado
CURRENT_HOOKS_PATH=$(git config core.hooksPath 2>/dev/null || echo "")
if [ -n "$CURRENT_HOOKS_PATH" ]; then
  echo "[AVISO] core.hooksPath já configurado: $CURRENT_HOOKS_PATH"
  echo "[AVISO] Não sobrescrevendo sem autorização. Remova a configuração manualmente se desejar usar .githooks"
  exit 1
fi

# Verificar .githooks
if [ ! -d ".githooks" ]; then
  echo "[ERRO] Diretório .githooks não encontrado" >&2
  exit 1
fi

# Tornar hooks executáveis
chmod +x .githooks/pre-commit .githooks/pre-push 2>/dev/null || true
chmod +x scripts/validar-local.sh 2>/dev/null || true

# Configurar
git config core.hooksPath .githooks

echo "[OK] Hooks instalados!"
echo "[OK] core.hooksPath = $(git config core.hooksPath)"
echo ""
echo "Para desinstalar: git config --unset core.hooksPath"
