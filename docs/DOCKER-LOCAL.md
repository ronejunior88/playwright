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

O `pre-push` usa `origin/Estudos`, `origin/Master` ou `HEAD~1` como base para a análise de impacto. Quando nenhuma base está disponível, ou quando a seleção não pode ser calculada, a regressão completa é executada. O bypass com `--no-verify` não é recomendado; as validações também devem permanecer no CI.

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
# scripts/selecionar-testes.js analisa impacto, não executa testes diretamente
docker compose run --rm validar npm run impacto -- --help
```

## Acessar relatórios

Os relatórios são gerados nos volumes montados e ficam acessíveis no host:
- `./test-results/` - Resultados JSON/XML
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
- O instalador preserva `core.hooksPath` personalizado/global e não sobrescreve configurações existentes.

Para reinstalar ou remover os hooks, use os comandos da seção **Git hooks**.
