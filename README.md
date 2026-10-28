# ServeRest API Tests

Projeto de estudos de automação de testes de API com **Playwright + TypeScript**
contra a API pública [ServeRest](https://serverest.dev).

## Pré-requisitos

- Node.js **24.14.1** (fixado em `.nvmrc` e em `engines.node`) e npm 11+
- Acesso à internet (a API testada é pública e compartilhada)

## Instalação

```bash
node --version   # deve ser v24.14.1
npm ci
```

Não é necessário baixar navegadores: a suíte é **somente de API** (usa o
`APIRequestContext` do Playwright).

## Configuração por ambiente

Os padrões são `https://serverest.dev` e timeout de `30000` ms por teste. Para
alterar sem editar o código, use variáveis de ambiente:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `SERVE_REST_BASE_URL` | `https://serverest.dev` | URL base da API |
| `API_TIMEOUT_MS` | `30000` | Timeout por teste, entre 1 e 120000 ms |
| `CI` | não definido | `true` ativa retries, `forbidOnly` e reporter do GitHub |

O `.env.example` documenta as variáveis. Copie para `.env` apenas se necessário;
o arquivo é ignorado pelo Git e carregado automaticamente quando existe.
Variáveis já definidas no processo têm precedência. Valores inválidos falham
antes da execução dos testes. Detalhes em
[`docs/test-data-and-environments.md`](docs/test-data-and-environments.md).

## Execução

```bash
npm test              # executa toda a suíte
npm run test:api      # alias para toda a suíte (100% API)
npm run test:smoke    # apenas os 5 testes de smoke (@smoke)
npm run test:criticos # apenas os 25 testes de risco alto (@critico)
npm run test:latencia # avaliação isolada de latência da API (GET, 20 amostras)
npm run test:contratos      # contratos: motor + registro (78 testes, sem rede)
npm run test:contratos:api  # contratos: integração com a API (25 testes)
npm run test:impacto  # análise de impacto: 43 testes da seleção (sem rede)
npm run impacto -- --arquivos changed-files.txt  # analisa um diff do Git
npm run test:mutacao  # mutation testing local com Stryker (~19 min, sem rede)
npm run typecheck     # checagem de tipos (tsc --noEmit)
npm run report        # abre o relatório HTML da última execução
```

Exemplos com filtros:

```bash
npx playwright test tests/health.spec.ts   # um arquivo
npx playwright test tests/carrinhos        # um diretório
npx playwright test -g "login"             # por título
```

## Scripts

| Script               | Descrição                                                    |
| -------------------- | ------------------------------------------------------------ |
| `npm test`           | Regressão completa: 384 testes (1 worker), ~3,7 min.         |
| `npm run test:api`   | Alias de `npm test` (a suíte inteira é API).                 |
| `npm run test:smoke` | Smoke: 5 testes (`--grep @smoke`), ~6 s.                     |
| `npm run test:criticos` | Risco alto: 25 testes (`--grep @critico`), ~57 s.         |
| `npm run test:paralelo` | Executa com 2 workers (mais rápido, pode receber **429**). |
| `npm run test:latencia` | Latência da API: config e suíte isoladas, ~17 s.           |
| `npm run test:contratos` | Contratos: motor e registro, 78 testes **sem rede**, ~2 s. |
| `npm run test:contratos:api` | Contratos contra a API real, 25 testes, ~30 s.        |
| `npm run test:impacto` | Seleção por impacto: 43 testes, **sem rede**, ~1 s.        |
| `npm run impacto` | Analisa um diff e indica modo, nível e testes afetados.   |
| `npm run test:mutacao` | Mutation testing (Stryker): 5 arquivos, ~19 min, **sem rede**. |
| `npm run typecheck`  | Verifica os tipos com TypeScript.                            |
| `npm run report`     | Abre o relatório HTML.                                       |

A classificação de risco, os grupos de regressão e as regras de evolução das
tags estão em [`docs/regression-strategy.md`](docs/regression-strategy.md);
os critérios de aprovação (quality gate) estão em
[`docs/quality-gate.md`](docs/quality-gate.md); o escopo dos testes de
segurança (autenticação, autorização, entradas, exposição de dados e
sanitização de logs) está em
[`docs/security-testing.md`](docs/security-testing.md); a avaliação de
latência da API está em
[`docs/performance-testing.md`](docs/performance-testing.md); o catálogo de
contratos da API está em
[`docs/api-contracts.md`](docs/api-contracts.md); o diagnóstico de
duplicação/tipagem da suíte, com as decisões de escopo, está em
[`docs/code-quality.md`](docs/code-quality.md); e a avaliação da força dos
testes (mutation testing) está em
[`docs/mutation-testing.md`](docs/mutation-testing.md); a análise de impacto
com seleção de testes está em
[`docs/change-impact-analysis.md`](docs/change-impact-analysis.md); as
decisões sobre dados e ambientes estão em
[`docs/test-data-and-environments.md`](docs/test-data-and-environments.md); e a
auditoria integrada da ETAPA 19 está em
[`docs/integrated-quality-audit.md`](docs/integrated-quality-audit.md).

## Estrutura

```
contracts/                       # motor e registro de contratos (sem dependências)
  schema.ts                      # validador de schemas e classificação de divergências
  contratos.ts                   # registro dos 25 contratos da API (fonte da verdade)
  index.ts                       # API pública: buscar/verificar/listar contratos
scripts/
  selecionar-testes.js           # CLI de análise de impacto (diff → validações)
  impacto/
    projeto.js                   # grafo de imports e dependentes por spec
    selecao.js                   # regras puras de seleção e fallback
tests/
  fixtures.ts                 # test/expect estendidos (evidência automática de API)
  health.spec.ts              # health check da API
  auth/login.spec.ts          # POST /login
  seguranca/                  # testes de segurança (entrada e exposição/erros)
    entrada-validacao.spec.ts
    exposicao-erros.spec.ts
  produtos/                   # GET/POST/PUT/DELETE /produtos
  usuarios/                   # GET/POST/PUT/DELETE /usuarios
  carrinhos/                  # GET/POST e conclusão/cancelamento de compra
  contratos/                 # testes dos contratos da API
    schema.spec.ts           # motor de schemas (50 testes, sem rede)
    contratos.spec.ts        # consistência do registro (28 testes, sem rede)
    contratos-api.spec.ts    # contratos contra a API real (25 testes)
  performance/                # avaliação isolada de latência (fora da regressão)
    api-latency.spec.ts
  impacto/
    selecao.spec.ts           # testes da análise de impacto (43, sem rede)
  helpers/                    # utilitários reutilizados pelos testes
    autenticacao.ts           # login, bearer() e mensagens de autenticação
    aleatorio.ts              # sufixos e valores únicos com crypto
    configuracao.ts           # URL, timeout, workers, retries e .env
    configuracao.spec.ts      # testes unitários da configuração (sem rede)
    dados.spec.ts             # testes unitários de geração de dados (sem rede)
    resposta.ts               # formato de corpo da API e lerJson()
    usuarios.ts               # usuários, senhas e dados únicos
    produtos.ts               # produtos, preços e quantidades
    carrinhos.ts
    cenario-carrinhos.ts      # ciclo de vida compartilhado pelos specs de carrinho
    contrato.ts               # validadores de contrato centralizados
    contratos.ts              # adaptador Playwright do motor de contratos
    diagnostico.ts            # sanitização e classificação de status para evidências
    diagnostico.sanitizer.spec.ts  # testes unitários do sanitizador
    latencia.ts                # medição, classificação de falhas e estatística
    latencia.spec.ts          # testes unitários do cálculo estatístico (sem rede)
    resposta.spec.ts          # testes unitários da leitura de resposta (sem rede)
    limpeza.ts                # exclusão com retry em 429/rede e anotação de falhas
docs/
  traceability-matrix.md      # matriz requisito x cenário x arquivo (99 requisitos)
  coverage-analysis.md        # cobertura agregada e lacunas por risco
  regression-strategy.md      # classificação de risco e grupos smoke/críticos
  quality-gate.md             # critérios de aprovação da suíte
  security-testing.md         # escopo, achados e sanitização (ETAPA 11)
  performance-testing.md      # avaliação de latência da API (ETAPA 12)
  api-contracts.md            # catálogo de contratos e divergências (ETAPA 13)
  code-quality.md             # duplicação, tipagem e decisões de escopo (ETAPA 14)
  mutation-testing.md         # força dos testes via Stryker (ETAPA 15)
  change-impact-analysis.md   # análise de impacto e seleção de testes (ETAPA 16)
  test-data-and-environments.md # dados, isolamento e configuração (ETAPA 18)
  integrated-quality-audit.md # auditoria integrada e prontidão (ETAPA 19)
stryker.conf.json             # configuração do mutation testing
playwright.latencia.config.ts # config isolado da suíte de desempenho
.env.example                  # modelo das variáveis de ambiente
.nvmrc                        # versão de Node.js usada localmente e no CI
```

## Contratos da API

A pasta `contracts/` mantém a **fonte da verdade estrutural** da API: o que
cada endpoint deve devolver (status, `content-type` e forma do corpo). O
motor (`contracts/schema.ts`) não tem dependência externa e classifica cada
divergência como **incompatível** (quebra de contrato) ou **compatível** (campo
novo, que não reprova a suíte).

- `npm run test:contratos` roda a suíte local do motor e do registro
  (**78 testes, sem rede**) — é a checagem que detecta mudança de contrato em
  tempo de build.
- `npm run test:contratos:api` roda a integração com a API real
  (**25 testes**), confirmando cada contrato registrado contra a API pública.
- Os contratos também são verificados **dentro dos testes funcionais**: cada
  cenário relevante chama `validarContrato('id.do.contrato', response)`, de
  modo que uma mudança de formato na API quebra a suíte mesmo que as
  asserções por campo continuem passando.

As divergências conhecidas entre documentação, contrato e ambiente (D1–D8)
estão registradas em [`docs/api-contracts.md`](docs/api-contracts.md) — elas
são **documentadas**, não "corrigidas" na suíte.


## Avaliação de latência

`npm run test:latencia` executa uma suíte **separada** que mede o tempo de
resposta de 4 endpoints `GET` de leitura (5 amostras fixas por cenário, sem
concorrência e sem criar dados). Ela usa um config próprio
(`playwright.latencia.config.ts`) e **não** faz parte da regressão funcional:
`playwright.config.ts` ignora `**/performance/**`, de modo que `npm test` não
mistura métricas de desempenho com resultados funcionais nem adiciona
requisições à API pública compartilhada.

Os resultados são gravados em `performance-results/` (fora do controle de
versão) e nenhuma amostra lenta reprova a execução. O escopo, as métricas, os
limites experimentais (que **não** são SLAs) e o motivo de a execução ser
manual — e não no CI — estão em
[`docs/performance-testing.md`](docs/performance-testing.md).

## Cobertura

| Rota         | Cenários cobertos                                                        |
| ------------ | ------------------------------------------------------------------------ |
| `/login`     | sucesso, senha incorreta, email inexistente, payload inválido            |
| `/usuarios`  | listagem, filtros (`_id`, `nome`, `email`, `password`, `administrador`, combinados), consulta, criação, atualização, exclusão e validações |
| `/produtos`  | listagem, filtros (`_id`, `nome`, `preco`, `descricao`, `quantidade` e combinados), consulta, criação, atualização, exclusão, token e permissões, validações |
| `/carrinhos` | listagem, filtros (`_id`, `idUsuario`, `precoTotal`, `quantidadeTotal` e combinados), criação, regras de negócio, concluir e cancelar compra |

Os testes validam **status HTTP, corpo e mensagens** de sucesso e de erro, além
de conferir a persistência das mudanças com consultas de verificação. As
validações de contrato ficam centralizadas em `tests/helpers/contrato.ts` e,
a partir da ETAPA 13, a **forma** da resposta é verificada contra o registro de
contratos (`contracts/`) em `tests/helpers/contratos.ts`.

O rastreio completo (requisito → cenário → arquivo → resultado) e a análise de
lacunas por risco estão em [`docs/traceability-matrix.md`](docs/traceability-matrix.md)
e [`docs/coverage-analysis.md`](docs/coverage-analysis.md).

## Dados e isolamento

- Cada teste cria seus próprios dados com identificadores únicos gerados por
  `crypto` (`email`/`nome`/`id` dinâmicos) e remove o que criou
  (`afterEach`/`afterAll` ou blocos `finally`).
- `montarDadosUsuario` e `montarDadosProduto` centralizam os payloads padrão;
  valores fixos só permanecem quando a asserção depende deles.
- A suíte não altera nem depende de dados de terceiros: só apaga registros
  criados por ela e registrados em memória por ID, usando prefixos como
  `usuario-test`, `login-test`, `admin-cleanup` e `Produto Playwright QA` para
  legibilidade.
- Os recursos criados são **registrados imediatamente** na criação (antes de
  qualquer operação posterior), para que uma falha no meio do teste não deixe
  registros órfãos.
- Por causa da regra de "1 carrinho por usuário", os blocos que criam carrinhos
  são executados em modo `serial`; contas são rastreadas em duas listas
  (`contasDoTeste`, limpa a cada teste, e `contasCriadas`, usada no
  `afterAll`), evitando exclusões redundantes em O(n²).
- A limpeza (`tests/helpers/limpeza.ts`) faz **no máximo 1 tentativa extra, e
  apenas quando o primeiro retorno é HTTP 429 ou erro de rede**. Outras falhas
  geram aviso no console e anotação `cleanup` no relatório, mas nunca mascaram a
  falha real do teste.
- Se o login de uma conta recém-criada falhar, `criarUsuarioAutenticado` remove a
  conta antes de propagar o erro.
- **Não existe limpeza global** da API: nenhum teste apaga dados que não
  criou.

## Paralelismo e limitações do ambiente

- A API ServeRest é pública e compartilhada e limita a **taxa de requisições por
  IP**. Medido nesta suíte:
  - `--workers=2` (~20 req/s): o `GET /usuarios` do próprio *health check*
    (apenas leitura) já retorna **HTTP 429** — é limite de taxa, não contenção
    de dados.
  - `--workers=1` (~10 req/s): suíte inteira **384 passed / 0 failed**.
- Por isso o padrão é `workers: 1` (local e CI). `npm run test:paralelo`
  mantém o modo rápido disponível para quando o ambiente permitir.
- Se uma execução receber **429**, trate como **condição do ambiente**: limpe os
  resíduos, aguarde a janela de rate limit e execute novamente. Asserções como
  `Expected: 201 / Received: 429` **não** indicam defeito do teste.
- A avaliação de latência (`npm run test:latencia`) também usa `workers: 1` e
  requisições sequenciais: 20 leituras por execução, sem criar dados.

## Relatórios

A configuração atual (`playwright.config.ts`) gera três saídas:

| Reporter | Saída | Uso |
| -------- | ----- | --- |
| `list`   | terminal | progresso e resultado de cada teste |
| `html`   | `playwright-report/index.html` | navegação visual por teste, duração, tentativas e anexos |
| `json`   | `test-results/results.json` | resumo estruturado (total, aprovados, falhos, ignorados, instáveis e duração) |

O HTML não abre automaticamente (`open: 'never'`), para não interferir em
execuções locais e no CI. Para abrir manualmente:

```bash
npm run report          # equivale a npx playwright show-report
```

Os diretórios `playwright-report/`, `test-results/`, `performance-results/` e
`reports/` são gerados automaticamente e estão no `.gitignore` (não são
versionados). O JSON de execução contém entre outros campos `stats` com o
resumo da execução e a lista de `suites` com o status de cada teste.

A suíte de latência usa config próprio (`playwright.latencia.config.ts`) com
reporter `list`: ela **não** sobrescreve o relatório HTML nem o JSON da
regressão funcional, e grava as métricas em `performance-results/*.json`.

## Evidências de falha

Cada teste usa o `test` estendido de `tests/fixtures.ts`. A fixture
`request` é instrumentada e registra, para **cada requisição**:

- método HTTP;
- endpoint (sem corpo e sem cabeçalhos);
- status recebido;
- duração em milissegundos;
- uma dica de diagnóstico derivada do status (401 autenticação,
  403 autorização, 429 limite de requisições, 5xx servidor, sem resposta
  → rede/timeout).

Esse histórico é anexado ao teste **somente quando ele falha**, com o nome
`requisicoes-api`. Em execuções aprovadas nada é anexado, evitando poluição.
O erro, a mensagem e o stack trace da falha são reportados nativamente pelo
Playwright. Não há captura de screenshots (a suíte é somente de API).

### Sanitização

A função `sanitizar` (`tests/helpers/diagnostico.ts`) mascara, inclusive em
objetos aninhados, chaves sensíveis como `authorization`, `password`, `token`,
`secret` e `cookie`, além de valores no formato `Bearer ...` e JWTs, trocando-os
por `[REDACTED]`.

Por padrão **não** são registrados corpos de requisição/resposta nem cabeçalhos
`Authorization` — apenas método, endpoint, status e duração —, de modo que
tokens e senhas não aparecem nas evidências. A sanitização atua apenas na
camada de logging; a resposta original usada pelas asserções não é alterada.

O sanitizador é coberto por testes unitários em
`tests/helpers/diagnostico.sanitizer.spec.ts` (executáveis sem rede):
verificam chaves em objetos/aninhados/arrays, tokens Bearer e JWTs em texto,
mensagens de `Error`, ausência de mutação do objeto original e a sanitização do
histórico de requisições — sem imprimir os valores sensíveis no terminal.

## Como analisar um teste que falhou

1. Abra o relatório HTML (`npm run report`) ou consulte `test-results/results.json`.
2. Localize o teste pelo nome/arquivo e veja mensagem e stack trace.
3. Abra o anexo `requisicoes-api` para ver a sequência de chamadas que levou à falha.
4. Compare o status e a dica de diagnóstico:
   - `401`/`403`: token ausente/inválido, expirado ou usuário sem permissão.
   - `400`: payload/regra de negócio diferente do esperado pela asserção.
   - `429`: limite de requisições do ambiente público compartilhado.
   - `5xx`: possível indisponibilidade da API (confirme antes de culpar a infraestrutura).
   - status `0`: erro de rede/timeout (nenhuma resposta recebida).
5. Verifique se o problema está no teste, na API ou no ambiente antes de corrigir.

## Retries

- Localmente não há retry (`retries: 0`).
- No CI há no máximo `2` tentativas (`retries: 2`).
- Um teste que passa apenas após retry é marcado como **flaky** no relatório;
  isso **não** é evidência de estabilidade e deve ser investigado.

## CI (GitHub Actions)

O workflow `.github/workflows/playwright.yml` roda a cada `push` e
`pull_request` na branch `Estudos` (e também via `workflow_dispatch`):

1. faz checkout com histórico completo (`fetch-depth: 0`), usa a versão de Node
   de `.nvmrc` e instala dependências com `npm ci` (cache do npm); aplica
   `SERVE_REST_BASE_URL` e `API_TIMEOUT_MS` a partir de `vars`, com fallback;
2. roda `npm run typecheck`;
3. roda `npm run test:contratos` (78 testes locais do motor e do registro —
   **sem rede**, falha rápido se um contrato for quebrado);
4. calcula o diff de commits e executa o seletor de impacto:
   - `push`: `github.event.before` → `github.sha`;
   - `pull_request`: `merge-base` entre a base e o head → head;
   - `workflow_dispatch`: completa por padrão (`execucao=completa`); `auto`
     exige uma base informada.
5. falha de base, diff ou seletor cai em regressão completa com aviso — nunca
   em execução vazia;
6. modo `direcionada` executa apenas os specs afetados (e a suíte de latência
   quando aplicável);
7. modo `completa` executa `npm run test:smoke`, `npm run test:criticos` e
   `npx playwright test`;
8. publica os artefatos (`playwright-report/`, `test-results/results.json`,
   `reports/impacto/selecao.json` e `changed-files.txt`) com `if: always()`,
   mesmo quando os testes falham, e registra o resumo no *step summary*.

O passo de seleção tem `continue-on-error: true` e fallback conservador: se o
cálculo do diff ou o seletor falhar, ele registra o modo `completa` com um aviso
(inclusive por saída emergencial em bash, se o próprio Node falhar) e os passos
de regressão completa rodam pelo `outcome == 'failure'`. O job usa apenas
`permissions: contents: read`, não faz commits/push e
não publica relatórios publicamente (apenas como artefato da execução). Não há
instalação de navegadores, pois a suíte é 100% API.

Para baixar os relatórios no GitHub: na execução do workflow, seção
**Artifacts** → `playwright-report` (contém o HTML, o `results.json`, o JSON da
seleção e a lista de arquivos alterados).

A análise detalhada, os critérios e as limitações estão em
[`docs/change-impact-analysis.md`](docs/change-impact-analysis.md).

### Por que a avaliação de latência não faz parte da regressão padrão

A suíte de desempenho é **executada sob demanda** (`npm run test:latencia`) ou
quando o diff altera `tests/performance/**`. Ela não entra na regressão
funcional padrão porque: (a) a API é pública e compartilhada, então o número
medido depende da carga de terceiros e não é comparável entre execuções;
(b) somar as 21 leituras ao pipeline aumenta o risco de **429** na regressão
funcional; e (c) não existe SLA, logo o resultado não tem valor de gate. O
detalhamento está em [`docs/performance-testing.md`](docs/performance-testing.md).

## Observações

- A API é pública e compartilhada: uma taxa de requisições alta retorna
  **HTTP 429**. Por isso a configuração usa `workers: 1`; o modo paralelo
  (`npm run test:paralelo`) é opt-in e pode falhar por limite de ambiente.
- No CI, as chamadas de API são espaçadas em 300 ms por
  `API_REQUEST_INTERVAL_MS`; a suíte de latência sobrescreve o valor para `0`
  para não contaminar as medições.
- Nenhum token, senha real ou segredo é versionado; as credenciais usadas nos
  testes são fictícias e geradas em tempo de execução.
- Os relatórios são gerados apenas durante a execução e nunca versionados.
- A avaliação de latência é diagnóstica: ela **não** reprova a execução por
  causa de uma amostra lenta e **não** representa um SLA.
