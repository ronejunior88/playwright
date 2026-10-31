#!/bin/sh
# Validação de pre-push executada dentro do container.
# Requer: npm, node, git e o repositório montado em /app.

set -eu

ARQUIVOS="/tmp/alterados.txt"
SELECAO="/tmp/selecao.json"
INICIO_TOTAL="$(date +%s)"

executar_etapa() {
  nome="$1"
  descricao="$2"
  shift 2
  echo "[$nome] Iniciando: $descricao"
  inicio="$(date +%s)"
  if "$@"; then
    echo "[$nome] APROVADO ($(( $(date +%s) - inicio ))s)"
    return 0
  else
    codigo=$?
    echo "[$nome] REPROVADO (código $codigo, $(( $(date +%s) - inicio ))s)" >&2
    echo "[VALIDACAO LOCAL] Execução bloqueada na etapa $nome (código $codigo)." >&2
    echo "[VALIDACAO LOCAL] Ação recomendada: corrija a falha acima e execute novamente." >&2
    exit "$codigo"
  fi
}

finalizar_sucesso() {
  echo "[VALIDACAO LOCAL] APROVADO ($(( $(date +%s) - INICIO_TOTAL ))s)"
}

executar_regressao_completa() {
  echo "[PRECAUCAO] $1" >&2
  executar_etapa "TESTES" "regressão completa (npm run test:api)" npm run test:api
  finalizar_sucesso
}

echo "[VALIDACAO LOCAL] Iniciando validação de pre-push..."
executar_etapa "TYPECHECK" "npm run typecheck" npm run typecheck
executar_etapa "CONTRATOS" "npm run test:contratos" npm run test:contratos

echo "[ANALISE] Iniciando análise de impacto..."
rm -f "$ARQUIVOS" "$SELECAO"

BASE_REF=""
BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
UPSTREAM_FULL="$(git rev-parse --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
CANDIDATOS=""
case "$UPSTREAM_FULL" in
  refs/remotes/*) CANDIDATOS="$UPSTREAM" ;;
esac
if [ -n "$BRANCH" ]; then
  CANDIDATOS="$CANDIDATOS origin/$BRANCH"
fi
CANDIDATOS="$CANDIDATOS origin/Estudos origin/Master origin/master"

for ref in $CANDIDATOS; do
  [ -n "$ref" ] || continue
  if git rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
    CANDIDATO_BASE="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
    if [ -n "$CANDIDATO_BASE" ]; then
      BASE_REF="$CANDIDATO_BASE"
      echo "[ANALISE] Base remota: $ref"
      break
    fi
  fi
done

if [ -z "$BASE_REF" ]; then
  executar_regressao_completa "referência base remota indisponível; regressão completa por precaução"
  exit $?
fi

if ! git diff --name-status -M "$BASE_REF" HEAD > "$ARQUIVOS" 2>/dev/null; then
  executar_regressao_completa "não foi possível calcular os arquivos alterados; regressão completa por precaução"
  exit $?
fi

if [ ! -s "$ARQUIVOS" ]; then
  echo "[ANALISE] Nenhuma alteração detectável; verificações básicas OK"
  finalizar_sucesso
  exit 0
fi

echo "[ANALISE] Arquivos alterados:"
sed 's/^/  - /' "$ARQUIVOS" | tr '\t' ' '

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

echo "[ANALISE] Modo: $MODO; suíte de latência: $LATENCIA"

case "$MODO" in
  completa)
    executar_regressao_completa "modo completa indicado pela análise de impacto"
    exit $?
    ;;
  nenhum)
    echo "[ANALISE] Nenhuma alteração exige testes de API; verificações básicas OK"
    finalizar_sucesso
    exit 0
    ;;
  direcionada)
    if [ -z "$TESTES" ] && [ "$LATENCIA" != "true" ]; then
      executar_regressao_completa "modo direcionado sem testes selecionados; regressão completa por precaução"
      exit $?
    fi
    if [ -n "$TESTES" ]; then
      set --
      quantidade=0
      while IFS= read -r linha; do
        if [ -n "$linha" ]; then
          set -- "$@" "$linha"
          quantidade=$((quantidade + 1))
        fi
      done <<EOF
$TESTES
EOF
      executar_etapa "TESTES" "npm run test:api com $quantidade teste(s) selecionado(s)" npm run test:api -- "$@"
    fi
    if [ "$LATENCIA" = "true" ]; then
      executar_etapa "LATENCIA" "npm run test:latencia" npm run test:latencia
    fi
    ;;
  *)
    executar_regressao_completa "modo de seleção desconhecido ($MODO); regressão completa por precaução"
    exit $?
    ;;
esac

finalizar_sucesso
