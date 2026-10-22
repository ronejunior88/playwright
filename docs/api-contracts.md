# Contratos da API (ETAPA 13)

Este documento descreve os **contratos de resposta** da API ServeRest
mantidos pelo projeto: a forma esperada do corpo, o status HTTP, a regra de
autenticação e a origem de cada informação (documentação publicada, observação
em execução ou ambas).

O objetivo é **detectar mudanças de contrato** na API: quando um endpoint
passa a devolver outro formato — ou deixa de devolver o campo obrigatório — a
suíte falha com uma mensagem que aponta o campo afetado, sem depender de
testes que quebrem de forma genérica.

- Catálogo machine-readable: [`contracts/contratos.ts`](../contracts/contratos.ts)
- Motor de validação (sem dependências): [`contracts/schema.ts`](../contracts/schema.ts)
- API pública do registro: [`contracts/index.ts`](../contracts/index.ts)
- Adaptador Playwright: [`tests/helpers/contratos.ts`](../tests/helpers/contratos.ts)
- Testes locais (sem rede): [`tests/contratos/schema.spec.ts`](../tests/contratos/schema.spec.ts),
  [`tests/contratos/contratos.spec.ts`](../tests/contratos/contratos.spec.ts)
- Testes de integração (com rede): [`tests/contratos/contratos-api.spec.ts`](../tests/contratos/contratos-api.spec.ts)

## 1. Princípios

1. **Forma, não grafia.** O contrato garante a *forma* do campo (`message`
   presente e não vazio, `preco` numérico, `_id` com 16 caracteres
   alfanuméricos). A grafia exata das mensagens continua verificada pelos
   testes funcionais — evita duplicar asserções frágeis em dois lugares.
2. **Nenhum valor dinâmico é exigido.** Nomes, e-mails e descrições são apenas
   "texto": o contrato não fixa o valor que o teste gera em execução.
3. **Campos adicionais são compatíveis.** Se a API começar a devolver um campo
   novo, isso é registrado como divergência **compatível** (aparece no relatório
   como informação) e **não** reprova o teste. A breaking change é a remoção de
   um campo, a troca de tipo ou a mudança de status.
4. **Divergência não é falha automática.** Uma divergência incompatível falha o
   teste que a encontrou; mas a existência de uma divergência **não** bloqueia
   a suíte inteira nem "corrige" o comportamento observed.
5. **Segurança nas mensagens.** As mensagens de divergência nunca ecoam o
   conteúdo de strings (apenas tipo e tamanho) — um `password` ou um token
   nunca aparece em uma falha de contrato.
6. **Sem dados de terceiros.** Os exemplos registrados (`exemploValido`) são
   sintéticos; nenhum dado real é versionado.

## 2. Formatos de resposta observados

A API usa **quatro** formatos distintos de corpo. Reconhecê-los é essencial:
um erro de validação **não** é um erro de negócio.

| Formato | Exemplo | Quando ocorre |
| ------- | ------- | ------------- |
| Recurso | `{ "_id": "...", "nome": "...", ... }` | listagem, consulta, criação (201) |
| Listagem | `{ "quantidade": 2, "usuarios": [ ... ] }` | `GET` de coleção |
| Mensagem | `{ "message": "..." }` | erro de negócio, autorização, exclusão, alteração |
| Erro por campo | `{ "nome": "nome é obrigatório" }` | validação de payload |
| Erro por `id` | `{ "id": "id deve ter exatamente 16 caracteres alfanuméricos" }` | `_id` malformado |

Regras que decorrem disso e estão codificadas nos schemas:

- o formato de **erro por campo** não pode conter a chave `message` — nesse
  formato a API sempre descreve o campo problemático;
- o formato de **erro por campo** *pode* conter a chave `_id` (quando `_id` é
  enviado na requisição, a resposta é `{ "_id": "_id não é permitido" }`);
- o formato de **erro por `id`** não contém `message` nem `_id`.

## 3. Catálogo de contratos

25 contratos registrados. `fonte`: `documentacao` (descrito pela API),
`observado` (medido em execução) ou `documentacao+observado`. `situacao`:
`confirmado` (exercitado por ao menos um teste automatizado),
`parcialmente-validado`, `pendente-de-confirmacao` ou `divergente`.

### Autenticação

| id | Método | Endpoint | Status | Autenticação | Fonte | Situação |
| -- | ------ | -------- | ------ | ------------ | ----- | -------- |
| `login.sucesso` | POST | `/login` | 200 | nenhuma | documentacao+observado | confirmado |
| `login.credenciais-invalidas` | POST | `/login` | 401 | nenhuma | documentacao+observado | confirmado |
| `login.payload-invalido` | POST | `/login` | 400 | nenhuma | documentacao+observado | confirmado |

### Usuários

| id | Método | Endpoint | Status | Autenticação | Fonte | Situação |
| -- | ------ | -------- | ------ | ------------ | ----- | -------- |
| `usuarios.lista` | GET | `/usuarios` | 200 | nenhuma | documentacao+observado | confirmado |
| `usuarios.item` | GET | `/usuarios/{_id}` | 200 | nenhuma | documentacao+observado | confirmado |
| `usuarios.criacao` | POST | `/usuarios` | 201 | nenhuma | documentacao+observado | confirmado |
| `usuarios.email-duplicado` | POST | `/usuarios` | 400 | nenhuma | documentacao+observado | confirmado |
| `usuarios.atualizacao` | PUT | `/usuarios/{_id}` | 200 | nenhuma | documentacao+observado | confirmado |
| `usuarios.exclusao` | DELETE | `/usuarios/{_id}` | 200 | nenhuma | documentacao+observado | confirmado |

### Produtos

| id | Método | Endpoint | Status | Autenticação | Fonte | Situação |
| -- | ------ | -------- | ------ | ------------ | ----- | -------- |
| `produtos.lista` | GET | `/produtos` | 200 | nenhuma | documentacao+observado | confirmado |
| `produtos.item` | GET | `/produtos/{_id}` | 200 | nenhuma | documentacao+observado | confirmado |
| `produtos.criacao` | POST | `/produtos` | 201 | administrador | documentacao+observado | confirmado |
| `produtos.nome-duplicado` | POST | `/produtos` | 400 | administrador | documentacao+observado | confirmado |
| `produtos.atualizacao` | PUT | `/produtos/{_id}` | 200 | administrador | documentacao+observado | confirmado |
| `produtos.exclusao` | DELETE | `/produtos/{_id}` | 200 | administrador | documentacao+observado | confirmado |

### Carrinhos

| id | Método | Endpoint | Status | Autenticação | Fonte | Situação |
| -- | ------ | -------- | ------ | ------------ | ----- | -------- |
| `carrinhos.lista` | GET | `/carrinhos` | 200 | nenhuma | documentacao+observado | confirmado |
| `carrinhos.item` | GET | `/carrinhos/{_id}` | 200 | nenhuma | documentacao+observado | confirmado |
| `carrinhos.criacao` | POST | `/carrinhos` | 201 | token | documentacao+observado | confirmado |
| `carrinhos.conclusao` | DELETE | `/carrinhos/concluir-compra` | 200 | token | documentacao+observado | confirmado |
| `carrinhos.cancelamento` | DELETE | `/carrinhos/cancelar-compra` | 200 | token | documentacao+observado | confirmado |

### Erros e autorização

| id | Método | Endpoint | Status | Autenticação | Fonte | Situação |
| -- | ------ | -------- | ------ | ------------ | ----- | -------- |
| `erros.mensagem` | GET | `/{recurso}/{_id}` | 400 | nenhuma | documentacao+observado | confirmado |
| `erros.id-invalido` | GET | `/{recurso}/{_id}` | 400 | nenhuma | observado | confirmado |
| `erros.validacao-campos` | POST | `/{recurso}` | 400 | nenhuma | documentacao+observado | confirmado |
| `auth.sem-token` | POST | `/{recurso-protegido}` | 401 | token | documentacao+observado | confirmado |
| `auth.nao-admin` | POST | `/{recurso-protegido}` | 403 | administrador | documentacao+observado | confirmado |

## 4. Divergências entre documentação, contrato e ambiente

As divergências abaixo foram observadas em execução contra a API pública e
**não** foram "corrigidas" na suíte: o contrato registra o comportamento
real e a diferença em relação à documentação/expectativa.

| id | Divergência | Evidência | Impacto |
| -- | ----------- | --------- | ------- |
| D1 | `POST /produtos` exige `preco` **inteiro** (400 `preco deve ser um inteiro`), embora a documentação o descreva como número e a resposta devolva número | `tests/produtos/produtos-create.spec.ts` | Contrato de resposta aceita qualquer número positivo; a restrição fica na asserção funcional |
| D2 | `PUT /usuarios/{_id}` e `PUT /produtos/{_id}` exigem o **payload completo** (payload parcial devolve 400 por campo) | `tests/usuarios/usuarios-update.spec.ts`, `tests/produtos/produtos-update.spec.ts` | Documentação descreve alteração parcial |
| D3 | Recurso inexistente responde **400** (não 404) com `{ message }`; `_id` malformado responde 400 com `{ id }` | `tests/produtos/produtos-get.spec.ts`, `tests/carrinhos/carrinhos-get.spec.ts` | Contratos `erros.mensagem` e `erros.id-invalido` |
| D4 | `DELETE` de registro inexistente responde **200** com mensagem diferente ("Nenhum registro excluído") | `tests/usuarios/usuarios-delete.spec.ts`, `tests/produtos/produtos-delete.spec.ts` | Mesmo formato `{ message }`; registrado no contrato de exclusão |
| D5 | `administrador` é uma **string** (`"true"`/`"false"`), não booleano | `tests/usuarios/usuarios-create.spec.ts` | Schema exige string com lista de valores permitidos |
| D6 | `PUT` em `_id` inexistente faz **upsert** (201, formato de criação) em vez de 404/erro | `tests/seguranca/exposicao-erros.spec.ts` | Achado SEC-04 da ETAPA 11 |
| D7 | Identificadores têm **16 caracteres alfanuméricos**; fora disso a resposta é `{ id: "..." }` | `tests/seguranca/entrada-validacao.spec.ts` | Schema `IDENTIFICADOR` |
| D8 | `GET /usuarios` devolve o campo `password` em **texto claro** | `tests/seguranca/exposicao-erros.spec.ts` | Achado SEC-01 da ETAPA 11; o contrato registra a forma, não valida a exposição |

Observações complementares registradas em cada contrato (`observacoes` no
registro): `POST /usuarios` **não exige autenticação** (achado SEC-02) e
`POST /carrinhos` aceita usuário administrador em rota que exige apenas token.

## 5. Como o motor funciona

`contracts/schema.ts` implementa um validador minimalista, sem dependências:

| construtor | valida |
| ---------- | ------ |
| `texto({ min, max, padrao, valores })` | string com comprimento/forma/lista de valores |
| `numero({ min, max, inteiro, exclusivoMin })` | número finito, com limites e integridade |
| `booleano()` / `nulo()` / `qualquer()` | tipos simples |
| `objeto({ campos }, { camposConhecidos, proibidos })` | objeto com campos obrigatórios/opcionais, campos proibidos e relatório de campos adicionais |
| `array(schema, { minItens })` | lista com validação item a item e caminho indexado (`produtos[0].idProduto`) |
| `mapaDeTextos({ minChaves, proibidas })` | mapa `{ campo: "mensagem" }` |
| `opcionado(schema)` | campo opcional |

Cada validação devolve uma lista de **divergências** com `caminho`,
`esperado`, `recebido` e `categoria`:

- `campo-obrigatorio-ausente` — campo obrigatório não veio;
- `tipo-incompativel` — tipo do campo difere do esperado;
- `estrutura-incompativel` — a estrutura não é a esperada (ex.: veio objeto
  no lugar de array);
- `valor-incompativel` — valor presente, mas fora das restrições (mínimo,
  formato, integridade);
- `campo-proibido-presente` — veio um campo que não deve existir;
- `campo-adicional` — veio um campo novo (**compatível**, não reprova);
- `status-incompativel` / `content-type-incompativel` — status ou
  `content-type` diferentes do contrato.

O caminho é sempre completo (`produtos[0].quantidade`), o que permite localizar
a origem da mudança sem imprimir o corpo da resposta.

### Invariantes

Além do schema, o contrato pode declarar invariantes semânticas — funções que
recebem o corpo e devolvem divergências. Hoje há uma:

- `quantidadeCoerenteComLista`: em respostas de listagem, o campo `quantidade`
  deve ser igual ao tamanho da lista (`usuarios`, `produtos`, `carrinhos`).
  Ela detecta uma mudança estrutural em que a API passa a devolver um objeto
  no lugar do array.

## 6. Como usar nos testes

O adaptador `tests/helpers/contratos.ts` expõe:

```ts
import { validarContrato } from '../helpers/contratos';

const response = await request.get(`/produtos/${id}`);
await validarContrato('produtos.item', response);
```

`validarContrato` é **assíncrono** porque precisa ler o corpo bruto
(`response.text()`) para validar o JSON e para reportar divergências sem
ecoar conteúdo sensível. O `APIResponse` do Playwright mantém o corpo em cache,
então chamar `.text()` depois de `.json()` não gera uma segunda requisição.

Para um contrato ainda não registrado (ou quando se quer apenas inspecionar),
use `inspecionarContrato`, que devolve a lista de divergências sem reprovar:

```ts
const verificacao = await inspecionarContrato('produtos.item', response);
```

O contrato é verificado em **status**, **content-type**, **schema** e
**invariantes**. Uma falha mostra o id do contrato, o endpoint, o status
recebido e a lista de divergências.

## 7. Execução

```bash
# suíte local do motor e do registro — sem rede, ~1 s
npx playwright test tests/contratos/schema.spec.ts tests/contratos/contratos.spec.ts

# integração com a API real
npx playwright test tests/contratos/contratos-api.spec.ts
```

Os contratos também são verificados **dentro dos testes funcionais**: cada
cenário de sucesso ou erro relevante chama `validarContrato` com o id do
contrato correspondente. Isso faz a suíte funcional falhar quando a API muda
de forma, mesmo que as asserções por campo continuem passando.

Os testes locais não tocam a rede e por isso rodam no CI como passo
**separado** da regressão que depende da API pública.

## 8. Limites conhecidos

- Os contratos descrevem **forma**, não semântica de negócio: regras como
  "1 carrinho por usuário" continuam sendo testadas nos testes funcionais.
- A lista de contratos cobre os endpoints exercitados pela suíte. Endpoints
  novos exigem um novo contrato (e um teste de integração correspondente).
- `content-type` é verificado como `application/json` (prefixo), porque a API
  pode responder com `application/json; charset=utf-8`.
- A suíte de contratos depende da API pública compartilhada: um **429** é
  condição de ambiente, não defeito de contrato.
