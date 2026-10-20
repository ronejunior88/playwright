# ServeRest API Tests

Projeto de estudos de automação de testes de API com **Playwright + TypeScript**
contra a API pública [ServeRest](https://serverest.dev).

## Pré-requisitos

- Node.js (LTS) e npm
- Acesso à internet (a API testada é pública e compartilhada)

## Instalação

```bash
npm ci
```

Não é necessário baixar navegadores: a suíte é **somente de API** (usa o
`APIRequestContext` do Playwright).

## Execução

```bash
npm test              # executa toda a suíte
npm run test:api      # alias para toda a suíte (100% API)
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
| `npm test`           | Executa todos os testes (1 worker).                          |
| `npm run test:api`   | Alias de `npm test` (a suíte inteira é API).                 |
| `npm run test:paralelo` | Executa com 2 workers (mais rápido, pode receber **429**). |
| `npm run typecheck`  | Verifica os tipos com TypeScript.                            |
| `npm run report`     | Abre o relatório HTML.                                       |

## Estrutura

```
tests/
  fixtures.ts                 # test/expect estendidos (evidência automática de API)
  health.spec.ts              # health check da API
  auth/login.spec.ts          # POST /login
  produtos/                   # GET/POST/PUT/DELETE /produtos
  usuarios/                   # GET/POST/PUT/DELETE /usuarios
  carrinhos/                  # GET/POST e conclusão/cancelamento de compra
  helpers/                    # utilitários reutilizados pelos testes
    autenticacao.ts
    usuarios.ts
    produtos.ts
    carrinhos.ts
    diagnostico.ts            # sanitização e classificação de status para evidências
    limpeza.ts                # exclusão com proteção contra 429 (1 tentativa extra)
```

## Cobertura

| Rota         | Cenários cobertos                                                        |
| ------------ | ------------------------------------------------------------------------ |
| `/login`     | sucesso, senha incorreta, email inexistente, payload inválido            |
| `/usuarios`  | listagem, filtros, consulta, criação, atualização, exclusão e validações |
| `/produtos`  | listagem, filtros, consulta, criação, atualização, exclusão e validações |
| `/carrinhos` | listagem, filtros, criação, regras de negócio, concluir e cancelar compra |

Os testes validam **status HTTP, corpo e mensagens** de sucesso e de erro, além
de conferir a persistência das mudanças com consultas de verificação.

## Dados e isolamento

- Cada teste cria seus próprios dados com identificadores únicos
  (`email`/`nome`/`id` dinâmicos) e remove o que criou (`afterEach`/`afterAll`
  ou blocos `finally`).
- A suíte não altera nem depende de dados de terceiros: só apaga registros
  criados por ela e detectáveis pelos prefixos (`usuario-test`,
  `login-test`, `admin-cleanup`, `Produto Playwright QA`, ...).
- Os recursos criados são **registrados imediatamente** na criação (antes de
  qualquer operação posterior), para que uma falha no meio do teste não deixe
  registros órfãos.
- Por causa da regra de "1 carrinho por usuário", os blocos que criam carrinhos
  são executados em modo `serial`; contas são rastreadas em duas listas
  (`contasDoTeste`, limpa a cada teste, e `contasCriadas`, usada no
  `afterAll`), evitando exclusões redundantes em O(n²).
- A limpeza (`tests/helpers/limpeza.ts`) faz **no máximo 1 tentativa extra, e
  apenas quando o primeiro retorno é HTTP 429 ou erro de rede**. Outras falhas
  geram apenas um aviso no console e nunca mascaram a falha real do teste.
- **Não existe limpeza global** da API: nenhum teste apaga dados que não
  criou.

## Paralelismo e limitações do ambiente

- A API ServeRest é pública e compartilhada e limita a **taxa de requisições por
  IP**. Medido nesta suíte:
  - `--workers=2` (~20 req/s): o `GET /usuarios` do próprio *health check*
    (apenas leitura) já retorna **HTTP 429** — é limite de taxa, não contenção
    de dados.
  - `--workers=1` (~10 req/s): suíte inteira **135 passed / 0 failed**.
- Por isso o padrão é `workers: 1` (local e CI). `npm run test:paralelo`
  mantém o modo rápido disponível para quando o ambiente permitir.
- Se uma execução receber **429**, trate como **condição do ambiente**: limpe os
  resíduos, aguarde a janela de rate limit e execute novamente. Asserções como
  `Expected: 201 / Received: 429` **não** indicam defeito do teste.

## Relatórios

A configuração gera três formatos simultaneamente (definidos em
`playwright.config.ts`):

| Reporter | Saída | Uso |
| -------- | ----- | --- |
| `list`   | terminal | acompanhamento em tempo real |
| `html`   | `playwright-report/index.html` | navegação visual por teste, duração, tentativas e anexos |
| `json`   | `test-results/results.json` | consumo estruturado (total, aprovados, falhos, ignorados, duração, arquivos e mensagens) |
| `github` | anotações no job | **somente no CI** (`process.env.CI`) |

O relatório HTML não abre automaticamente (`open: 'never'`). Para abri-lo:

```bash
npm run report          # equivale a npx playwright show-report
```

Os diretórios `playwright-report/` e `test-results/` são gerados
automaticamente e estão no `.gitignore` (não são versionados). O JSON conterá,
entre outros campos, `stats` com o resumo da execução e a lista de `suites`
com o status de cada teste.

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

1. instala dependências com `npm ci` (cache do npm);
2. roda `npm run typecheck`;
3. roda a suíte com `npx playwright test`;
4. publica os artefatos (`playwright-report/` e `test-results/results.json`)
   com `if: always()`, mesmo quando os testes falham.

O job mantém o status de falha real (sem `continue-on-error`), usa apenas
`permissions: contents: read`, não faz commits/push e não publica relatórios
publicamente (apenas como artefato da execução). Não há instalação de
navegadores, pois a suíte é 100% API.

Para baixar os relatórios no GitHub: na execução do workflow, seção
**Artifacts** → `playwright-report` (contém o HTML e o `results.json`).

## Observações

- A API é pública e compartilhada: uma taxa de requisições alta retorna
  **HTTP 429**. Por isso a configuração usa `workers: 1`; o modo paralelo
  (`npm run test:paralelo`) é opt-in e pode falhar por limite de ambiente.
- Nenhum token, senha real ou segredo é versionado; as credenciais usadas nos
  testes são fictícias e geradas em tempo de execução.
- Os relatórios são gerados apenas durante a execução e nunca versionados.
