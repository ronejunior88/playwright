# Dados de teste e ambientes

Este documento descreve como a suíte gera dados, isola recursos, limpa o que
criou e configura a execução local e no CI. O objetivo é reduzir colisões com a
API pública compartilhada e tornar o ambiente reproduzível.

## 1. Pré-requisitos

- Node.js **24.14.1**, fixado em `.nvmrc` e em `engines.node` no `package.json`.
- npm 11 ou superior, compatível com o `package-lock.json` versionado.
- Acesso à internet para os testes de integração; os testes locais de contrato,
  impacto, configuração e dados não usam rede.
- Nenhum navegador é necessário: a suíte usa `APIRequestContext`.

Instalação:

```bash
node --version   # deve corresponder ao .nvmrc
npm ci
```

## 2. Configuração da suíte

A configuração fica em `tests/helpers/configuracao.ts` e é usada pelos dois
configs do Playwright. Os padrões são:

| Variável | Padrão | Validação |
| --- | --- | --- |
| `SERVE_REST_BASE_URL` | `https://serverest.dev` | URL absoluta `http`/`https`, sem credenciais, query string ou fragmento; a barra final é normalizada |
| `API_TIMEOUT_MS` | `30000` | Inteiro entre 1 e 120000 ms |
| `CI` | não definido | `true` (sem diferenciar maiúsculas) ativa retries `2`, `forbidOnly` e reporter do GitHub |

Outros valores derivados:

- `workers: 1` em todos os ambientes, por causa do limite de taxa da API pública.
- `retries: 0` localmente e `retries: 2` no CI.
- `testIgnore: '**/performance/**'` no config principal.
- A suíte de latência usa `playwright.latencia.config.ts` e a mesma URL base.

### Arquivo `.env`

`.env.example` documenta as variáveis. Copie para `.env` apenas quando precisar
mudar os padrões:

```bash
cp .env.example .env
```

O `.env` é ignorado pelo Git e carregado automaticamente quando existe. Variáveis
já definidas no processo têm precedência sobre o arquivo. Valores inválidos
interrompem a execução antes dos testes, com mensagem indicando a variável.

O `.env` **não** deve conter segredos reais. A API de estudo usa credenciais
fictícias e os dados são sintéticos.

### CI

O workflow usa a versão de Node de `.nvmrc` e aceita as mesmas variáveis por
`vars` do repositório:

```yaml
SERVE_REST_BASE_URL: ${{ vars.SERVE_REST_BASE_URL || 'https://serverest.dev' }}
API_TIMEOUT_MS: ${{ vars.API_TIMEOUT_MS || '30000' }}
```

Se uma variável não existir, o fallback é aplicado. O pipeline não cria `.env`
e não versiona segredos. A execução remota não é comprovada por este documento;
ela só deve ser declarada aprovada após uma execução real no GitHub Actions.

## 3. Geração de dados

Os dados são sintéticos e gerados em tempo de execução:

- `tests/helpers/aleatorio.ts` centraliza a geração de sufixos únicos com
  `crypto.randomBytes`, contador e instante atual. O formato é
  `<tempo-base36>-<contador-base36>-<semente-hex>`.
- `criarGeradorSufixos` permite `agora` e `semente` para testes determinísticos.
  Sem opções, cada gerador recebe uma semente criptográfica própria.
- `gerarIdUnico()` produz 16 caracteres hexadecimais (8 bytes) para IDs
  inexistentes.
- `gerarEmailUnico`, `gerarNomeUnico` e `gerarNomeProdutoUnico` acrescentam o
  sufixo ao prefixo do domínio.
- `gerarSenhaUnica(prefixo)` usa o prefixo mais 12 caracteres hexadecimais.
  `SENHA_PADRAO` é usada quando o valor exato da senha não importa.
- `montarDadosUsuario` e `montarDadosProduto` montam payloads completos e aceitam
  sobrescritas parciais. Os testes específicos continuam podendo definir valores
  fixos quando a asserção depende deles (por exemplo, preço e quantidade em
  cálculos de carrinho).
- Dados fixos que servem de chave de unicidade (nome de produto, e-mail, senha
  usada em filtro) não devem ser usados. Prefixos e valores esperados podem ser
  constantes.

Os testes unitários em `tests/helpers/dados.spec.ts` verificam formato,
unicidade, determinismo por semente, faixas de preço/quantidade e montagem dos
payloads.

## 4. Ciclo de vida e isolamento

Regras aplicadas pelos testes:

1. Criar o recurso e registrar seu ID imediatamente.
2. Executar a operação sob teste.
3. Validar a resposta e o contrato.
4. Remover o recurso em `afterEach`, `afterAll` ou `finally`, mesmo quando o
   teste falha.
5. Nunca apagar dados de terceiros.

Carrinhos usam modo `serial` porque a API permite apenas um carrinho ativo por
usuário. O contexto em `tests/helpers/cenario-carrinhos.ts` centraliza a criação
e a limpeza das contas. Se o login de uma conta recém-criada falhar,
`criarUsuarioAutenticado` remove a conta antes de propagar o erro.

A limpeza em `tests/helpers/limpeza.ts`:

- tenta novamente **uma vez** apenas em HTTP 429 ou erro de rede;
- não repete em outros status;
- registra a falha no console e como anotação `cleanup` no relatório;
- não falha o teste por uma limpeza malsucedida, pois o erro original deve ser
  preservado.

Não existe limpeza global. Resíduos de execuções interrompidas podem permanecer
na API pública e devem ser tratados como condição do ambiente.

## 5. Execução local

```bash
npm run typecheck
npm run test:contratos
npm run test:impacto
npm test
```

Comandos focados:

```bash
npx playwright test tests/helpers/configuracao.spec.ts tests/helpers/dados.spec.ts
npx playwright test tests/usuarios
npx playwright test tests/produtos
npm run test:contratos:api
npm run test:latencia
```

`npm test` usa 1 worker. `npm run test:paralelo` usa 2 workers e pode receber
HTTP 429; é opt-in e não representa o padrão do CI.

## 6. Local versus CI

| Aspecto | Local | CI |
| --- | --- | --- |
| Node.js | versão do `.nvmrc` | `node-version-file: '.nvmrc'` |
| Instalação | `npm ci` | `npm ci` com cache |
| URL/timeout | padrões ou `.env` | `vars` com fallback |
| Retries | 0 | 2 |
| Workers | 1 | 1 |
| Testes de contrato locais | executados | executados antes do impacto |
| Seleção por impacto | opcional | calculada pelo diff |
| Relatórios | HTML/JSON locais | artefatos do workflow |
| Latência | sob demanda | quando o diff exige |

## 7. Limitações conhecidas

- A API é pública e compartilhada; taxa de requisições, dados de terceiros e
  indisponibilidade externa podem afetar a execução.
- O filtro por nome/senha pode encontrar registros de terceiros; as asserções
  restringem o resultado ao ID ou ao valor exclusivo criado pelo teste.
- Uma limpeza pode falhar por 429, rede ou permissão e ficará visível apenas como
  aviso/anotação.
- A suíte não garante que dados criados por execuções interrompidas sejam
  removidos.
- O `.env` é apenas conveniência local; não é mecanismo de segredo.
- O modo determinístico do gerador é usado nos testes unitários, mas a suíte
  funcional continua gerando dados novos a cada execução.
- A validação de CI foi local/estática nesta etapa; não há alegação de execução
  remota bem-sucedida.
