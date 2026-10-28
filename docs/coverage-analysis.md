# Análise de Cobertura da API — Suíte Playwright/ServeRest

Documento da **ETAPA 9**. Complementa `docs/traceability-matrix.md` com a visão
agregada de cobertura, as lacunas priorizadas por risco e as evidências de
execução.

> **Nota ETAPA 19 (2026-10-28):** os números de testes e de arquivos desta
> análise são a fotografia histórica da ETAPA 9 e foram preservados. A suíte
> atual tem **384 testes em 26 arquivos** no config principal, **78 testes
> locais de contrato** e **43 testes de impacto**; a execução validada está em
> [`integrated-quality-audit.md`](integrated-quality-audit.md).

## 1. Método da análise

1. Fonte de requisitos: documentação publicada da API
   (`serverest@2.22.1`, `https://unpkg.com/serverest@2.22.1/docs/serverest.dev.html`)
   e `https://serverest.dev`, lidas integralmente.
2. Inventário dos pontos da API (método + rota) e das listas de status de cada
   `Responses` → 16 pontos e 45 respostas documentadas.
3. Extração dos títulos reais dos 144 testes executados
   (relatório de execução do Playwright) e cruzamento com cada requisito,
   linha a linha, na matriz de rastreabilidade.
4. Comprovação por execução real contra `https://serverest.dev`.
   Nenhuma porcentagem foi estimada sem execução; toda métrica abaixo é
   rastreável até uma linha da matriz ou até o relatório de execução.

Critérios de classificação:

- **Caminho positivo**: cenário cujo resultado esperado é 2xx.
- **Caminho negativo**: cenário cujo resultado esperado é 4xx (rejeição, erro de
  validação, regra de negócio ou autorização).
- **Cobertura implícita**: comportamento verificado indiretamente, sem teste
  dedicado (declarada na matriz).

## 2. Inventário e volume

| Item | Valor |
| --- | --- |
| Pontos da API (método + rota) | 16 |
| Rotas que exigem token | 6 (`POST/PUT/DELETE /produtos`, `POST /carrinhos`, `DELETE /carrinhos/concluir-compra`, `DELETE /carrinhos/cancelar-compra`) |
| Rotas que exigem administrador | 3 (`POST/PUT/DELETE /produtos`) |
| Respostas HTTP documentadas | 45 (200 × 17, 201 × 5, 400 × 13, 401 × 7, 403 × 3) |
| Requisitos rastreados | 99 |
| Testes da suíte | 265 em 22 arquivos `*.spec.ts` |
| Testes com `@critico` (risco alto) | 25 |
| Testes com `@smoke` (subconjunto dos críticos) | 5 |
| Grupos de regressão | smoke (5), críticos (25), completa (265) — ver `docs/regression-strategy.md` |
| Testes de segurança (ETAPA 11) | 32 (12 do sanitizador + 7 de exposição/erros + 7 de entradas + 6 de auth/autorização) |
| Testes de desempenho (ETAPA 12) | 4 (20 amostras de latência) — execução isolada, fora da regressão |
| Testes de contrato (ETAPA 13) | 81 (35 do motor de schemas + 21 do registro + 25 de integração com a API) |
| Testes adicionados na ETAPA 9 | 9 |
| Cenários de validação de payload (erro por campo) | 57 (login 5, usuários 16, produtos 26, carrinhos 10) |

## 3. Cobertura por dimensão

### 3.1 Pontos da API e métodos HTTP

| Dimensão | Cobertura |
| --- | --- |
| Pontos com pelo menos 1 teste | 16/16 |
| Métodos HTTP documentados exercitados | 16/16 |
| Pontos com cenário de sucesso aprovado | 16/16 |
| Pontos com cenário de erro aprovado | 16/16 (em `GET /usuarios`, `GET /produtos` e `GET /carrinhos` a doc só define 200; o erro coberto é o 400 por chave de query não permitida, observado por execução) |

### 3.2 Respostas HTTP documentadas

| Dimensão | Cobertura |
| --- | --- |
| Respostas documentadas com cenário aprovado | 45/45 |
| Sucesso (2xx) | 22/22 |
| Erro (400/401/403) | 23/23 |

### 3.3 Autenticação e autorização

| Verificação | Cobertura | Evidência |
| --- | --- | --- |
| 401 sem `Authorization` nas 6 rotas protegidas | 6/6 | `PROD-012`, `PROD-020`, `PROD-027`, `CART-002`, `CART-025`, `CART-030` |
| 401 com token inválido nas 6 rotas protegidas | 6/6 | `PROD-013`, `PROD-021`, `PROD-028`, `CART-003`, `CART-026`, `CART-031` |
| 403 para usuário não administrador nas 3 rotas de admin | 3/3 | `PROD-015`, `PROD-022`, `PROD-029` |
| 401 para `Authorization` malformado | 1/6 rotas (padrão repetido em `POST /produtos`) | `AUTH-010` / `PROD-014` |
| Rotas abertas continuam abertas (usuários e todos os GETs) | cobertura implícita (nenhum teste envia token e os casos de sucesso retornam 2xx) | `USER-022` |
| `POST /carrinhos` aceita conta não administradora | cobertura implícita | `CART-010` |
| Token expirado (600 s) | 0/1 — fora do escopo | `AUTH-009` |

### 3.4 Validação de entrada e regras de negócio

| Categoria | Cenários aprovados |
| --- | --- |
| Payloads inválidos com erro por campo (57 casos: login 5, usuários 16, produtos 26, carrinhos 10) | 57/57 |
| Regras de negócio de cadastro (duplicidade de e-mail, duplicidade de nome, dados de outro registro) | 5/5 |
| Regras de negócio de carrinho (2º carrinho, produto duplicado, produto inexistente, estoque insuficiente) | 4/4 |
| Bloqueios de exclusão (usuário com carrinho, produto em carrinho) | 2/2 |
| Comportamento de id inexistente (400 em consulta, 201 em atualização, 200 "nenhum registro excluído") | 7/7 |
| Id com formato inválido → 400 (usuários, produtos, carrinhos) | 3/3 |
| Idempotência (concluir/cancelar duas vezes) | 2/2 |

### 3.5 Filtros de query string

| Recurso | Chaves documentadas | Chaves testadas | Combinação de filtros (AND) |
| --- | --- | --- | --- |
| `/usuarios` | `_id`, `nome`, `email`, `password`, `administrador` (5) | 5/5 | 1/1 (`nome` + `administrador`, exemplo da doc) |
| `/produtos` | `_id`, `nome`, `preco`, `descricao`, `quantidade` (5) | 5/5 | 1/1 (`preco` + `quantidade`; a doc ilustra com `nome` + `descricao`) |
| `/carrinhos` | `_id`, `precoTotal`, `quantidadeTotal`, `idUsuario` (4) | 4/4 | 1/1 (`quantidadeTotal` + `precoTotal`, exemplo da doc) |
| Chave fora da lista permitida → 400 | 3 recursos | 3/3 | — |

### 3.6 Contrato das respostas de sucesso

| Recurso | Campos validados |
| --- | --- |
| `/login` | `message`, `authorization` com formato JWT de 3 segmentos |
| `/usuarios` (lista, item, criação) | `quantidade`, `usuarios[]` com `nome`, `email`, `password`, `administrador`; `message` + `_id` na criação |
| `/produtos` (lista, item, criação) | `quantidade`, `produtos[]` com `_id`, `nome`, `descricao`, `preco` > 0, `quantidade` inteira ≥ 0; `message` + `_id` |
| `/carrinhos` (lista, item, criação) | `quantidade`, `carrinhos[]` com `_id`, `idUsuario`, `produtos[].{idProduto, quantidade, precoUnitario}`, `precoTotal`, `quantidadeTotal`; `message` + `_id` |
| Mensagens de exclusão/atualização | `message` obrigatório |

As validações ficam centralizadas em `tests/helpers/contrato.ts`
(`validarUsuario`, `validarProduto`, `validarCarrinho`, `validarLista*`,
`validarMensagemComId`, `validarErroDeCampos`), aplicadas aos pontos de leitura
e de cadastro de cada recurso.

### 3.7 Integridade de estado

| Regra | Cobertura |
| --- | --- |
| Criar carrinho reduz estoque | `CART-001`, `CART-022` |
| Cancelar compra devolve estoque | `CART-028`, `CART-034`, `CART-036` |
| Concluir compra mantém estoque reduzido | `CART-023`, `CART-033` |
| Cancelamento repetido não devolve estoque duas vezes | `CART-032` |
| Carrinho pertence ao usuário do token, operações isoladas | `CART-035` |
| Múltiplos itens: quantidade, preço total e reposição individual | `CART-036` |
| Dados persistem entre criação, consulta, atualização e exclusão | todos os CRUD de usuários e produtos |
| Exclusão respeita vínculo com carrinho | `USER-021`, `PROD-030` |

### 3.8 Caminhos positivos e negativos

| Classificação | Requisitos (matriz) | Testes |
| --- | --- | --- |
| Caminho positivo (2xx esperado) | 50 | 42 |
| Caminho negativo (4xx esperado) | 49 | 102 |
| Total | 99 | 144 |

A classificação de requisitos usa o status HTTP esperado. A de testes usa a
intenção do cenário (título e asserções principais): resultados esperados de
filtro vazio contam como positivo; idempotência e mensagens de "não existe
carrinho" contam como negativo.

> A divisão 42/102 corresponde ao inventário de cenários HTTP da ETAPA 9
> (144 testes). Os 40 testes acrescentados depois (segurança, sanitização e
> estatística) não são cenários de requisição e, portanto, não entram nessa
> classificação por caminho positivo/negativo.

## 4. Estatísticas da última execução

| Item | Valor |
| --- | --- |
| Data/hora (UTC) | 2026-10-22 |
| Comando | `npm test` (`playwright test`, `workers: 1`) |
| Aprovados | 265 |
| Falhas | 0 |
| Ignorados | 0 |
| Instáveis (flaky) | 0 |
| Duração | 138 s (2,3 min) |
| Evidência | `playwright-report/index.html` (reporter HTML) e `npx playwright test --list` → `Total: 265 tests in 22 files` |
| Resíduos de dados de teste na API após a execução | 0 (varredura por prefixos `usuario-test`, `login-test`, `admin-etapa9-`, `Produto Playwright QA`, `Produto ETAPA9`) |

Distribuição por arquivo (todos 100% aprovados):

| Arquivo | Testes |
| --- | --- |
| `tests/auth/login.spec.ts` | 10 |
| `tests/usuarios/usuarios-get.spec.ts` | 11 |
| `tests/usuarios/usuarios-create.spec.ts` | 12 |
| `tests/usuarios/usuarios-update.spec.ts` | 9 |
| `tests/usuarios/usuarios-delete.spec.ts` | 3 |
| `tests/produtos/produtos-get.spec.ts` | 10 |
| `tests/produtos/produtos-create.spec.ts` | 22 |
| `tests/produtos/produtos-update.spec.ts` | 19 |
| `tests/produtos/produtos-delete.spec.ts` | 6 |
| `tests/carrinhos/carrinhos-get.spec.ts` | 12 |
| `tests/carrinhos/carrinhos-create.spec.ts` | 20 |
| `tests/carrinhos/carrinhos-concluir.spec.ts` | 6 |
| `tests/carrinhos/carrinhos-cancelar.spec.ts` | 5 |
| `tests/carrinhos/carrinhos-integridade.spec.ts` | 4 |
| `tests/seguranca/entrada-validacao.spec.ts` | 7 |
| `tests/seguranca/exposicao-erros.spec.ts` | 7 |
| `tests/contratos/schema.spec.ts` | 35 |
| `tests/contratos/contratos.spec.ts` | 21 |
| `tests/contratos/contratos-api.spec.ts` | 25 |
| `tests/helpers/diagnostico.sanitizer.spec.ts` | 12 |
| `tests/helpers/latencia.spec.ts` | 8 |
| `tests/health.spec.ts` | 1 |
| **Total** | **265** |

## 5. Lacunas por prioridade

| Prioridade | Lacuna | Risco associado | Status/decisão |
| --- | --- | --- | --- |
| **Alta** | Nenhuma | — | Nenhum requisito documentado sem cenário e nenhuma falha na última execução |
| **Média** | `AUTH-009`: expiração de token após 600 s | Token vencido poderia ser aceito ou rejeitado de forma inesperada em rotas protegidas | **Fora do escopo**: exigiria espera ≥ 10 min por teste ou servidor local com expiração configurável; custo/tempo de execução não justificado para o comportamento padrão de JWT |
| **Média** | Cobertura implícita em `USER-022` (rotas de usuários abertas) e `CART-010` (`POST /carrinhos` sem exigir administrador) | Se alguém passar a enviar `Authorization` nos testes de usuários, a verificação deixa de existir silenciosamente | Coberto implícito, declarado na matriz; conversão em teste dedicado é barata se o risco for considerado relevante |
| **Baixa** | `Authorization` malformado testado em 1 das 6 rotas protegidas | Divergência de comportamento entre rotas (improvável: mesmo middleware) | Coberto por amostragem; generalizar é repetição de baixo valor |
| **Baixa** | Exemplo exato de filtro combinado `nome` + `descricao` em `/produtos` | Mecanismo AND já coberto por `preco` + `quantidade` | Cobertura do mecanismo aceita; exemplo específico não testado |
| **Baixa** | Semântica de filtro de texto (substring, maiúsculas/minúsculas, acentos) | Comportamento não especificado na documentação | Não coberto por indefinição documental; se especificado, vira requisito |
| **Baixa** | Concorrência (dois clientes alterando o mesmo recurso) | Estado intermediário não observado | Fora do escopo desta etapa |
| **Baixa** | 429 (rate limit do ambiente público) | Ambiente compartilhado, não é regra da API | Fora do escopo; já mitigado com `workers: 1` na ETAPA 8 |
| **Baixa** | Latência/tempo de resposta | Não é requisito documentado | **Fora do escopo como requisito**: a ETAPA 12 adicionou uma avaliação diagnóstica isolada (`docs/performance-testing.md`), sem SLA, sem gate e fora da regressão funcional |
| **Baixa** | Versão em execução no ambiente público não confirmada (docs fixadas em 2.22.1) | Comportamento observado pode diferir de outra build | Limitação declarada; todas as divergências foram verificadas por execução, não por suposição |

## 6. Requisitos críticos pendentes

- **Nenhum requisito de alta prioridade está pendente.**
- Único requisito documentado e não executado: `AUTH-009` (token expirado),
  classificado como **fora do escopo** com justificativa na seção 5.
- Comportamentos observados e não documentados já receberam cenário:
  `AUTH-004` a `AUTH-008` (400 em `/login`), `USER-008`, `PROD-007`,
  `CART-018` (chave de query não permitida), `CART-008` (validação de payload
  de carrinho), `AUTH-010`/`PROD-014` (header malformado) e `USER-009`
  (`_id` retornado por `GET /usuarios/{id}`).

## 7. Arquivos relacionados

| Papel | Arquivos |
| --- | --- |
| Requisitos e cobertura | `docs/traceability-matrix.md`, `docs/coverage-analysis.md` |
| Testes (22 arquivos) | `tests/health.spec.ts`, `tests/auth/login.spec.ts`, `tests/usuarios/*.spec.ts` (4), `tests/produtos/*.spec.ts` (4), `tests/carrinhos/*.spec.ts` (5), `tests/seguranca/*.spec.ts` (2), `tests/contratos/*.spec.ts` (3), `tests/helpers/*.spec.ts` (2) |
| Contratos centralizados | `tests/helpers/contrato.ts` (asserções por campo) e `tests/helpers/contratos.ts` (adaptador do motor de contratos) |
| Motor e registro de contratos | `contracts/schema.ts`, `contracts/contratos.ts`, `contracts/index.ts`, `docs/api-contracts.md` |
| Demais helpers | `tests/helpers/{autenticacao,diagnostico,latencia,limpeza,produtos,usuarios,carrinhos}.ts` |
| Desempenho (ETAPA 12) | `tests/performance/api-latency.spec.ts`, `playwright.latencia.config.ts`, `docs/performance-testing.md` |
| Execução | `playwright.config.ts` (`workers: 1`), `package.json` (`test`, `test:paralelo`, `test:latencia`, `test:contratos`, `test:contratos:api`, `typecheck`) |
| Evidência | `playwright-report/index.html` e `performance-results/*.json` |

## 8. Comandos de verificação

```bash
npm test                    # suíte completa (265/265 na última execução)
npm run test:contratos      # contratos locais: motor + registro (56 testes, sem rede)
npm run test:contratos:api  # contratos contra a API real (25 testes)
npm run test:latencia       # avaliação de latência isolada (4 testes, 20 amostras)
npm run typecheck           # tsc --noEmit sem erros
npx playwright test tests/usuarios/usuarios-get.spec.ts   # arquivo afetado isolado
npx playwright test -g "chave não permitida|Authorization malformado"   # cenários novos isolados
```

Validações complementares da ETAPA 9: leitura do relatório de execução para
conferir total por arquivo e status de cada teste, conferência da matriz
(99 linhas de requisito, 98 "Coberto e aprovado" + 1 "Fora do escopo") e
varredura de resíduos de dados de teste na API após a execução (0
ocorrências).

## 9. Limitações conhecidas

1. API pública compartilhada: dados de terceiros e limite de requisições
   (429) fogem ao controle da suíte; a suíte roda com `workers: 1` para
   permanecer dentro da taxa.
2. Os dados de teste são removidos a cada execução (`afterEach`/`afterAll` +
   `tests/helpers/limpeza.ts` com nova tentativa em 429); a limpeza é
   best-effort sobre um ambiente que outros clientes também alteram.
3. A matriz cobre o que a documentação 2.22.1 declara e o que o ambiente
   demonstrou; requisitos não documentados só entram quando observados por
   execução.
4. Não há teste de desempenho com critério de aceitação (a ETAPA 12 traz uma
   avaliação diagnóstica de latência, sem SLA e sem gate), nem de segurança
   profunda (injeção, limites de tamanho de payload além dos campos
   documentados) nem de versionamento da API.
5. Os contratos (ETAPA 13) verificam a **forma** das respostas, não a
   semântica de negócio: regras como "1 carrinho por usuário" continuam
   cobertas apenas pelos testes funcionais.
