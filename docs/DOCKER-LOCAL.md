# Docker Local - Validação Reproduzível

## Objetivo

Esta infraestrutura permite executar as verificações obrigatórias do projeto (typecheck e testes de contrato locais) dentro de um container Docker Linux, garantindo ambiente reproduzível entre desenvolvedores e preparando para bloqueios via Git hooks nas próximas etapas.

**Importante:** Esta etapa B implementa APENAS a infraestrutura Docker. Os hooks Git **não** foram instalados.

## Pré-requisitos

- Docker Desktop instalado e em execução (Windows/Mac) ou Docker Engine (Linux)
- Node.js compatível conforme `.nvmrc` (`24.14.1`) - usado para referência local
- Arquivo `package-lock.json` presente

## Arquitetura

### Imagem Docker
- **Base:** `node:24.14.1-slim` (compatível com requisito >=24.14.1)
- **Usuário:** Não-privilegiado (`appuser`)
- **Dependências:** Instaladas com `npm ci --omit=optional` na imagem
- **Código:** Montado via volume (`.:/app:rw`) com volume nomeado para `node_modules` do Linux (evita conflito com node_modules do Windows)
- **Relatórios:** Montados em diretórios locais (`test-results/`, `playwright-report/`, `reports/`, `performance-results/`)

### Serviço Compose
- **Nome:** `validar`
- **Restart:** `no` (não reinicia em caso de falha)
- **Portas:** Nenhuma publicada
- **Rede:** Padrão (sem serviços externos obrigatórios)
- **Volumes:** Código + node_modules Linux + diretórios de relatórios

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
Se `docker` ou `docker compose` não forem encontrados, instale o Docker Desktop ou Docker Engine. **Não** altere configurações do sistema - apenas instale conforme necessário.

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

## Próximas etapas

Esta infraestrutura está pronta para ser utilizada pelos Git hooks (pre-commit/pre-push) nas próximas etapas, com propagação correta de códigos de saída.

**Não foram instalados hooks nesta etapa.**
