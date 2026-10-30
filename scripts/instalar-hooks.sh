#!/usr/bin/env bash
# Instalador/desinstalador de hooks Git (Git Bash / Linux / macOS)

set -e

UNINSTALL=0
case "${1:-}" in
  --uninstall|-u)
    UNINSTALL=1
    ;;
  "")
    ;;
  -h|--help)
    echo "uso: $0 [--uninstall]"
    exit 0
    ;;
  *)
    echo "[ERRO] Argumento desconhecido: $1" >&2
    echo "uso: $0 [--uninstall]" >&2
    exit 2
    ;;
esac

if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "[ERRO] Não é um repositório Git." >&2
  exit 1
fi
cd "$REPO_ROOT"

is_our_hooks_path() {
  candidate="$1"
  case "$candidate" in
    ".githooks"|"./.githooks") return 0 ;;
  esac
  [ -d .githooks ] || return 1
  hooks_dir="$(cd .githooks && pwd -P)"
  candidate_dir="$(cd "$candidate" 2>/dev/null && pwd -P || true)"
  [ -n "$candidate_dir" ] && [ "$candidate_dir" = "$hooks_dir" ]
}

LOCAL_HOOKS_PATH="$(git config --local --get core.hooksPath 2>/dev/null || true)"
GLOBAL_HOOKS_PATH="$(git config --global --get core.hooksPath 2>/dev/null || true)"

if [ "$UNINSTALL" -eq 1 ]; then
  echo "[instalar-hooks] Removendo hooks Git (somente configuração local)..."

  if [ -n "$GLOBAL_HOOKS_PATH" ]; then
    echo "[AVISO] core.hooksPath global definido: $GLOBAL_HOOKS_PATH"
    echo "[AVISO] Não alterando configuração global. Remova-a manualmente se desejar."
    exit 1
  fi

  if [ -z "$LOCAL_HOOKS_PATH" ]; then
    echo "[OK] Nenhuma configuração local de core.hooksPath; nada a remover."
    exit 0
  fi

  if ! is_our_hooks_path "$LOCAL_HOOKS_PATH"; then
    echo "[AVISO] core.hooksPath local personalizado: $LOCAL_HOOKS_PATH"
    echo "[AVISO] Não removendo configuração que não aponta para .githooks."
    exit 1
  fi

  git config --local --unset core.hooksPath
  echo "[OK] Hooks removidos (core.hooksPath local)."
  exit 0
fi

echo "[instalar-hooks] Instalando hooks Git..."

if [ -n "$GLOBAL_HOOKS_PATH" ]; then
  echo "[AVISO] core.hooksPath global já configurado: $GLOBAL_HOOKS_PATH"
  echo "[AVISO] Não sobrescrevendo configuração global."
  exit 1
fi

if [ -n "$LOCAL_HOOKS_PATH" ]; then
  if is_our_hooks_path "$LOCAL_HOOKS_PATH"; then
    chmod +x .githooks/pre-commit .githooks/pre-push scripts/validar-local.sh 2>/dev/null || true
    echo "[OK] Hooks já instalados: core.hooksPath = $LOCAL_HOOKS_PATH"
    exit 0
  fi
  echo "[AVISO] core.hooksPath local já configurado: $LOCAL_HOOKS_PATH"
  echo "[AVISO] Não sobrescrevendo sem autorização. Remova a configuração manualmente se desejar usar .githooks"
  exit 1
fi

if [ ! -d ".githooks" ]; then
  echo "[ERRO] Diretório .githooks não encontrado" >&2
  exit 1
fi

chmod +x .githooks/pre-commit .githooks/pre-push scripts/validar-local.sh 2>/dev/null || true

git config --local core.hooksPath .githooks

echo "[OK] Hooks instalados!"
echo "[OK] core.hooksPath = $(git config --local --get core.hooksPath)"
echo ""
echo "Para desinstalar: bash scripts/instalar-hooks.sh --uninstall"
