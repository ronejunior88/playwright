# Testes de Segurança da API — Suíte Playwright/ServeRest

Documento da **ETAPA 11**. Descreve o escopo, os controles avaliados, os cenários
executados, a estratégia de sanitização de logs e os achados efetivamente
observados na API pública `https://serverest.dev`.

> Escopo: testes de **controles de segurança da aplicação** (autenticação,
> autorização, validação de entradas, exposição de dados e tratamento de erros).
> Não foram realizados testes de carga, brute force, fuzzing agressivo,
> exploração de infraestrutura ou operações destrutivas. Este documento **não**
> afirma conformidade com OWASP ou qualquer norma: a avaliação cobre apenas os
> cenários abaixo.
>
> **Nota ETAPA 19 (2026-10-28):** as contagens de 32 testes são históricas da
> ETAPA 11. Na suíte atual, os specs de segurança (`tests/seguranca/**`) somam
> 14 testes, o sanitizador/classificação soma 16 e o login soma 10; a execução
> validada está em [`integrated-quality-audit.md`](integrated-quality-audit.md).

## 1. Escopo

| Domínio | Avaliado? | Onde |
| --- | --- | --- |
| Autenticação (`POST /login`) | Sim | `tests/auth/login.spec.ts` |
| Autorização / controle administrativo | Sim | `tests/produtos/*`, `tests/carrinhos/*` |
| Validação de dados de entrada | Sim | `tests/seguranca/entrada-validacao.spec.ts` |
| Exposição de informações sensíveis | Sim | `tests/seguranca/exposicao-erros.spec.ts` |
| Tratamento de erros | Sim | `tests/seguranca/exposicao-erros.spec.ts` |
| Integridade e efeitos colaterais | Sim | `tests/carrinhos/carrinhos-integridade.spec.ts` |
| Segurança de logs e relatórios | Sim | `tests/helpers/diagnostico.sanitizer.spec.ts` |
| Infraestrutura / rede / TLS | Não | Fora do escopo (API pública compartilhada) |

## 2. Endpoints e controles avaliados

| Endpoint | Método | Controle | Requer token | Requer admin |
| --- | --- | --- | --- | --- | --- |
| `/login` | POST | Autenticação e validação de credenciais | Não | Não |
| `/usuarios` | POST/PUT/DELETE | Validação de entrada; rota **não** protegida | Não | Não |
| `/produtos` | POST/PUT/DELETE | Autorização: token + perfil administrador | Sim | Sim |
| `/produtos` | GET | Leitura pública | Não | Não |
| `/carrinhos` | POST | Autenticação; **não** exige admin | Sim | Não |
| `/carrinhos/concluir-compra` | DELETE | Autenticação | Sim | Não |
| `/carrinhos/cancelar-compra` | DELETE | Autenticação | Sim | Não |

## 3. Cenários de autenticação

Arquivo: `tests/auth/login.spec.ts` (10 cenários).

- Login com credenciais válidas → 200 com token Bearer (JWT de 3 segmentos).
- Senha incorreta → 401 `Email e/ou senha inválidos`, sem `authorization`.
- E-mail inexistente → 401 com a mesma mensagem (não revela se o e-mail existe).
- Payload vazio / `email` ausente / `password` ausente → 400 com erro por campo.
- `email` com formato inválido → 400.
- `email` e `password` vazios → 400 (campo `email não pode ficar em branco`).
- **Novo (ETAPA 11)**: `email` vazio com senha válida → 400 isolado.
- **Novo (ETAPA 11)**: campos com tipo incorreto (número em vez de texto) → 400
  com `email deve ser uma string` / `password deve ser uma string`.

Verificação de token em rotas protegidas (nos arquivos de produtos e carrinhos):

- Sem cabeçalho `Authorization` → 401 `Token de acesso ausente, inválido...`.
- Token inválido (`Bearer token-invalido`) → 401.
- `Authorization` malformado (sem prefixo `Bearer`, `Bearer` isolado, valor
  vazio, valor sem prefixo) → 401 com a mesma mensagem.

Nenhuma falha de autenticação é classificada como sucesso: todos os cenários
negativos verificam explicitamente a **ausência** de `authorization` e de `_id`.

## 4. Cenários de autorização e controle de acesso

- `POST /produtos`, `PUT /produtos/{id}`, `DELETE /produtos/{id}` com usuário
  **comum** autenticado → **403** `Rota exclusiva para administradores`
  (restrição aplicada no servidor, independentemente do cliente).
- Sem token → 401; token inválido → 401.
- `POST /carrinhos`, `concluir-compra`, `cancelar-compra` exigem apenas token,
  **não** administrador (confirmado por execução).
- **Novo (ETAPA 11)**: criação de carrinho por usuário **administrador** é
  permitida (comportamento simétrico — a rota não é exclusiva de admin).
- **Novo (ETAPA 11)**: `concluir-compra` com `Authorization` malformado (token
  sem prefixo `Bearer`) → 401 e o carrinho **permanece intacto**.

## 5. Validação de entradas

Arquivo: `tests/seguranca/entrada-validacao.spec.ts` + matrizes existentes em
`tests/helpers/*.ts`.

- Campos obrigatórios ausentes, campos vazios e tipos incorretos (já cobertos
  nas etapas anteriores por 57 casos de payload).
- **Novo (ETAPA 11)**: strings com aspas, barra invertida, marcação HTML/script,
  unicode/emoji e operadores de shell são **persistidas exatamente** como
  enviadas (nem escapadas nem executadas) — verificado por leitura posterior.
- **Novo (ETAPA 11)**: corpo JSON malformado → 400 (ou 401), **nunca 5xx**, sem
  `stack`/`SyntaxError` no corpo.
- **Novo (ETAPA 11)**: campos não documentados (`_id`, `administrador`,
  `authorization`, `token`) são **rejeitados** (schema estrito) em produtos e
  usuários — não há "mass assignment".
- **Novo (ETAPA 11)**: id de produto fora do formato (curto, 17 caracteres,
  apenas símbolos) nunca gera 5xx.
- **Novo (ETAPA 11)**: e-mail inválido (`sem-arroba`, `a@`, `@b.com`,
  `a b@c.com`) → 400 `email deve ser um email válido`.

## 6. Exposição de dados sensíveis e tratamento de erros

Arquivo: `tests/seguranca/exposicao-erros.spec.ts`.

- Senha retornada apenas como campo do **próprio** recurso consultado
  (`GET /usuarios/{id}`); nenhum `authorization`, `token`, `hash` ou `salt`
  adicional é devolvido.
- Mensagem de erro de login **não** ecoa a senha enviada.
- Recursos inexistentes (`/usuarios/{id}`, `/produtos/{id}`, `/carrinhos/{id}`)
  retornam 400 com `message` curta, **sem** stack trace ou termos internos
  (`stack`, `node_modules`, `MongoError`, `CastError`, etc.).
- Operação sem autenticação não expõe detalhes internos.
- `PUT /produtos/{id}` com id inexistente responde 201 sem vazamento; o id da
  URL não cria recurso (criação sob novo `_id`, `_id da URL` → 400).
- Produto consultado não carrega `authorization`/`token` embutidos.

## 7. Estratégia de sanitização de logs e relatórios

Componente: `tests/helpers/diagnostico.ts`; testes unitários em
`tests/helpers/diagnostico.sanitizer.spec.ts` (12 casos, **sem imprimir valores
sensíveis no terminal**).

- A fixture `tests/fixtures.ts` instrumenta `request` e registra apenas método,
  endpoint (sanitizado), status, duração e dica de diagnóstico — **sem corpos**
  de requisição/resposta e **sem cabeçalhos** de autenticação.
- `sanitizar` mascara, recursivamente (objetos, arrays, objetos aninhados),
  chaves sensíveis: `authorization`, `auth`, `password`, `senha`, `token`,
  `access_token`, `refresh_token`, `secret`, `apikey`/`api_key`, `cookie`,
  `set-cookie`, `x-access-token` — substituindo por `[REDACTED]`.
- `sanitizarTexto` mascara padrões `Bearer ...` e JWTs (`eyJ...`) em texto livre.
- Sem diferenciação de maiúsculas/minúsculas nas chaves.
- A sanitização atua **somente** na representação anexada ao relatório; os
  objetos originais usados pelas asserções **não** são modificados (testado).
- O anexo `requisicoes-api` só é gravado quando o teste falha.

## 8. Resultados observados e achados

Classificação por risco. "Confirmado" = reproduzido por execução; "limitação" =
restrição declarada; "observação" = comportamento notado sem impacto de risco.

| ID | Descrição | Severidade | Evidência | Impacto | Status | Ação |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | `GET /usuarios/{id}` e `GET /usuarios` devolvem o campo `password` em texto claro | Médio | `tests/seguranca/exposicao-erros.spec.ts`, `tests/usuarios/usuarios-get.spec.ts` | Exposição de credenciais de qualquer usuário a chamadas não autenticadas | **Confirmado** | Documentado; é característica da API de estudo. Não é possível corrigir no cliente. Recomendação: não usar senhas reais |
| SEC-02 | `POST /usuarios` e `PUT /usuarios/{id}` **não exigem autenticação** (rota administrativa de usuários é pública) | Médio | `tests/usuarios/*` (cobertura implícita); confirmado por execução | Qualquer cliente pode criar/alterar usuários se souber o `_id` | **Confirmado** | Documentado como limitação do contrato. Recomendação: proteger em produção |
| SEC-03 | Rejeição de campos não documentados é **inconsistente na forma**: ora lista por campo (`_id não é permitido`), ora mensagem genérica | Baixo | `tests/seguranca/entrada-validacao.spec.ts` (as duas formas foram observadas) | Dificuldade de integrar/parsear erros; sem impacto de segurança direto | **Confirmado** | Asserção cobre ambas as formas (invariante: 400 + nenhum registro) |
| SEC-04 | `PUT /produtos/{id}` com id inexistente **cria** um novo produto (semântica de upsert) | Baixo | `tests/produtos/produtos-update.spec.ts`, `tests/seguranca/exposicao-erros.spec.ts` | Comportamento não intuitivo; pode surpreender integrações | **Confirmado** | Documentado; comportamento do contrato |
| SEC-05 | Token expira em ~600 s (doc) — não testado por exigir espera ≥ 10 min | Informativo | `docs/traceability-matrix.md` (AUTH-009) | Janela de validade não verificada | **Limitação** | Fora do escopo (custo/tempo) |
| SEC-06 | Senhas de teste são fictícias e geradas em runtime; nenhum segredo real versionado | Informativo | `.gitignore` (`.env`), ausência de JWT real via `git grep` | Nenhum | **Confirmado** | Mantido |

> Observação: aceitar caracteres especiais em campos de texto **não** é, por si
> só, uma vulnerabilidade; o teste verifica que o valor é persistido literalmente
> (sem execução/escape), o que é o comportamento esperado para dados.

## 9. Limitações do ambiente público

- A API `serverest.dev` é pública e compartilhada: limita requisições por IP
  (**HTTP 429**). Todas as execuções usam `workers: 1`.
- Dados de terceiros existem na base; a suíte só cria/altera/exclui recursos
  próprios e identificáveis por prefixo.
- A **forma** de algumas respostas de erro de validação varia entre chamadas
  (SEC-03), provavelmente por balanceamento/versões; por isso as asserções
  verificam invariantes (status + ausência de registro) em vez de mensagens
  exatas quando o contrato não é estável.
- Não é possível avaliar TLS, cabeçalhos de segurança em profundidade,
  infraestrutura ou disponibilidade — fora do escopo de uma suíte de API.

## 10. Recomendações

1. Para cenários que dependem de dados sensíveis, usar **credenciais fictícias**
   (já é a prática da suíte) e nunca contas reais.
2. Em uma API própria, proteger as rotas de `/usuarios` e não retornar `password`
   nas respostas (SEC-01, SEC-02).
3. Padronizar o formato de erro de validação para facilitar o consumo por
   clientes (SEC-03).
4. Documentar explicitamente a semântica de upsert do `PUT` (SEC-04).
5. Manter a sanitização de logs ativa e coberta por testes unitários a cada
   alteração na fixture de diagnóstico.

## 12. Distribuição dos testes adicionados na ETAPA 11

| Local | Testes novos | Escopo |
| --- | --- | --- |
| `tests/helpers/diagnostico.sanitizer.spec.ts` | 12 | Sanitizador e classificação de status (offline) |
| `tests/seguranca/exposicao-erros.spec.ts` | 7 | Exposição de dados e tratamento de erros |
| `tests/seguranca/entrada-validacao.spec.ts` | 7 | Validação de entradas e campos não documentados |
| `tests/auth/login.spec.ts` | 2 | E-mail vazio e tipos incorretos |
| `tests/produtos/produtos-create.spec.ts` | 1 | Rejeição de campos não documentados |
| `tests/carrinhos/carrinhos-create.spec.ts` | 2 | Auth malformado e criação por administrador |
| `tests/carrinhos/carrinhos-concluir.spec.ts` | 1 | Auth malformado preserva o carrinho |
| **Total** | **32** | Suíte passou de 144 para 176 testes |

## 13. Como executar

```bash
npm run typecheck                                          # tipos
npx playwright test tests/helpers/diagnostico.sanitizer.spec.ts   # sanitizador
npx playwright test tests/auth                             # autenticação
npx playwright test tests/seguranca                        # segurança (novos)
npx playwright test                                        # suíte completa
```

Relatório HTML da execução (`npm run report`) e resumo estruturado sob demanda
(`npx playwright test --reporter=json`); anexos de falha sanitizados no
relatório HTML.
