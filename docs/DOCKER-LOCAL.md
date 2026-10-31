# Docker Local - Validação Reproduzível

## Objetivo

Esta infraestrutura permite executar as verificações obrigatórias do projeto (typecheck e testes de contrato locais) dentro de um container Docker Linux, garantindo ambiente reproduzível entre desenvolvedores. Ela também é usada pelos Git hooks instalados para bloquear commit e push quando as validações falham.

**Hooks instalados:** o repositório usa `core.hooksPath = .githooks` (configuração local). Os hooks `pre-commit` e `pre-push` chamam `scripts/validar-local.sh` e exigem o Docker em execução. A instalação é feita por `./scripts/instalar-hooks.ps1` no Windows ou `./scripts/instalar-hooks.sh` no Git Bash/Linux.

## Pré-requisitos

- Docker Desktop instalado e em execução (Windows/Mac) ou Docker Engine (Linux)
- Node.js compatível conforme `.nvmrc` (`24.14.1`) - usado para referência local
- Arquivo `package-lock.json` presente

## Arquitetura

### Imagem Docker
- **Base:** `node:24.14.1-slim` (compatível com requisito >=24.14.1)
- **Sistema:** `ca-certificates` e `git` (o Git é usado na análise de impacto do pre-push)
- **Usuário:** Não-privilegiado (`appuser`)
- **Dependências:** Instaladas com `npm ci --include=dev` na imagem (devDependencies + binários opcionais de plataforma, necessários ao TypeScript 7 no Linux)
- **Código:** Montado via volume (`.:/app:rw`) com volume nomeado para `node_modules` do Linux (evita conflito com node_modules do Windows)
- **Relatórios:** Montados em diretórios locais (`test-results/`, `playwright-report/`, `reports/`, `performance-results/`)

### Serviço Compose
- **Nome:** `validar`
- **Restart:** `no` (não reinicia em caso de falha)
- **Portas:** Nenhuma publicada
- **Rede:** Padrão (sem serviços externos obrigatórios)
- **Volumes:** Código + node_modules Linux + diretórios de relatórios

## Git hooks

Os hooks ficam versionados em `.githooks/` e são ativados por `core.hooksPath` local. Eles não alteram a configuração global e o instalador não sobrescreve um `core.hooksPath` personalizado.

### Instalar ou desinstalar

```bash
# Windows (PowerShell)
./scripts/instalar-hooks.ps1
./scripts/instalar-hooks.ps1 -Uninstall

# Git Bash / Linux
./scripts/instalar-hooks.sh
./scripts/instalar-hooks.sh --uninstall
```

### Comportamento

| Hook | Validação | Efeito |
|---|---|---|
| `pre-commit` | `npm run typecheck` no container | Bloqueia o commit quando o typecheck falha |
| `pre-push` | Typecheck, contratos locais, análise de impacto e testes selecionados | Bloqueia o push quando qualquer validação falha |
| `pre-push` (fallback) | Sem referência base confiável ou falha na seleção | Executa a regressão completa (`npm run test:api`) por precaução |
| Ambos | Docker ausente ou indisponível | Retornam código diferente de zero e bloqueiam a operação |

O `pre-push` usa o upstream da branch atual ou `origin/<branch>`, com fallback para `origin/Estudos`, `origin/Master` e `origin/master`, como base para a análise de impacto. Quando nenhuma base remota está disponível, ou quando a seleção não pode ser calculada, a regressão completa é executada por precaução. O diff usa `git diff --name-status -M`, portanto exclusões e renomeações são classificadas corretamente. O bypass com `--no-verify` não é recomendado; as validações também devem permanecer no CI.

## Comandos

### Verificar instalação do Docker
```bash
docker --version
docker compose version
```

### Construir imagem
```bash
docker compose build
```

### Executar validação padrão (typecheck + testes de contrato locais)
```bash
docker compose run --rm validar
```

O comando padrão executa:
1. `npm run typecheck` - Verificação de tipos TypeScript
2. `npm run test:contratos` - Testes de contrato locais (motor + registro + sem rede conforme análise)

### Executar apenas typecheck
```bash
docker compose run --rm validar npm run typecheck
```

### Executar apenas testes de contrato
```bash
docker compose run --rm validar npm run test:contratos
```

### Executar testes da API (CUIDADO - acessa API pública)
```bash
# API pública ServeRest - usa dados sintéticos criados pelos testes
# NÃO apaga recursos de terceiros
docker compose run --rm validar npm run test:api
```

**ATENÇÃO:** `test:api` acessa `https://serverest.dev` (público/compartilhado). Os testes existentes criam seus próprios dados sintéticos e tentam limpá-los. Nunca execute testes que possam afetar recursos de terceiros.

### Executar análise de impacto (apenas seleção)
```bash
# Modo completo explícito (não executa testes)
docker compose run --rm -T validar npm run impacto -- --completa --motivo "verificação manual"

# A partir de uma lista de alterações no formato do git diff --name-status -M
docker compose run --rm -T validar sh -c \
  'git diff --name-status -M origin/Estudos...HEAD > /tmp/alterados.txt && node scripts/selecionar-testes.js --arquivos /tmp/alterados.txt'
```

## Acessar relatórios

Os relatórios são gerados nos volumes montados e ficam acessíveis no host:
- `./test-results/` - Resultados JSON e artefatos do Playwright (`results.json`, traces)
- `./playwright-report/` - Relatório HTML do Playwright
- `./reports/` - Relatórios diversos
- `./performance-results/` - Resultados de performance

Para visualizar relatório HTML:
```bash
npx playwright show-report
```

## Atualizar dependências

Quando `package.json` ou `package-lock.json` mudar:

1. Reconstruir imagem (reinstala dependências):
```bash
docker compose build --no-cache
```

2. Ou remover volume node_modules para forçar reinstalação:
```bash
docker compose down -v
docker compose build
docker compose run --rm validar
```

**Nota:** O volume nomeado `node_modules` persiste entre execuções. Sempre reconstrua quando lock file mudar.

## Solução de problemas

### Docker não disponível
Se `docker` ou `docker compose` não forem encontrados, instale o Docker Desktop ou Docker Engine. **Não** altere configurações do sistema - apenas instale conforme necessário. Com os hooks instalados, a ausência do Docker bloqueia intencionalmente o commit e o push; inicie o Docker Desktop e execute a validação novamente.

### Falha ao construir imagem
- Verifique conexão com internet
- Verifique se `package-lock.json` é válido
- Tente `docker compose build --no-cache`

### node_modules incompatível (Windows/Linux)
A configuração usa volume nomeado para `/app/node_modules` do Linux, evitando conflito com node_modules do Windows. Se houver problemas, remova o volume: `docker compose down -v`

### Permissões no Windows
Com WSL2 backend, geralmente não há problemas. Se houver, verifique permissões dos diretórios montados.

### Testes falhando por conectividade
- Verifique conectividade com `https://serverest.dev`
- Falhas de rede/timeout/429 **não** devem ser mascaradas - indicam problemas de ambiente
- Use `API_TIMEOUT_MS` via variável de ambiente se necessário

## Identificação de origem da falha

| Origem | Como identificar |
|---|---|
| **Docker** | Erro ao buildar/imagem/container indisponível |
| **TypeScript** | Erro em `npm run typecheck` (erros de compilação) |
| **Testes** | Falhas em testes Playwright (asserções) |
| **Conectividade** | ECONNREFUSED, timeout, DNS, HTTP 429 em massa |

## Diagnóstico e recuperação

### Logs e códigos de saída

Os hooks exibem a saída no terminal do Git. As mensagens usam prefixos para facilitar a identificação:

- `[validar-local]` - validação no host e resultado final.
- `[TYPECHECK]`, `[CONTRATOS]`, `[ANALISE]`, `[TESTES]`, `[LATENCIA]` - etapa executada e resultado (`APROVADO`/`REPROVADO`), com duração.
- `[PRECAUCAO]` - motivo do fallback para regressão completa.
- `[ERRO]` / `[AVISO]` - falha de infraestrutura ou configuração.

Códigos de saída:

- `0` - validação aprovada.
- `1` - validação reprovada (typecheck, contratos ou testes).
- `2` - argumento ou stage inválido.
- `127` - Docker, Docker Compose ou daemon indisponível.

### Interrupção ou container preso

```bash
docker compose down
docker compose run --rm -T validar
```

`docker compose down` não remove o volume nomeado `node_modules`. Se o volume estiver corrompido ou incompatível, remova-o e reconstrua:

```bash
docker compose down -v
docker compose build
```

### Verificar ou restaurar os hooks

```bash
git config --local --get core.hooksPath
git config --global --get core.hooksPath
ls -l .githooks/pre-commit .githooks/pre-push
```

Se `core.hooksPath` estiver incorreto:

```bash
git config --local core.hooksPath .githooks
```

Se os arquivos de hook estiverem ausentes:

```bash
git checkout -- .githooks
```

Para remover apenas a configuração local:

```bash
git config --local --unset core.hooksPath
```

Não altere `core.hooksPath` global; o instalador não sobrescreve configuração global.

## Segurança

- Sem arquivos `.env` copiados para imagem
- Sem credenciais hardcoded
- Usuário não-privilegiado
- Sem `--privileged`, sem socket Docker montado
- Sem portas expostas
- Apenas dados sintéticos nos testes
- Volumes montados localmente controlados

## Estado atual da validação

A infraestrutura Docker e os Git hooks estão instalados e validados:

- `docker compose build` conclui com sucesso.
- Typecheck dentro do container retorna código `0`.
- Falhas dentro do container propagam código diferente de zero.
- `pre-commit` bloqueia commits com erro de typecheck e quando o Docker está indisponível.
- `pre-push` executa validação direcionada, bloqueia pushes inválidos e aplica regressão completa no fallback.
- A análise de impacto do `pre-push` usa `--name-status -M`, trata renomeações/exclusões e não usa `HEAD~1`; sem base remota, aplica regressão completa.
- Os instaladores falham de forma explícita quando `core.hooksPath` aponta para `.githooks` sem os hooks versionados.
- A validação host verifica o daemon (`docker info`) antes de executar o container.
- O instalador preserva `core.hooksPath` personalizado/global e não sobrescreve configurações existentes.

Para reinstalar ou remover os hooks, use os comandos da seção **Git hooks**.
