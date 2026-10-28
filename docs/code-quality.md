# Qualidade de código da suíte de testes

Documento da **ETAPA 14** da evolução da suíte Playwright + TypeScript. Ele
registra o diagnóstico da duplicação e da tipagem, o que foi refatorado e o que
foi deliberadamente mantido como está.

> **Nota ETAPA 19 (2026-10-28):** as métricas desta página são a fotografia
> histórica da ETAPA 14 (265 testes funcionais, 272 na regressão, 56 contratos
> locais). A suíte atual tem **384 testes em 26 arquivos** e **78 contratos
> locais**; a validação mais recente está em
> [`integrated-quality-audit.md`](integrated-quality-audit.md).

O objetivo da etapa era **manutenibilidade sem mudança de comportamento**:
mesmos endpoints, mesmos payloads, mesmos status, mesmas assertions, mesmo
número de testes e mesmo isolamento. A validação final comparou a suíte antes e
depois da refatoração.

## 1. Diagnóstico

A auditoria percorreu `tests/`, `contracts/`, `playwright.config.ts`,
`tsconfig.json` e `package.json`. Os achados foram classificados por impacto
na manutenção.

| # | Achado | Evidência | Impacto | Correção |
|---|--------|-----------|---------|----------|
| D1 | `gerarSufixo()` duplicado | `helpers/usuarios.ts` e `helpers/produtos.ts` | Dois geradores de dado aleatório que podem divergir e quebrar a unicidade de e-mail/nome | Extraído para `helpers/aleatorio.ts` |
| D2 | Tipo de resposta duplicado | `MensagemResposta` (usuários e produtos) e `MensagemCarrinho` (carrinhos) com a mesma forma `{ message?, _id? }` | Três nomes para o mesmo contrato de corpo | Tipo único `MensagemResposta` em `helpers/resposta.ts` |
| D3 | Tipos de erro de validação duplicados | `ErroValidacao` (usuários) e `ErroValidacaoProduto` (produtos) | Divergência silenciosa ao adicionar um campo novo | Tipo único `ErroValidacao` em `helpers/resposta.ts` |
| D4 | `bearer()` morava em `helpers/produtos.ts` | Usado por carrinhos, segurança e contratos | Dependência ilógica: um módulo de produtos sendo importado só para formatar header | `bearer()` movido para `helpers/autenticacao.ts` |
| D5 | Ciclo de vida de carrinhos copiado em 5 specs | `contasCriadas`, `contasDoTeste`, `produtosCriados`, `beforeAll`/`beforeEach`/`afterEach`/`afterAll` idênticos | Correção de limpeza precisa ser replicada em 5 arquivos; um arquivo esquecido deixa recurso na API pública | Contexto único em `helpers/cenario-carrinhos.ts` |
| D6 | `interface ContaAutenticada` repetida | 5 specs de carrinhos | Tipo local duplicado do `UsuarioAutenticado` | `UsuarioAutenticado` exportado por `helpers/carrinhos.ts` |
| D7 | Tríade `status` + `content-type` + `json` repetida | 173 pontos de leitura de corpo na suíte | `content-type` era conferido em apenas parte das leituras; o resto lia o corpo sem verificar o tipo | `lerJson<T>()` em `helpers/resposta.ts` |
| D8 | Literais de mensagem repetidos | 24 ocorrências de 10 textos de sucesso/erro escritos à mão em specs | Mudança de texto na API exigia editar vários arquivos | Constantes exportadas pelos helpers |
| D9 | Tipos locais divergentes | `Usuario`/`ListaUsuarios` (health), `RespostaLogin` (login), `Administrador` (contratos) | O mesmo formato declarado com nomes diferentes | Reuso dos tipos dos helpers |
| D10 | Leitura de corpo sem helper | `(await response.json()) as X` em specs de segurança e contratos | Reinventava a checagem de status já feita em outro lugar | `lerJson<T>()` |

## 2. O que mudou

### 2.1 `tests/helpers/resposta.ts` (novo)

Concentra o formato de corpo da API e a leitura de respostas:

- `MensagemResposta` — `{ message?, _id? }`: mensagem de negócio, erro de
  autorização e identificador do registro criado.
- `ErroValidacao` — mapa `{ campo: mensagem }` devolvido nas validações de
  payload.
- `lerJson<T>(response, status, contexto?)` — confere o status HTTP, exige
  `content-type` JSON e devolve o corpo tipado. O parâmetro `contexto` entra
  na mensagem de falha para apontar *onde* a leitura falhou.
- Constantes de mensagem: `MENSAGEM_CADASTRO_SUCESSO`,
  `MENSAGEM_ALTERADO_SUCESSO`, `MENSAGEM_EXCLUIDO_SUCESSO`,
  `MENSAGEM_NENHUM_EXCLUIDO`, `MENSAGEM_ID_INVALIDO`.

### 2.2 `tests/helpers/aleatorio.ts` (novo)

`gerarSufixo()` — único gerador de sufixo aleatório, usado por e-mail e nome
de produto.

### 2.3 `tests/helpers/cenario-carrinhos.ts` (novo)

Contexto compartilhado pelos 5 specs de carrinho. A API pública permite apenas
**1 carrinho ativo por usuário**, então os specs rodam em modo serial e
precisam cancelar os carrinhos entre os testes. O contexto centraliza esse
ciclo de vida:

- `admin` / `tokenAdmin` — conta administrativa, criada uma vez por spec.
- `novaConta(request)` — cria uma conta e a registra para limpeza.
- `novoProduto(request, { preco, quantidade })` — cria um produto com o token do
  administrador.
- `iniciarTeste()` — marca o começo do teste: a partir daqui as contas são
  canceladas no `afterEach`.
- `cancelarContasDoTeste(request)` — cancela os carrinhos das contas do teste.
- `limpar(request)` — remove carrinhos, produtos e contas (inclusive quando o
  teste falha).

### 2.4 Helpers reorganizados

| Helper | Antes | Depois |
|--------|-------|--------|
| `autenticacao.ts` | só login | `bearer()`, `MENSAGEM_LOGIN_SUCESSO`, `MENSAGEM_CREDENCIAIS_INVALIDAS`, `MENSAGEM_TOKEN_INVALIDO`, `MENSAGEM_ROTA_ADMIN`; `RespostaLogin` compartilhado |
| `usuarios.ts` | `MensagemResposta`, `ErroValidacao`, `gerarSufixo` próprios | tipos e gerador vindos dos helpers compartilhados; `MENSAGEM_USUARIO_NAO_ENCONTRADO`, `MENSAGEM_EMAIL_EM_USO` |
| `produtos.ts` | `bearer`, `MensagemResposta`, `ErroValidacaoProduto`, `gerarSufixo` próprios | `bearer` vindo de `autenticacao`; `MENSAGEM_PRODUTO_NAO_ENCONTRADO`, `MENSAGEM_NOME_PRODUTO_EM_USO` |
| `carrinhos.ts` | `MensagemCarrinho`, mensagens de carrinho duplicadas | `UsuarioAutenticado` exportado; mensagens reusadas dos helpers compartilhados |

### 2.5 Specs

- Os 5 specs de carrinho passaram a usar `criarContextoCarrinhos()`; os
  `interface ContaAutenticada`, os arrays de contas/produtos, os blocos de
  `beforeAll`/`afterAll` copiados e os wrappers locais `novaConta`/`novoProduto`
  foram removidos.
- As 143 leituras de corpo já mapeadas na auditoria passaram a usar
  `lerJson<T>()` — e as leituras restantes, convertidas depois, totalizam 174
  chamadas (162 em specs funcionais, 8 em helpers, 4 no novo unitário). O
  efeito colateral útil: a conferência de `content-type` ficou uniforme (antes
  era parcial).
- Literais de mensagem foram trocados pelas constantes exportadas.
- Tipos locais (`Usuario`, `ListaUsuarios`, `RespostaLogin`, `Administrador`)
  foram removidos em favor dos tipos dos helpers; `criarAdministrador` local do
  spec de contratos passou a usar `criarUsuarioAutenticado(request, 'true')`.

### 2.6 `tests/helpers/resposta.spec.ts` (novo)

Teste unitário, sem rede, do helper mais usado da suíte: status inesperado,
`content-type` incorreto, corpo lido com sucesso e tipagem do retorno. São 7
testes, os únicos adicionados à regressão.

## 3. Decisões de escopo

### 3.1 `helpers/contrato.ts` e `contracts/` convivem

São camadas diferentes e ambas continuam ativas:

| | `contracts/` + `helpers/contratos.ts` | `helpers/contrato.ts` |
|---|---|---|
| Natureza | motor de contratos estrutural, sem dependência externa | assertions prontas por formato de corpo |
| Uso | `validarContrato('produtos.criacao', resposta)` compara com o contrato registrado | `validarProduto(produto)`, `validarErroDeCampos(erro)`, ... conferem campos |
| Mensagem de falha | lista as divergências (compatível/incompatível) | mensagem em português, com o campo esperado |

Unificá-los exigiria reescrever o motor ou as assertions; o ganho não
compensaria o risco de alterar a detecção de falhas. A relação fica
documentada aqui e no README.

**Divergência conhecida:** o contrato estrutural admite `_id` como nome de
campo no mapa de erro (`contracts/contratos.ts`), enquanto
`validarErroDeCampos` proíbe a chave `_id` no corpo de erro
(`helpers/contrato.ts`). Os dois existem porque a API de fato usa `_id` como
nome de campo em alguns payloads de validação. Unificar exigiria decidir qual
comportamento é o correto — decisão de contrato da API, não de refatoração —
e por isso ficou fora desta etapa.

### 3.2 `carrinhos-create.spec.ts` não foi dividido

É o maior spec funcional da suíte. Dividi-lo exigiria extrair describes com
dependência de estado compartilhado (mesma conta e mesmo produto entre
casos), o que aumentaria o risco de vazamento de recursos na API pública sem
ganho de legibilidade proporcional. O tamanho fica registrado aqui como
candidato da próxima etapa.

### 3.3 Asserts de status sem leitura de corpo foram mantidos

Alguns testes conferem apenas o status, sem precisar do corpo. Migrá-los para
`lerJson()` acrescentaria uma verificação de `content-type` que não existe
hoje, ou seja, mudaria a sensibilidade do teste. Mantidos como estão.

Onde o corpo já era lido (inclusive com mensagem de status personalizada), a
leitura passou a usar `lerJson<T>()` com o texto original no parâmetro
`contexto` — por exemplo `${endpoint}: id inexistente` e
`${endpoint}: id malformado` em `tests/seguranca/exposicao-erros.spec.ts`.

Duas leituras diretas de `response.json()` foram mantidas de propósito:

| Local | Motivo |
|-------|--------|
| `tests/seguranca/entrada-validacao.spec.ts` | o teste envia JSON inválido; o corpo pode não ser parseável, então a leitura não pode exigir `content-type` |
| `tests/helpers/latencia.ts` | a medição de latência tolera corpo não JSON (`.catch(() => undefined)`) |

### 3.4 Nenhuma ferramenta nova de lint foi adicionada

A suíte não tem `prettier`/`eslint` configurados. Adicionar uma ferramenta
mudaria o gate de CI e o estilo de todo o repositório — decisão de projeto,
não de refatoração. O estilo de imports foi padronizado manualmente
(um import por linha, nomes ordenados, `type` no fim).

## 4. Resultado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Arquivos de spec | 23 | 24 (+1 unitário do novo helper) |
| Testes na regressão | 265 | 272 (+7 unitários; a funcional segue com 265) |
| Linhas de spec | 5.872 | 5.340 |
| Linhas de helper | 1.583 | 1.863 |
| Linhas totais em `tests/` | 7.261 | 6.911 |
| Leituras de corpo com `lerJson` | 0 | 174 |
| Tipos de corpo duplicados | 3 | 1 |
| Blocos de ciclo de vida de carrinho copiados | 5 | 1 |
| Literais de mensagem em specs funcionais | 24 | 0 |

A funcional não mudou de tamanho: os 7 testes a mais são o unitário de
`helpers/resposta.ts`. Nenhum teste foi removido, renomeado ou desabilitado;
nenhuma requisição destrutiva extra foi adicionada.

### 4.1 Como foi validado

| Verificação | Resultado |
|-------------|-----------|
| `npm run typecheck` | aprovado |
| `npm run test:contratos` (sem rede) | 56/56 |
| `npm run test:contratos:api` | 25/25 |
| `npm run test:smoke` | 5/5 |
| `npm test` (regressão completa) | 272/272 |

## 5. Como manter

- **Nova leitura de corpo:** use `lerJson<T>(response, status, contexto)`.
  Não use `response.json()` direto: perde a conferência de `content-type`.
- **Nova mensagem da API:** declare a constante no helper do recurso
  (`resposta.ts`, `usuarios.ts`, `produtos.ts`, `carrinhos.ts` ou
  `autenticacao.ts`) e importe-a no spec.
- **Novo spec de carrinho:** use `criarContextoCarrinhos(request)` em vez de
  copiar o ciclo de vida.
- **Novo tipo de corpo:** declare-o em `helpers/resposta.ts` (ou no helper do
  recurso) e não no spec.
- **Novo helper:** teste unitário em `tests/helpers/<nome>.spec.ts`, sem rede,
  como em `resposta.spec.ts` e `latencia.spec.ts`.
