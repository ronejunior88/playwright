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

| Script             | Descrição                                  |
| ------------------ | ------------------------------------------ |
| `npm test`         | Executa todos os testes.                    |
| `npm run test:api` | Alias de `npm test` (a suíte inteira é API).|
| `npm run typecheck`| Verifica os tipos com TypeScript.           |
| `npm run report`   | Abre o relatório HTML.                      |

## Estrutura

```
tests/
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
- A suíte não altera nem depende de dados de terceiros.
- Por causa da regra de "1 carrinho por usuário", os blocos que criam carrinhos
  são executados em modo `serial`.

## CI (GitHub Actions)

O workflow `.github/workflows/playwright.yml` roda a cada `push` e
`pull_request` na branch `Estudos` (e também via `workflow_dispatch`):

1. instala dependências com `npm ci`;
2. roda `npm run typecheck`;
3. roda a suíte com `npx playwright test`;
4. publica o relatório HTML como artefato (`playwright-report`), mesmo em falha.

## Observações

- A API é pública e compartilhada: paralelismo alto pode retornar **HTTP 429**.
  Por isso a configuração limita o paralelismo (`workers: 2` localmente e
  `1` no CI).
- Nenhum token, senha real ou segredo é versionado; as credenciais usadas nos
  testes são fictícias e geradas em tempo de execução.
