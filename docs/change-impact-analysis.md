# Análise de Impacto e Seleção de Testes

Documento da **ETAPA 16**. Descreve como o projeto identifica quais testes
precisam ser executados a partir dos arquivos alterados, quando a regressão
completa é obrigatória e como isso foi integrado ao pipeline existente.

> Esta análise **complementa** a regressão completa; ela não a substitui. A
> suíte completa continua disponível em `npm test` e é acionada sempre que o
> impacto é incerto.
>
> **Nota ETAPA 19 (2026-10-28):** o projeto tem **26 specs principais** e **1
> spec de performance**, com **43 testes** da própria estratégia. Os números de
> dependentes citados abaixo são exemplos ilustrativos; o grafo real é
> verificado pelos testes em `tests/impacto/selecao.spec.ts`.

## 1. Objetivo

Reduzir o tempo de feedback em mudanças pequenas e localizadas sem permitir que
um teste necessário deixe de rodar. A estratégia tem três níveis:

| Nível | Modo | O que executa | Quando |
| --- | --- | --- | --- |
| **A** | `nenhum` | Nenhum teste de API; apenas as verificações locais do pipeline (`typecheck` e contratos locais) | Alteração somente documental ou de configuração de ferramenta sem efeito na suíte |
| **B** | `direcionada` | Apenas os specs afetados pelo grafo de imports; opcionalmente a suíte de latência | Mudança localizada em teste, helper ou contrato com dependentes mapeados |
| **C** | `completa` | Smoke, críticos e suíte funcional completa | Mudança global, arquivo desconhecido, exclusão, informação insuficiente ou falha na própria análise |

A decisão é conservadora: **na dúvida, nível C**. Não existe caminho em que uma
falha de análise resulte em "nada a executar".

## 2. Componentes implementados

| Componente | Responsabilidade |
| --- | --- |
| `scripts/impacto/selecao.js` | Lógica pura: normaliza caminhos, classifica arquivos, aplica regras, limiar de regressão completa e produz o resultado |
| `scripts/impacto/selecao.d.ts` | Tipos usados pelos testes TypeScript |
| `scripts/impacto/projeto.js` | Lê `tests/**` e `contracts/**`, extrai imports relativos e calcula o grafo reverso de dependentes por spec |
| `scripts/impacto/projeto.d.ts` | Tipos do carregador do projeto |
| `scripts/selecionar-testes.js` | CLI: lê `git diff --name-status -M`, chama a lógica pura e escreve saída humana, JSON e `$GITHUB_OUTPUT` |
| `tests/impacto/selecao.spec.ts` | 43 testes offline da estratégia e do grafo real |
| `.github/workflows/playwright.yml` | Calcula o diff, executa o seletor e escolhe as validações, com fallback para completa |

Não há dependência externa nova. A solução usa Node.js, o grafo de imports
estático do próprio projeto e os scripts npm já existentes.

## 3. Mapa de componentes e dependências

O grafo é construído a partir dos imports relativos encontrados em
`tests/**/*.ts` e `contracts/**/*.ts`. Imports de pacotes (`@playwright/test`,
`node:*`) são ignorados; um caminho relativo é resolvido para `.ts` ou
`index.ts`.

Relações relevantes observadas no repositório atual (26 specs principais, mais
1 spec de performance):

| Arquivo alterado | Specs dependentes | Resultado real |
| --- | --- | --- |
| `tests/auth/login.spec.ts` | ele próprio | direcionada (1) |
| `tests/helpers/cenario-carrinhos.ts` | 5 specs de `tests/carrinhos/` | direcionada (5) |
| `tests/helpers/autenticacao.ts` | 14 specs | direcionada (14 de 24, 58,3%) |
| `tests/helpers/resposta.ts` | 19 specs | completa (79,2%) |
| `tests/fixtures.ts` | 20 specs | completa (83,3%) |
| `contracts/schema.ts` | 20 specs (via `contracts/index.ts`) | completa (83,3%) |
| `tests/performance/api-latency.spec.ts` | suíte de latência isolada | direcionada, sem specs funcionais |
| `tests/impacto/selecao.spec.ts` | ele próprio | direcionada (1) |

O limite padrão é **60%** dos specs principais. Ao atingi-lo, a execução vira
completa. Isso evita manter dezenas de comandos direcionados quando quase toda a
suíte seria afetada e reduz o risco de subseleção.

Exemplos de dependências transitivas: `tests/helpers/contratos.ts` importa
`contracts/index.ts`; como esse adaptador é usado por vários specs, mudanças no
motor de contratos alcançam a maior parte da suíte e são tratadas como globais.

## 4. Critérios de seleção

A classificação é feita pelo caminho normalizado (barras `/`, sem `./`):

| Categoria | Exemplos | Decisão |
| --- | --- | --- |
| Documentação | `*.md`, `docs/**` | Ignorar; modo `nenhum` |
| Teste | `tests/**/*.spec.ts` | Executar o próprio spec |
| Código de teste/contrato | `tests/helpers/**`, `tests/fixtures.ts`, `contracts/**` | Executar dependentes transitivos do grafo |
| Estratégia de seleção | `scripts/**` | Executar `tests/impacto/**` |
| Performance | `tests/performance/**` | Acionar a suíte de latência; não adicionar specs funcionais |
| Configuração global | `playwright*.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `tests/helpers/configuracao.ts`, `.nvmrc` | Regressão completa |
| Workflow/CI | `.github/workflows/**`, `.github/**` | Regressão completa e aviso para validar o pipeline |
| Ferramenta sem teste de API | `stryker.conf.json`, `.gitignore`, `.editorconfig`, `.env.example` | Ignorar com aviso de validação manual |
| Desconhecido | qualquer outro caminho | Regressão completa |
| Exclusão | status `D` | Regressão completa, exceto documentação/ferramenta |
| Renomeação | status `R` | Mesma categoria: processa o novo caminho; categoria diferente: completa |

Regras adicionais:

- `A`, `M`, `R` e `C` são suportados. Status não suportado (`U`, `T`, `X` etc.)
  força regressão completa.
- Entradas duplicadas são removidas; a saída é ordenada e determinística.
- A ordem dos arquivos de entrada não altera o resultado.
- Lista vazia significa `nenhum`; lista ausente/inválida significa `completa`.
- Specs fora da suíte principal não entram na seleção funcional.
- Dependentes vazios ou não pertencentes à suíte principal forçam completa.
- Caminhos são normalizados, mas não há resolução de aliases nem de reexports
  por símbolo; `import()` só é lido quando o caminho é um literal.

## 5. Mudanças globais e regressão completa

A execução completa é obrigatória quando:

1. o diff não pôde ser calculado ou a base não existe/não é ancestral;
2. o evento é uma execução manual com `execucao=completa`;
3. um arquivo de configuração global foi alterado;
4. o workflow ou outra configuração de CI foi alterada;
5. um arquivo desconhecido apareceu no diff;
6. um teste, helper ou contrato foi excluído;
7. uma renomeação mudou a categoria do arquivo;
8. o grafo não encontrou dependentes para um arquivo de código;
9. a proporção de specs afetados atingiu o limiar de 60%;
10. o seletor falhou ou não produziu saída válida.

Também é possível forçar a execução completa explicitamente:

```bash
npm test
node scripts/selecionar-testes.js --completa --motivo "release"
```

No GitHub Actions, `workflow_dispatch` tem a entrada `execucao` com padrão
`completa`; `auto` exige uma base (`base`) e usa o diff dessa base até `HEAD`.

## 6. Comandos

```bash
# Testa a própria estratégia (sem rede)
npm run test:impacto

# Analisa um arquivo de diff e imprime o resultado humano
node scripts/selecionar-testes.js --arquivos changed-files.txt

# Saída JSON para inspeção
node scripts/selecionar-testes.js --arquivos changed-files.txt --json

# Saída para o GitHub Actions e evidência em JSON
node scripts/selecionar-testes.js \
  --arquivos changed-files.txt \
  --github-output \
  --saida-json reports/impacto/selecao.json

# Execução completa explícita
node scripts/selecionar-testes.js --completa --motivo "release"
```

O arquivo de entrada segue o formato do Git:

```text
M	tests/auth/login.spec.ts
A	tests/impacto/novo.spec.ts
D	tests/helpers/antigo.ts
R100	tests/auth/login.spec.ts	tests/auth/login-novo.spec.ts
```

## 7. Integração com o CI

O workflow existente foi evoluído, sem um segundo pipeline:

1. checkout com `fetch-depth: 0` para permitir o cálculo do diff;
2. `npm ci`, `npm run typecheck` e `npm run test:contratos` (verificações
   locais e rápidas) sempre rodam;
3. o passo **Selecionar validações por impacto** calcula a base:
   - `push`: `github.event.before` até `github.sha`, exigindo ancestralidade;
   - `pull_request`: `merge-base(base.sha, head)` até `head`;
   - `workflow_dispatch`: completa por padrão; `auto` usa a base informada;
4. falha de base, diff, `git` ou seletor cai em regressão completa com aviso;
5. o seletor grava `modo`, `nivel`, `testes`, `latencia`, `motivos`, `avisos` e
   `completa_por` em `$GITHUB_OUTPUT` e em `reports/impacto/selecao.json`;
6. modo `direcionada` executa apenas os specs selecionados; se `latencia=true`,
   executa também `npm run test:latencia`;
7. modo `completa` executa smoke, críticos e `npx playwright test`;
8. o resumo da seleção aparece no *step summary* e o relatório, o JSON da
   seleção e a lista de arquivos alterados são publicados como artefatos mesmo
   em caso de falha.

O passo de seleção tem `continue-on-error: true` para permitir o fallback: se
algo inesperado acontecer, o próprio passo grava `modo=completa` e um aviso; se
o Node não puder gerar a saída, um bloco de emergência em bash escreve os
mesmos campos em `$GITHUB_OUTPUT`. Além disso, os passos de regressão completa
usam `steps.impacto.outcome == 'failure'`, de modo que uma falha do seletor
sempre leva à regressão completa. Um erro de análise nunca é convertido em
execução vazia.

## 8. Testes da estratégia

`npm run test:impacto` cobre 43 cenários, entre eles:

- mudança no teste de login e no schema de contrato;
- helper compartilhado e helper sem dependentes;
- configurações globais (`playwright`, `tsconfig`, `package.json`,
  `package-lock.json`, `tests/helpers/configuracao.ts`, `.nvmrc`);
- documentação, arquivo desconhecido e lista ausente;
- múltiplos recursos simultâneos e deduplicação;
- independência de ordem e determinismo;
- exclusão de teste, helper e documentação;
- renomeação de teste, de documentação e mudança de categoria;
- workflow, performance e scripts da própria estratégia;
- configuração de ferramenta (`stryker.conf.json`, `.env.example`);
- entradas inválidas, status Git não suportado, normalização de caminhos e
  cópia de teste;
- grafo real do projeto, incluindo dependentes transitivos de contratos e a
  seleção real de `tests/helpers/cenario-carrinhos.ts`.

Evidência local: `43 passed` com `npm run test:impacto`. As simulações de CLI
produziram `direcionada` para login, `nenhum` para documentação, `direcionada`
para renomeação de login e `completa` para arquivo desconhecido ou falha de
análise.

## 9. Limitações e recomendações futuras

Implementado e validado localmente:

- análise estática de imports relativos;
- seleção por arquivo de teste, não por teste individual;
- fallback conservador para completa;
- integração com o workflow e artefatos.

Limitações conhecidas:

- aliases de caminho e reexports por símbolo não são interpretados; imports
  dinâmicos só são lidos com caminho literal;
- qualquer mudança em `contracts/schema.ts` ou `tests/helpers/resposta.ts`
  atinge a maior parte da suíte e vira completa, o que é correto pelo uso atual,
  mas reduz o ganho da seleção;
- a decisão é por arquivo: um helper grande pode afetar muitos specs;
- o limiar de 60% é uma heurística, não uma medição histórica de risco;
- o workflow não foi executado no GitHub Actions nesta etapa; a validação foi
  estática e local, e não há alegação de execução remota;
- o modo `auto` em execução manual depende de uma base informada.

Recomendações futuras (não implementadas):

- usar a API do compilador TypeScript para um grafo mais preciso;
- considerar tags e histórico de falhas para priorizar specs dentro do arquivo;
- medir tempos reais por spec para calibrar o limiar;
- adicionar cache de dependências no CI, se o custo justificar;
- registrar a decisão do seletor em um artefato de auditoria de longo prazo.

## 10. Relação com a estratégia de regressão

A classificação de risco, smoke e críticos continua em
[`regression-strategy.md`](regression-strategy.md). A análise de impacto é uma
camada de **seleção**, não um novo grupo de risco: ela escolhe o que executar e
mantém a regressão completa como rede de segurança. A matriz de rastreabilidade
permanece em [`traceability-matrix.md`](traceability-matrix.md).
