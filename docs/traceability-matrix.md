# Matriz de Rastreabilidade de Cobertura — Suíte API ServeRest

Documento da **ETAPA 9**. Relaciona cada requisito da documentação pública da API
ServeRest ao cenário automatizado que o verifica.

## 1. Base e método

| Item | Valor |
| --- | --- |
| API sob teste | `https://serverest.dev` |
| Documentação de referência | `serverest@2.22.1` (`https://unpkg.com/serverest@2.22.1/docs/serverest.dev.html`) e `https://serverest.dev` |
| Pontos da API inventariados | 16 (16 combinações `método + rota`) |
| Respostas HTTP documentadas mapeadas | 45 (somando as listas `Responses` dos 16 pontos) |
| Requisitos rastreados nesta matriz | 99 |
| Testes da suíte | 265 em 22 arquivos `*.spec.ts` |
| Última execução completa | 2026-10-22 — `npm test` — **265/265 aprovados**, 0 falhas, 0 ignorados, 0 instáveis, ~138 s |
| Evidência | `playwright-report/index.html` (reporter HTML) e `npx playwright test --list` → `Total: 265 tests in 22 files` |

> A partir da ETAPA 11 a suíte passou a incluir 32 testes adicionais
> (sanitizador, exposição de dados/erros, validações de entrada e cenários de
> autenticação/autorização); a matriz de requisitos da API (99) permanece a
> mesma e os novos cenários estão documentados em
> `docs/security-testing.md`.
>
> A ETAPA 12 acrescentou 8 testes unitários do cálculo estatístico de
> latência (`tests/helpers/latencia.spec.ts`). A suíte de avaliação de
> desempenho (4 testes, 20 amostras) roda **fora** da regressão funcional, em
> config próprio, e está documentada em `docs/performance-testing.md`; por isso
> ela não altera a matriz de requisitos da API.
>
> A ETAPA 13 acrescentou 81 testes de **contrato** (35 do motor de schemas, 21
> de consistência do registro e 25 de integração com a API). Eles não criam
> requisitos novos: verificam a **forma** das respostas já mapeadas acima e
> estão documentados em `docs/api-contracts.md`.

Método: leitura direta da documentação (HTML da versão publicada), inventário de
endpoints e respostas, comparação com os títulos reais dos testes da suíte e
comprovação por execução. Nenhuma porcentagem foi estimada sem execução.

## 2. Legenda de status da cobertura

| Status | Significado |
| --- | --- |
| Coberto e aprovado | Requisito executado na última execução e todas as asserções passaram |
| Coberto, com falha | Cenário existe e foi executado, mas pelo menos uma asserção falhou |
| Parcialmente coberto | Cenário existe, mas não cobre todas as variações do requisito |
| Não coberto | Requisito documentado sem cenário automatizado |
| Fora do escopo | Requisito conhecido que a suíte decidiu não cobrir (limitação declarada) |

Cobertura **implícita**: comportamento verificado indiretamente por todos os
testes do recurso (ex.: rotas de usuários não enviando `Authorization` — qualquer
401 automático reprovaria os testes de sucesso correspondentes).

## 3. Inventário de pontos da API

| # | Método | Rota | Requer token | Requer administrador | Respostas documentadas | Testes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/login` | Não | Não | 200, 401 | 8 |
| 2 | GET | `/usuarios` | Não | Não | 200 | 8 |
| 3 | GET | `/usuarios/{id}` | Não | Não | 200, 400 | 3 |
| 4 | POST | `/usuarios` | Não | Não | 201, 400 | 12 |
| 5 | PUT | `/usuarios/{id}` | Não | Não | 200, 201, 400 | 9 |
| 6 | DELETE | `/usuarios/{id}` | Não | Não | 200, 200, 400 | 3 |
| 7 | GET | `/produtos` | Não | Não | 200 | 7 |
| 8 | GET | `/produtos/{id}` | Não | Não | 200, 400 | 3 |
| 9 | POST | `/produtos` | Sim | Sim | 201, 400, 401, 403 | 21 |
| 10 | PUT | `/produtos/{id}` | Sim | Sim | 200, 201, 400, 401, 403 | 19 |
| 11 | DELETE | `/produtos/{id}` | Sim | Sim | 200, 200, 400, 401, 403 | 6 |
| 12 | GET | `/carrinhos` | Não | Não | 200 | 8 |
| 13 | GET | `/carrinhos/{id}` | Não | Não | 200, 400 | 3 |
| 14 | POST | `/carrinhos` | Sim | Não | 201, 400, 400, 400, 400, 401 | 19 |
| 15 | DELETE | `/carrinhos/concluir-compra` | Sim | Não | 200, 200, 401 | 5 |
| 16 | DELETE | `/carrinhos/cancelar-compra` | Sim | Não | 200, 200, 401 | 5 |
| — | — | Verificação de disponibilidade (`GET /usuarios` como liveness) | — | — | — | 1 |
| — | — | Fluxos de integridade de ponta a ponta (criar/consultar/concluir/cancelar) | — | — | — | 4 |

Total: **16 pontos**, **45 respostas documentadas**, **144 testes**
(139 vinculados a um ponto da API + 1 de disponibilidade + 4 de integridade;
a distribuição por recurso é 8 do `/login`, 1 de disponibilidade, 35 de
usuários, 56 de produtos e 44 de carrinhos).

Observações de contagem:

- Os 3 testes de `Authorization` malformado (AUTH-010) são os mesmos 3 testes do
  item 9 (`POST /produtos`), referenciados por dois requisitos — não são
  contados duas vezes.
- Item 14 inclui o teste "deve reduzir o estoque ao criar o carrinho consultado"
  (`carrinhos-get.spec.ts`), cuja assersão é sobre o efeito do `POST`.

## 4. Matriz de rastreabilidade

Colunas: identificador, recurso, endpoint, método, regra/contrato esperado,
cenário de teste, arquivo, resultado da última execução, status da cobertura e
pendências/limitações.

### 4.1 Autenticação — POST /login

| ID | Recurso | Endpoint | Método | Regra ou contrato esperado | Cenário de teste | Arquivo | Resultado (2026-10-20) | Status | Pendências/limitações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 | Login | `/login` | POST | Credenciais válidas retornam 200, `message`, `authorization` Bearer em JWT de 3 segmentos | deve realizar login com sucesso e retornar um token Bearer | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| AUTH-002 | Login | `/login` | POST | Senha incorreta retorna 401 | deve rejeitar login com senha incorreta | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| AUTH-003 | Login | `/login` | POST | E-mail inexistente retorna 401 | deve rejeitar login com email inexistente | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| AUTH-004 | Login | `/login` | POST | Payload vazio retorna 400 com erro por campo | deve retornar erro ao enviar payload vazio | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | 400 não consta na doc (ver §5) |
| AUTH-005 | Login | `/login` | POST | `email` ausente retorna 400 | deve retornar erro ao enviar login sem email | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | 400 não consta na doc (ver §5) |
| AUTH-006 | Login | `/login` | POST | `password` ausente retorna 400 | deve retornar erro ao enviar login sem password | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | 400 não consta na doc (ver §5) |
| AUTH-007 | Login | `/login` | POST | E-mail com formato inválido retorna 400 | deve retornar erro ao enviar email com formato inválido | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | 400 não consta na doc (ver §5) |
| AUTH-008 | Login | `/login` | POST | E-mail e senha vazios retornam 400 | deve retornar erro ao enviar email e senha vazios | `tests/auth/login.spec.ts` | 1/1 aprovado | Coberto e aprovado | 400 não consta na doc (ver §5) |
| AUTH-009 | Autenticação | rotas protegidas | qualquer | Token expira em 600 s e deve retornar 401 após validade | — | — | 0/1 não executado | Fora do escopo | Exigiria espera ≥ 10 min ou servidor local próprio; custo/tempo de execução |
| AUTH-010 | Autenticação | `/produtos` | POST | Header `Authorization` malformado (sem prefixo, só `Bearer`, vazio) retorna 401 com a mensagem de token inválido | deve rejeitar a criação com Authorization malformado (apenas "Bearer"); deve rejeitar a criação com Authorization malformado (valor vazio); deve rejeitar a criação com Authorization malformado (token sem prefixo "Bearer") | `tests/produtos/produtos-create.spec.ts` | 3/3 aprovados | Coberto e aprovado | Doc só descreve "token inválido" genérico (ver §5) |

### 4.2 Disponibilidade

| ID | Recurso | Endpoint | Método | Regra ou contrato esperado | Cenário de teste | Arquivo | Resultado (2026-10-20) | Status | Pendências/limitações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HEALTH-001 | Disponibilidade | `/usuarios` | GET | API responde 200 com JSON de lista em estrutura válida (uso como liveness da suíte) | deve retornar a lista de usuários com estrutura válida | `tests/health.spec.ts` | 1/1 aprovado | Coberto e aprovado | Não é endpoint de health documentado; rota é a lista de usuários |

### 4.3 Usuários — /usuarios

| ID | Recurso | Endpoint | Método | Regra ou contrato esperado | Cenário de teste | Arquivo | Resultado (2026-10-20) | Status | Pendências/limitações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| USER-001 | Usuários | `/usuarios` | GET | 200 com `quantidade` (number) e `usuarios` (array de objetos com `nome`, `email`, `password`, `administrador`); `quantidade` igual ao total de itens | deve listar usuários com estrutura válida | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-002 | Usuários | `/usuarios` | GET | Filtro `_id` retorna somente o usuário correspondente | deve retornar somente o usuário esperado ao filtrar por id | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-003 | Usuários | `/usuarios` | GET | Filtro `nome` retorna somente usuários com o nome informado | deve filtrar usuários por nome | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-004 | Usuários | `/usuarios` | GET | Filtro `email` retorna somente usuários com o e-mail informado | deve filtrar usuários por email | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-005 | Usuários | `/usuarios` | GET | Filtro `administrador` retorna somente ocorrências com o valor informado | deve filtrar usuários por administrador | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-006 | Usuários | `/usuarios` | GET | Filtro `password` (chave documentada) filtra por senha e devolve lista vazia quando não há correspondência | deve filtrar usuários por password | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Teste adicionado na ETAPA 9 |
| USER-007 | Usuários | `/usuarios` | GET | Combinação de filtros conforme exemplo da documentação (`nome` + `administrador`) | deve filtrar usuários por nome e administrador combinados | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Teste adicionado na ETAPA 9 |
| USER-008 | Usuários | `/usuarios` | GET | Chave de query fora da lista de chaves permitidas retorna 400 com a mensagem `<chave> não é permitido` e sem `usuarios`/`quantidade` | deve rejeitar filtro de query com chave não permitida | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Comportamento não descrito na doc (ver §5); teste adicionado na ETAPA 9 |
| USER-009 | Usuários | `/usuarios/{id}` | GET | 200 com todos os campos do usuário | deve consultar um usuário por id válido | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Ambiente devolve `_id`, ausente na doc (ver §5) |
| USER-010 | Usuários | `/usuarios/{id}` | GET | Id inexistente retorna 400 | deve retornar erro ao consultar usuário inexistente | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-011 | Usuários | `/usuarios/{id}` | GET | Id com formato inválido retorna 400 | deve retornar erro ao consultar usuário com id de formato inválido | `tests/usuarios/usuarios-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-012 | Usuários | `/usuarios` | POST | 201 com `message` e `_id`; dados persistidos em consulta posterior | deve criar um usuário com sucesso e persistir os dados | `tests/usuarios/usuarios-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | Contrato reforçado na ETAPA 9 (`validarUsuario`) |
| USER-013 | Usuários | `/usuarios` | POST | E-mail já cadastrado retorna 400 | deve rejeitar a criação com email duplicado | `tests/usuarios/usuarios-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-014 | Usuários | `/usuarios` | POST | Payloads inválidos retornam 400 com erro por campo: sem `nome`, sem `email`, sem `password`, sem `administrador`, payload vazio, e-mail inválido, `nome`/`email`/`password` vazios e `administrador` com tipo incorreto (10 casos) | deve retornar erro ao criar usuário sem nome; deve retornar erro ao criar usuário sem email; deve retornar erro ao criar usuário sem password; deve retornar erro ao criar usuário sem administrador; deve retornar erro ao enviar payload vazio; deve retornar erro ao criar usuário com email inválido; deve retornar erro ao criar usuário com nome vazio; deve retornar erro ao criar usuário com email vazio; deve retornar erro ao criar usuário com password vazio; deve retornar erro ao criar usuário com administrador de tipo incorreto | `tests/usuarios/usuarios-create.spec.ts` | 10/10 aprovados | Coberto e aprovado | — |
| USER-015 | Usuários | `/usuarios/{id}` | PUT | 200 com `message`; alterações persistidas em consulta posterior | deve atualizar um usuário existente e persistir as alterações | `tests/usuarios/usuarios-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | Contrato reforçado na ETAPA 9 (`validarUsuario`) |
| USER-016 | Usuários | `/usuarios/{id}` | PUT | E-mail de outro usuário retorna 400 | deve rejeitar atualização utilizando email de outro usuário | `tests/usuarios/usuarios-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-017 | Usuários | `/usuarios/{id}` | PUT | Id inexistente retorna 201 e cria novo cadastro | deve criar um novo usuário ao atualizar com id inexistente | `tests/usuarios/usuarios-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-018 | Usuários | `/usuarios/{id}` | PUT | Payloads inválidos retornam 400: sem `nome`, sem `email`, sem `password`, sem `administrador`, payload vazio e dados com tipos incompatíveis (6 casos) | deve retornar erro ao atualizar sem nome; deve retornar erro ao atualizar sem email; deve retornar erro ao atualizar sem password; deve retornar erro ao atualizar sem administrador; deve retornar erro ao atualizar com payload vazio; deve retornar erro ao atualizar com dados de tipos incompatíveis | `tests/usuarios/usuarios-update.spec.ts` | 6/6 aprovados | Coberto e aprovado | — |
| USER-019 | Usuários | `/usuarios/{id}` | DELETE | 200 com `message`; registro deixa de existir em consulta posterior | deve excluir um usuário existente e remover o registro | `tests/usuarios/usuarios-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-020 | Usuários | `/usuarios/{id}` | DELETE | Id inexistente retorna 200 "Nenhum registro excluído" sem alterar dados | deve retornar sucesso sem excluir registros ao excluir usuário inexistente | `tests/usuarios/usuarios-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-021 | Usuários | `/usuarios/{id}` | DELETE | Exclusão de usuário com carrinho ativo retorna 400 e informa `idCarrinho` | deve rejeitar a exclusão de usuário com carrinho cadastrado | `tests/usuarios/usuarios-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| USER-022 | Usuários | `/usuarios` | GET/POST/PUT/DELETE | Rotas de usuários não exigem `Authorization` (doc: nenhuma rota de usuário está na tabela de autenticação) | Cobertura implícita: nenhum teste de usuários envia `Authorization` e os casos de sucesso retornam 200/201 | `tests/usuarios/*.spec.ts` | 35/35 aprovados | Coberto e aprovado | Cobertura implícita; não há teste negativo de "401 não ocorre" |

### 4.4 Produtos — /produtos

| ID | Recurso | Endpoint | Método | Regra ou contrato esperado | Cenário de teste | Arquivo | Resultado (2026-10-20) | Status | Pendências/limitações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-001 | Produtos | `/produtos` | GET | 200 com `quantidade` e `produtos` (cada item com `_id`, `nome`, `descricao`, `preco`, `quantidade`); `quantidade` igual ao total | deve listar produtos com estrutura válida | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-002 | Produtos | `/produtos` | GET | Filtro `_id` retorna somente o produto correspondente | deve retornar somente o produto esperado ao filtrar por id | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-003 | Produtos | `/produtos` | GET | Filtro `nome` retorna somente produtos com o nome informado | deve filtrar produtos por nome | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-004 | Produtos | `/produtos` | GET | Filtro `descricao` retorna somente produtos com a descrição informada | deve filtrar produtos por descricao | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-005 | Produtos | `/produtos` | GET | Filtros `preco` e `quantidade` combinados em uma mesma query retornam somente produtos que atendem **as duas** condições | deve filtrar produtos por preco e quantidade | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Cobertura do mecanismo AND de filtros; a doc ilustra com o par `nome` + `descricao` (mesma regra, outro par de chaves) |
| PROD-006 | Produtos | `/produtos` | GET | Filtro sem correspondência retorna lista vazia com `quantidade` 0 | deve retornar lista vazia ao filtrar por nome inexistente | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-007 | Produtos | `/produtos` | GET | Chave de query fora da lista de chaves permitidas retorna 400 com `<chave> não é permitido` | deve rejeitar filtro de query com chave não permitida | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Comportamento não descrito na doc (ver §5); teste adicionado na ETAPA 9 |
| PROD-008 | Produtos | `/produtos/{id}` | GET | 200 com os dados completos do produto | deve consultar um produto por id válido | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-009 | Produtos | `/produtos/{id}` | GET | Id inexistente retorna 400 | deve retornar erro ao consultar produto inexistente | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-010 | Produtos | `/produtos/{id}` | GET | Id com formato inválido retorna 400 | deve retornar erro ao consultar produto com id de formato inválido | `tests/produtos/produtos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-011 | Produtos | `/produtos` | POST | Administrador autenticado cria produto com 201, `message` e `_id`; dados persistidos | deve criar um produto com sucesso e persistir os dados | `tests/produtos/produtos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-012 | Produtos | `/produtos` | POST | Sem `Authorization` retorna 401 | deve rejeitar a criação sem token de autorização | `tests/produtos/produtos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-013 | Produtos | `/produtos` | POST | Token inválido retorna 401 | deve rejeitar a criação com token inválido | `tests/produtos/produtos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-014 | Produtos | `/produtos` | POST | `Authorization` malformado retorna 401 com a mensagem de token inválido (3 variantes) | deve rejeitar a criação com Authorization malformado (apenas "Bearer"); deve rejeitar a criação com Authorization malformado (valor vazio); deve rejeitar a criação com Authorization malformado (token sem prefixo "Bearer") | `tests/produtos/produtos-create.spec.ts` | 3/3 aprovados | Coberto e aprovado | Testes adicionados na ETAPA 9 |
| PROD-015 | Produtos | `/produtos` | POST | Usuário autenticado não administrador retorna 403 | deve rejeitar a criação com usuário comum (não administrador) | `tests/produtos/produtos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-016 | Produtos | `/produtos` | POST | Nome já cadastrado retorna 400 | deve rejeitar a criação com nome duplicado | `tests/produtos/produtos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-017 | Produtos | `/produtos` | POST | Payloads inválidos retornam 400 com erro por campo: payload vazio, `nome`/`preco`/`descricao`/`quantidade` ausentes, `nome`/`descricao` vazios, `preco` negativo/zero/não numérico, `quantidade` negativa/não numérica/decimal (13 casos) | deve retornar erro ao criar produto com payload vazio; deve retornar erro ao criar produto com nome ausente; deve retornar erro ao criar produto com preco ausente; deve retornar erro ao criar produto com descricao ausente; deve retornar erro ao criar produto com quantidade ausente; deve retornar erro ao criar produto com nome vazio; deve retornar erro ao criar produto com descricao vazia; deve retornar erro ao criar produto com preco negativo; deve retornar erro ao criar produto com preco zero; deve retornar erro ao criar produto com preco não numérico; deve retornar erro ao criar produto com quantidade negativa; deve retornar erro ao criar produto com quantidade não numérica; deve retornar erro ao criar produto com quantidade decimal | `tests/produtos/produtos-create.spec.ts` | 13/13 aprovados | Coberto e aprovado | — |
| PROD-018 | Produtos | `/produtos/{id}` | PUT | Administrador atualiza produto com 200; alterações persistidas | deve atualizar um produto existente e persistir as alterações | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-019 | Produtos | `/produtos/{id}` | PUT | Nome já cadastrado a outro produto retorna 400 | deve rejeitar atualização utilizando o nome de outro produto | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-020 | Produtos | `/produtos/{id}` | PUT | Sem `Authorization` retorna 401 | deve rejeitar a atualização sem token de autorização | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-021 | Produtos | `/produtos/{id}` | PUT | Token inválido retorna 401 | deve rejeitar a atualização com token inválido | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-022 | Produtos | `/produtos/{id}` | PUT | Usuário não administrador retorna 403 | deve rejeitar a atualização com usuário comum (não administrador) | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-023 | Produtos | `/produtos/{id}` | PUT | Id inexistente retorna 201 e cria novo produto | deve criar um novo produto ao atualizar com id inexistente | `tests/produtos/produtos-update.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-024 | Produtos | `/produtos/{id}` | PUT | Payloads inválidos retornam 400 (13 casos, mesma matriz do POST) | deve retornar erro ao atualizar produto com payload vazio; deve retornar erro ao atualizar produto com nome ausente; deve retornar erro ao atualizar produto com preco ausente; deve retornar erro ao atualizar produto com descricao ausente; deve retornar erro ao atualizar produto com quantidade ausente; deve retornar erro ao atualizar produto com nome vazio; deve retornar erro ao atualizar produto com descricao vazia; deve retornar erro ao atualizar produto com preco negativo; deve retornar erro ao atualizar produto com preco zero; deve retornar erro ao atualizar produto com preco não numérico; deve retornar erro ao atualizar produto com quantidade negativa; deve retornar erro ao atualizar produto com quantidade não numérica; deve retornar erro ao atualizar produto com quantidade decimal | `tests/produtos/produtos-update.spec.ts` | 13/13 aprovados | Coberto e aprovado | — |
| PROD-025 | Produtos | `/produtos/{id}` | DELETE | Administrador exclui produto com 200; registro some da listagem | deve excluir um produto existente e remover o registro | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-026 | Produtos | `/produtos/{id}` | DELETE | Id inexistente retorna 200 "Nenhum registro excluído" | deve retornar sucesso sem excluir registros ao excluir produto inexistente | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-027 | Produtos | `/produtos/{id}` | DELETE | Sem `Authorization` retorna 401 | deve rejeitar a exclusão sem token de autorização | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-028 | Produtos | `/produtos/{id}` | DELETE | Token inválido retorna 401 | deve rejeitar a exclusão com token inválido | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-029 | Produtos | `/produtos/{id}` | DELETE | Usuário não administrador retorna 403 | deve rejeitar a exclusão com usuário comum (não administrador) | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| PROD-030 | Produtos | `/produtos/{id}` | DELETE | Produto vinculado a carrinho retorna 400 com `idCarrinhos` | deve rejeitar a exclusão de produto vinculado a carrinho | `tests/produtos/produtos-delete.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |

### 4.5 Carrinhos — /carrinhos

| ID | Recurso | Endpoint | Método | Regra ou contrato esperado | Cenário de teste | Arquivo | Resultado (2026-10-20) | Status | Pendências/limitações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CART-001 | Carrinhos | `/carrinhos` | POST | Usuário autenticado cria carrinho com 201 e o estoque do produto cai exatamente pela quantidade comprada | deve criar um carrinho e reduzir o estoque exatamente pela quantidade | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-002 | Carrinhos | `/carrinhos` | POST | Sem `Authorization` retorna 401 | deve rejeitar a criação sem token de autorização | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-003 | Carrinhos | `/carrinhos` | POST | Token inválido retorna 401 | deve rejeitar a criação com token inválido | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-004 | Carrinhos | `/carrinhos` | POST | Segundo carrinho para o mesmo usuário retorna 400 | deve rejeitar a criação de um segundo carrinho para o mesmo usuário | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-005 | Carrinhos | `/carrinhos` | POST | Produto repetido no mesmo carrinho retorna 400 | deve rejeitar produto duplicado no mesmo carrinho | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-006 | Carrinhos | `/carrinhos` | POST | Produto inexistente retorna 400 | deve rejeitar produto inexistente | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-007 | Carrinhos | `/carrinhos` | POST | Quantidade acima do estoque retorna 400 | deve rejeitar quantidade superior ao estoque disponível | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-008 | Carrinhos | `/carrinhos` | POST | Payloads inválidos retornam 400 com erro por campo: corpo vazio, `produtos` ausente, lista de produtos vazia, item sem `idProduto`, item sem `quantidade`, `idProduto` com formato inválido, `quantidade` igual a zero/negativa/tipo inválido, item com estrutura inválida (10 casos) | deve retornar erro ao criar carrinho com corpo vazio; deve retornar erro ao criar carrinho com campo produtos ausente; deve retornar erro ao criar carrinho com lista de produtos vazia; deve retornar erro ao criar carrinho com item sem idProduto; deve retornar erro ao criar carrinho com item sem quantidade; deve retornar erro ao criar carrinho com idProduto com formato inválido; deve retornar erro ao criar carrinho com quantidade igual a zero; deve retornar erro ao criar carrinho com quantidade negativa; deve retornar erro ao criar carrinho com quantidade com tipo inválido; deve retornar erro ao criar carrinho com item com estrutura inválida | `tests/carrinhos/carrinhos-create.spec.ts` | 10/10 aprovados | Coberto e aprovado | Corpos de validação não detalhados na doc (ver §5) |
| CART-009 | Carrinhos | `/carrinhos` | POST | Resposta de sucesso contém `message` e `_id` do carrinho criado | deve retornar mensagem e _id no cadastro | `tests/carrinhos/carrinhos-create.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-010 | Carrinhos | `/carrinhos` | POST | Rota não exige administrador (doc: "Usuário tem que ser administrador? Não") | Cobertura implícita: todos os testes de criação de carrinho usam conta comum e obtêm sucesso nas respostas esperadas | `tests/carrinhos/carrinhos-create.spec.ts` | 18/18 aprovados | Coberto e aprovado | Cobertura implícita; não há teste negativo de "403 não ocorre" |
| CART-011 | Carrinhos | `/carrinhos` | GET | 200 com `quantidade` e `carrinhos` (cada item com `_id`, `idUsuario`, `produtos[].idProduto/quantidade/precoUnitario`, `precoTotal`, `quantidadeTotal`); `quantidade` igual ao total | deve listar carrinhos com estrutura válida | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-012 | Carrinhos | `/carrinhos` | GET | Filtro `_id` retorna somente o carrinho correspondente | deve filtrar carrinhos por _id | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-013 | Carrinhos | `/carrinhos` | GET | Filtro `idUsuario` retorna somente carrinhos do usuário | deve filtrar carrinhos por idUsuario | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-014 | Carrinhos | `/carrinhos` | GET | Filtro `precoTotal` retorna somente carrinhos com o total informado | deve filtrar carrinhos por precoTotal | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-015 | Carrinhos | `/carrinhos` | GET | Filtro `quantidadeTotal` retorna somente carrinhos com o total informado | deve filtrar carrinhos por quantidadeTotal | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-016 | Carrinhos | `/carrinhos` | GET | Combinação `precoTotal` + `quantidadeTotal` conforme exemplo da documentação | deve filtrar carrinhos por precoTotal e quantidadeTotal combinados | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Teste adicionado na ETAPA 9 |
| CART-017 | Carrinhos | `/carrinhos` | GET | Filtro sem correspondência retorna lista vazia com `quantidade` 0 | deve retornar lista vazia ao filtrar por _id inexistente | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-018 | Carrinhos | `/carrinhos` | GET | Chave de query fora da lista de chaves permitidas retorna 400 com `<chave> não é permitido` | deve rejeitar filtro de query com chave não permitida | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | Comportamento não descrito na doc (ver §5); teste adicionado na ETAPA 9 |
| CART-019 | Carrinhos | `/carrinhos/{id}` | GET | 200 com o carrinho completo e `precoTotal`/`quantidadeTotal` corretos | deve consultar um carrinho por id válido com cálculos corretos | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-020 | Carrinhos | `/carrinhos/{id}` | GET | Id inexistente retorna 400 | deve retornar erro ao consultar carrinho inexistente | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-021 | Carrinhos | `/carrinhos/{id}` | GET | Id com formato inválido retorna 400 | deve retornar erro ao consultar carrinho com id de formato inválido | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-022 | Carrinhos | `/carrinhos` | POST | O estoque fica reduzido e é visível na consulta do produto e do carrinho | deve reduzir o estoque ao criar o carrinho consultado | `tests/carrinhos/carrinhos-get.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-023 | Carrinhos | `/carrinhos/concluir-compra` | DELETE | Concluir a compra remove o carrinho e mantém o estoque reduzido | deve concluir a compra, remover o carrinho e manter o estoque reduzido | `tests/carrinhos/carrinhos-concluir.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-024 | Carrinhos | `/carrinhos/concluir-compra` | DELETE | Sem carrinho ativo retorna 200 com mensagem | deve retornar mensagem quando não existe carrinho para o usuário | `tests/carrinhos/carrinhos-concluir.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-025 | Carrinhos | `/carrinhos/concluir-compra` | DELETE | Sem `Authorization` retorna 401 | deve rejeitar a conclusão sem token de autorização | `tests/carrinhos/carrinhos-concluir.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-026 | Carrinhos | `/carrinhos/concluir-compra` | DELETE | Token inválido retorna 401 | deve rejeitar a conclusão com token inválido | `tests/carrinhos/carrinhos-concluir.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-027 | Carrinhos | `/carrinhos/concluir-compra` | DELETE | Segunda chamada não encontra mais carrinho | não deve concluir a mesma compra duas vezes | `tests/carrinhos/carrinhos-concluir.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-028 | Carrinhos | `/carrinhos/cancelar-compra` | DELETE | Cancelar remove o carrinho e devolve o estoque ao valor inicial | deve cancelar a compra, remover o carrinho e repor o estoque | `tests/carrinhos/carrinhos-cancelar.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-029 | Carrinhos | `/carrinhos/cancelar-compra` | DELETE | Sem carrinho ativo retorna 200 com mensagem | deve retornar mensagem quando não existe carrinho para o usuário | `tests/carrinhos/carrinhos-cancelar.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-030 | Carrinhos | `/carrinhos/cancelar-compra` | DELETE | Sem `Authorization` retorna 401 | deve rejeitar o cancelamento sem token de autorização | `tests/carrinhos/carrinhos-cancelar.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-031 | Carrinhos | `/carrinhos/cancelar-compra` | DELETE | Token inválido retorna 401 | deve rejeitar o cancelamento com token inválido | `tests/carrinhos/carrinhos-cancelar.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-032 | Carrinhos | `/carrinhos/cancelar-compra` | DELETE | Cancelar duas vezes não repõe o estoque duas vezes | não deve repor o estoque duas vezes ao cancelar novamente | `tests/carrinhos/carrinhos-cancelar.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-033 | Carrinhos | integridade | GET/POST/DELETE | Fluxo completo de compra concluída: criação reduz estoque, conclusão remove carrinho e mantém estoque, usuário e produto consistentes | deve executar o fluxo completo de compra concluída | `tests/carrinhos/carrinhos-integridade.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-034 | Carrinhos | integridade | GET/POST/DELETE | Fluxo completo de compra cancelada: criação reduz estoque, cancelamento remove carrinho e devolve estoque | deve executar o fluxo completo de compra cancelada | `tests/carrinhos/carrinhos-integridade.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-035 | Carrinhos | integridade | GET/POST | Carrinho nasce com o dono do token e operações de outros usuários ficam isoladas | deve associar o carrinho ao usuário do token e isolar operações | `tests/carrinhos/carrinhos-integridade.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |
| CART-036 | Carrinhos | integridade | GET/POST/DELETE | Com múltiplos produtos: quantidade, preço total e reposição individual por item ao cancelar | deve validar quantidade, preço e reposição individual com múltiplos produtos | `tests/carrinhos/carrinhos-integridade.spec.ts` | 1/1 aprovado | Coberto e aprovado | — |

## 5. Divergências entre documentação e comportamento observado

Comportamentos verificados por execução que não estão (ou estão incompletamente)
descritos na documentação da versão 2.22.1. Todos receberam cenário automatizado.

| # | Ponto da API | Documentação | Comportamento observado | Requisito |
| --- | --- | --- | --- | --- |
| 1 | GET `/usuarios/{id}` | Campos `nome`, `email`, `password`, `administrador` (sem `_id`) | Também retorna `_id` | USER-009 |
| 2 | POST `/login` | Somente 200 e 401 | Payload incompleto/inválido retorna **400** com erros por campo | AUTH-004 a AUTH-008 |
| 3 | GET `/usuarios`, `/produtos`, `/carrinhos` | Lista as chaves de query permitidas, sem descrever a rejeição | Chave fora da lista retorna **400** `{"<chave>": "<chave> não é permitido"}` | USER-008, PROD-007, CART-018 |
| 4 | POST `/carrinhos` | 400 apenas de regra de negócio (duplicado, 2º carrinho, produto inexistente, estoque) | Também retorna **400** de validação de payload com chaves `produtos` e `produtos[0].quantidade` | CART-008 |
| 5 | Rotas protegidas | 401 para "token inválido" | `Bearer` sem token, valor vazio e valor sem prefixo `Bearer` também retornam 401 com a mesma mensagem | AUTH-010, PROD-014 |

## 6. Resumo quantitativo

| Métrica | Valor |
| --- | --- |
| Pontos da API (método + rota) | 16 |
| Pontos com pelo menos 1 teste | 16 (100%) |
| Respostas HTTP documentadas | 45 |
| Respostas documentadas com cenário aprovado | 45 (100%) |
| Requisitos rastreados | 99 (10 de autenticação, 1 de disponibilidade, 22 de usuários, 30 de produtos, 36 de carrinhos) |
| Coberto e aprovado | 98 |
| Coberto, com falha | 0 |
| Parcialmente coberto | 0 |
| Não coberto | 0 |
| Fora do escopo | 1 (AUTH-009 — token expirado, com justificativa em `docs/coverage-analysis.md`) |
| Cobertura implícita declarada | 2 (USER-022, CART-010) |
| Requisitos de caminho positivo (2xx esperado) | 50 |
| Requisitos de rejeição/erro (4xx esperado) | 49 |
| Testes da suíte | 265 (265/265 aprovados em 2026-10-22; 184 na ETAPA 12; 176 na ETAPA 11; 144 na ETAPA 9) |
| Testes adicionados na ETAPA 9 | 9 (filtro `password`; filtros combinados em usuários e em carrinhos; 3 variações de `Authorization` malformado; 3 rejeições de chave de query não permitida) |
| Testes adicionados na ETAPA 11 | 32 (ver distribuição em `docs/security-testing.md`) |
| Testes adicionados na ETAPA 12 | 8 (testes unitários da estatística de latência, sem rede) |
| Testes adicionados na ETAPA 13 | 81 (35 do motor de schemas, 21 de consistência do registro, 25 de integração com a API) |

> Conferência: 50 + 49 = 99 requisitos; 98 + 1 = 99 (nenhum requisito sem status).

> Observação sobre "Não coberto": os 99 requisitos desta matriz correspondem ao
> que a documentação descreve ou ao que o comportamento observado exige registrar.
> O único requisito conhecido e não executado é AUTH-009 (token expirado),
> classificado como **Fora do escopo** com justificativa em
> `docs/coverage-analysis.md`.
