#!/bin/sh
# Validação de pre-push executada dentro do container.
# Requer: npm, node, git e o repositório montado em /app.

set -eu

ARQUIVOS="/tmp/alterados.txt"
SELECAO="/tmp/selecao.json"

executar_regressao_completa() {
  echo "[pre-push] $1" >&2
  echo "[pre-push] Executando regressão completa (npm run test:api)..."
  npm run test:api
}

echo "=== TYPECHECK ==="
npm run typecheck

echo "=== CONTRATOS LOCAIS ==="
npm run test:contratos

echo "=== ANALISE DE IMPACTO ==="
rm -f "$ARQUIVOS" "$SELECAO"

BASE_REF=""
if git rev-parse --verify --quiet origin/Estudos >/dev/null 2>&1; then
  BASE_REF="$(git merge-base HEAD origin/Estudos 2>/dev/null || true)"
fi
if [ -z "$BASE_REF" ] && git rev-parse --verify --quiet origin/Master >/dev/null 2>&1; then
  BASE_REF="$(git merge-base HEAD origin/Master 2>/dev/null || true)"
fi
if [ -z "$BASE_REF" ] && git rev-parse --verify --quiet HEAD~1 >/dev/null 2>&1; then
  BASE_REF="$(git rev-parse HEAD~1)"
fi

if [ -z "$BASE_REF" ]; then
  executar_regressao_completa "referência base indisponível; regressão completa por precaução"
  exit $?
fi

if ! git diff --name-only "$BASE_REF" HEAD > "$ARQUIVOS" 2>/dev/null; then
  executar_regressao_completa "não foi possível calcular os arquivos alterados; regressão completa por precaução"
  exit $?
fi

if [ ! -s "$ARQUIVOS" ]; then
  echo "[pre-push] Nenhuma alteração detectável; verificações básicas OK"
  exit 0
fi

echo "[pre-push] Arquivos alterados:"
sed 's/^/  - /' "$ARQUIVOS"

if ! node scripts/selecionar-testes.js --arquivos "$ARQUIVOS" --saida-json "$SELECAO"; then
  executar_regressao_completa "análise de impacto falhou; regressão completa por precaução"
  exit $?
fi

if [ ! -s "$SELECAO" ]; then
  executar_regressao_completa "seleção de testes não foi gerada; regressão completa por precaução"
  exit $?
fi

if ! LEITURA="$(node -e '
const fs = require("node:fs");
const resultado = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!resultado || typeof resultado.modo !== "string") process.exit(3);
process.stdout.write(resultado.modo + "\n");
process.stdout.write((resultado.latencia ? "true" : "false") + "\n");
for (const teste of Array.isArray(resultado.testes) ? resultado.testes : []) {
  process.stdout.write(teste + "\n");
}
' "$SELECAO")"; then
  executar_regressao_completa "seleção de testes inválida; regressão completa por precaução"
  exit $?
fi

MODO="$(printf '%s\n' "$LEITURA" | sed -n '1p')"
LATENCIA="$(printf '%s\n' "$LEITURA" | sed -n '2p')"
TESTES="$(printf '%s\n' "$LEITURA" | sed -n '3,$p')"

case "$MODO" in
  completa)
    executar_regressao_completa "modo completa indicado pela análise de impacto"
    exit $?
    ;;
  nenhum)
    echo "[pre-push] Nenhuma alteração exige testes de API; verificações básicas OK"
    exit 0
    ;;
  direcionada)
    if [ -z "$TESTES" ] && [ "$LATENCIA" != "true" ]; then
      executar_regressao_completa "modo direcionado sem testes selecionados; regressão completa por precaução"
      exit $?
    fi
    if [ -n "$TESTES" ]; then
      echo "=== TESTES SELECIONADOS ==="
      set --
      while IFS= read -r linha; do
        if [ -n "$linha" ]; then
          set -- "$@" "$linha"
        fi
      done <<EOF
$TESTES
EOF
      npm run test:api -- "$@"
    fi
    if [ "$LATENCIA" = "true" ]; then
      echo "=== SUITE DE LATENCIA ==="
      npm run test:latencia
    fi
    ;;
  *)
    executar_regressao_completa "modo de seleção desconhecido ($MODO); regressão completa por precaução"
    exit $?
    ;;
esac

echo "[pre-push] Validações concluídas"
