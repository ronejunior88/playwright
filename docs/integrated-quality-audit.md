# Auditoria Integrada de Qualidade — ETAPA 19

**Data:** 2026-10-28
**Branch:** `Estudos`
**Commit de referência:** `720a875 Etapa 18 - Dados de teste e configuracao reproduzivel`
**Escopo:** auditoria integrada da suíte Playwright + TypeScript da API ServeRest,
sem reescrita da arquitetura e sem remoção de cenários.

> **Nota ETAPA 20 (2026-10-28):** a pendência de mutation testing foi
> encerrada. A execução completa reproduziu **97,22%** (700/720, 20
> sobreviventes classificados), sem erros ou timeouts, em 19 min 56 s. A
> classificação final da entrega está em
> [`final-delivery-audit.md`](final-delivery-audit.md) e
> [`project-completion-report.md`](project-completion-report.md).

## 1. Objetivo

Verificar, de ponta a ponta, se a suíte está consistente e pronta para uso:
código, testes, dados, isolamento, segurança, contratos, configuração,
desempenho, mutação, análise de impacto, CI, documentação e dependências.

A etapa não criou novos cenários funcionais nem enfraqueceu asserções. O foco foi
encontrar inconsistências reais, corrigir as de maior impacto e registrar
limitações sem inventar resultados.

## 2. Método e evidências

1. Leitura do estado do repositório, configurações, workflow, helpers, specs e
   documentação.
2. Execução de `npm ci`, `npm run typecheck`, suítes locais, smoke, críticos,
   contratos contra a API real, latência e regressão completa.
3. Inspeção do relatório JSON do Playwright (`test-results/results.json`) para
   confirmar totais, `skipped`, `unexpected` e `flaky`.
4. Auditoria de dependências com `npm audit` e execução completa do Stryker
   (`npm run test:mutacao`), além do dry-run de validação.
5. Revisão de limpeza de recursos, sanitização de evidências e mensagens de erro.
6. Atualização apenas dos documentos operacionais desatualizados; documentos
   históricos receberam nota de contexto em vez de reescrita.
7. Execução do workflow no GitHub Actions em `Estudos`, com correção do limite
   de taxa e confirmação final por meio da API pública de runs/anotações.

## 3. Estado inicial

| Item | Resultado |
| --- | --- |
| Árvore Git | Limpa no início da etapa |
| Branch | `Estudos`, rastreando `origin/Estudos` |
| Node.js | `v24.14.1` (`.nvmrc` e `engines.node`) |
| npm | `11.21.1` |
| Playwright | `1.60.0` |
| Testes listados | **384 em 26 arquivos** no config principal |
| Contratos locais | **78** |
| Contratos contra a API | **25** |
| Testes de impacto | **43** |
| Smoke / críticos | **5 / 25** |
| Dependências | `npm ci` aprovado; 2 vulnerabilidades moderadas **dev-only** via Stryker → `typed-rest-client` → `qs` |

## 4. Matriz integrada

| Área | Verificação | Evidência | Status |
| --- | --- | --- | --- |
| Código e tipos | `tsc --noEmit` | 0 erros | Aprovado |
| Configuração | URL, timeout, `.env`, CI, retries e workers | 18 testes de configuração + 11 de dados | Aprovado |
| Dados e unicidade | Sufixos, e-mails, nomes, IDs e payloads | Testes unitários e execução funcional | Aprovado |
| Isolamento e limpeza | Criação, registro do ID e remoção em `finally`/hooks | Correções aplicadas; suíte sem resíduos observáveis | Corrigido |
| Contratos locais | Motor de schemas e registro | 78/78 | Aprovado |
| Contratos contra a API | 25 respostas reais | 25/25 | Aprovado |
| Segurança | Autenticação, autorização, entradas, exposição e sanitização | 14 testes de segurança + 16 do sanitizador/classificação + login | Aprovado |
| Desempenho | 4 endpoints GET, 5 amostras cada | 4/4, 20 amostras, sem SLA | Aprovado (diagnóstico) |
| Mutation testing | Stryker e testes offline | Execução completa: 700/720 (97,22%), 20 sobreviventes classificados | Aprovado |
| Análise de impacto | Seleção por diff e fallback conservador | 43/43 | Aprovado |
| CI/workflow | Typecheck, contratos, impacto, fallback e artefatos | Execução remota `40757900849`: sucesso; 384/384, 25/25, 5/5 e 78/78 | Aprovado |
| Dependências | `npm audit` e lockfile | 0 vulnerabilidades após correção | Corrigido |
| Documentação | Contagens, comandos, claims e links | Documentos operacionais atualizados | Corrigido |
| Git | Diff, whitespace e escopo | Revisão final antes do commit | Aprovado |

## 5. Achados e severidade

| ID | Severidade | Achado | Evidência | Ação |
| --- | --- | --- | --- | --- |
| A1 | **P2** | Teste de contrato de criação de usuário podia deixar usuário órfão se a validação do contrato falhasse após o `201`. | `tests/contratos/contratos-api.spec.ts` | Captura do `_id` antes da validação e exclusão em `finally`. |
| A2 | **P2** | Teste de contrato de criação de produto com administrador não excluía o produto; apenas o usuário era removido. | `tests/contratos/contratos-api.spec.ts` | Exclusão do produto e do usuário em `finally`. |
| A3 | **P2** | Testes funcionais registravam o ID depois da validação de contrato em criações via `POST` e via `PUT` com ID inexistente. | `usuarios-create.spec.ts`, `usuarios-update.spec.ts`, `produtos-update.spec.ts` | Registro do ID imediatamente após a leitura do `_id`, antes da validação. |
| A4 | **P2** | Helpers de criação podiam deixar recurso órfão se a API respondesse `201` com corpo estruturalmente inválido. | `tests/helpers/usuarios.ts`, `tests/helpers/produtos.ts` | Exclusão defensiva do `_id` quando a validação do corpo falha. |
| A5 | **P2** | `docs/quality-gate.md` ainda exigia 265/265 e afirmava que o CI não usava `continue-on-error`. | Documento vs. suíte/workflow atuais | Contagens e claim corrigidos; uso do `continue-on-error` foi esclarecido. |
| A6 | **P2** | `docs/regression-strategy.md` usava 265 testes, 240 sem tag, 56 contratos e tempos antigos. | Documento vs. execução atual | Contagens e tempos atualizados para 384/359/78. |
| A7 | **P3** | Duas vulnerabilidades moderadas em dependências de desenvolvimento (Stryker → `typed-rest-client` 2.3.1 → `qs` 6.15.1). | `npm audit` | `npm audit fix` atualizou `qs` para 6.17.0 e `typed-rest-client` para 2.3.0; auditoria zerada. |
| A8 | **P3** | Documentos históricos (cobertura, rastreabilidade, qualidade, mutação, segurança, impacto) podiam ser lidos como contagens atuais. | Notas de contexto ausentes | Notas da ETAPA 19 adicionadas, preservando o histórico. |
| A9 | **P2** | As duas primeiras execuções remotas do GitHub Actions falharam com **HTTP 429** durante a regressão completa, após 315 e 331 testes passarem. | Runs `40751737898` e `40756139740` | Pacing de 300 ms por requisição no CI, com override `0` na suíte de latência; a execução `40757900849` passou com 384/384. |
| A10 | **P3** | O mutation testing completo não foi reexecutado na ETAPA 19; apenas o dry-run do Stryker. | `--dryRunOnly` | Reexecutado na ETAPA 20: 97,22% (700/720), 20 sobreviventes analisados, 0 erros/timeouts. |

### Problemas procurados e não encontrados

- Nenhum `test.only`, `test.skip`, `test.fixme`, `waitForTimeout`, `@ts-ignore`
  ou `any` explícito nos testes.
- Nenhum segredo real ou token versionado.
- Nenhuma asserção central removida ou enfraquecida.
- Nenhum uso de dados de terceiros como pré-requisito.
- Nenhum `catch` vazio que mascare falha de produto.

## 6. Correções aplicadas

### 6.1 Limpeza de recursos

- `tests/contratos/contratos-api.spec.ts`: captura do `_id` antes da validação
  de contrato e exclusão de usuário/produto em `finally`.
- `tests/usuarios/usuarios-create.spec.ts`: ID registrado antes da validação do
  contrato de criação.
- `tests/usuarios/usuarios-update.spec.ts` e `tests/produtos/produtos-update.spec.ts`:
  ID do recurso criado por `PUT` com ID inexistente registrado antes da
  validação.
- `tests/helpers/usuarios.ts` e `tests/helpers/produtos.ts`: exclusão defensiva
  se a resposta `201` tiver corpo inválido depois de já ter um `_id`.

### 6.2 Dependências

- `npm audit fix` atualizou a cadeia de desenvolvimento do Stryker:
  `qs` 6.15.1 → 6.17.0 e `typed-rest-client` 2.3.1 → 2.3.0.
- `npm audit` e `npm audit --omit=dev` passaram a retornar **0 vulnerabilidades**.
- `npx stryker --version` e `npx stryker run --dryRunOnly` confirmaram que a
  ferramenta continua operacional.

### 6.3 CI

- O workflow passou a definir `API_REQUEST_INTERVAL_MS=300` para espaçar as
  chamadas de API no CI e reduzir o risco de **429** na API pública.
- A suíte de latência sobrescreve a variável para `0`, pois o atraso
  artificial contaminaria as medições.
- A regressão local é executada sem o atraso; a execução remota com pacing
  passou com 384/384 em 4,9 min.

### 6.4 Documentação

- `docs/quality-gate.md`: 384/384, tempos atuais, registro da ETAPA 19 e
  esclarecimento do `continue-on-error` usado apenas na seleção de impacto.
- `docs/regression-strategy.md`: 384 testes, 359 sem tag, 78 contratos locais,
  tempos e evidências atualizados.
- `docs/test-data-and-environments.md`: retry de cleanup descrito de forma
  compatível com o código (429 ou exceção de transporte).
- `docs/coverage-analysis.md`, `docs/traceability-matrix.md`,
  `docs/code-quality.md`, `docs/mutation-testing.md`,
  `docs/security-testing.md` e `docs/change-impact-analysis.md`: notas de
  contexto e contagens atuais, sem apagar o histórico.
- `README.md`: tempos, link e estrutura da auditoria integrada.

## 7. Validações executadas

| Validação | Comando | Resultado |
| --- | --- | --- |
| Instalação limpa | `npm ci` | 173 pacotes; 0 vulnerabilidades após a correção |
| Tipos | `npm run typecheck` | 0 erros |
| Configuração e dados | `npx playwright test tests/helpers/configuracao.spec.ts tests/helpers/dados.spec.ts` | 29/29 |
| Contratos locais | `npm run test:contratos` | 78/78, ~2 s |
| Contratos contra a API | `npm run test:contratos:api` | 25/25, ~30 s |
| Impacto | `npm run test:impacto` | 43/43, ~1 s |
| Segurança | `npx playwright test tests/seguranca` | 14/14, ~14 s |
| Smoke | `npm run test:smoke` | 5/5, ~6 s |
| Críticos | `npm run test:criticos` | 25/25, ~57 s |
| Regressão completa | `npm test` | **384/384**, 217 s |
| CI remoto | GitHub Actions, run `40757900849` | **Sucesso**: 78/78 contratos, 5/5 smoke, 25/25 críticos e 384/384 completos (4,9 min); job em 6 min 37 s |
| Relatório estruturado | `test-results/results.json` | `expected: 384`, `unexpected: 0`, `skipped: 0`, `flaky: 0` |
| Latência | `npm run test:latencia` | 4/4, 20 amostras, ~17 s |
| Stryker | `npm run test:mutacao` | 5 arquivos, 720 mutantes, **700 mortos (97,22%)**, 20 sobreviventes classificados |
| Auditoria de dependências | `npm audit` / `npm audit --omit=dev` | 0 / 0 vulnerabilidades |
| Whitespace Git | `git diff --check` | Sem erros (verificação final antes do commit) |

## 8. CI e reprodutibilidade

- `npm ci` foi executado com o lockfile versionado; o `package-lock.json` foi
  sincronizado com `engines.node >= 24.14.1`.
- O workflow usa a versão de `.nvmrc`, `npm ci` com cache, typecheck,
  contratos locais e seleção por impacto com fallback conservador.
- O `continue-on-error` existe apenas no passo de seleção; uma falha nele leva
  à regressão completa, não a uma execução vazia.
- **A execução remota foi comprovada.** As duas primeiras tentativas
  (`40751737898` e `40756139740`) falharam por **HTTP 429** na API pública; a
  correção de pacing foi enviada e a execução `40757900849` passou em
  `Estudos`, com o job `test` concluído em 6 min 37 s.
- Ajustar o pacing para `300` ms aumentou a duração da regressão no CI para
  4,9 min, ainda dentro do timeout do workflow; localmente, sem pacing, a
  referência permanece em 217 s.

## 9. Riscos residuais e pendências

| Risco/Pendência | Severidade | Observação |
| --- | --- | --- |
| API pública compartilhada | P3 | Rate limit e indisponibilidade externas ainda podem gerar 429/timeout; o pacing reduz o risco no CI, mas não elimina a dependência externa. |
| Falha de cleanup | P3 | A limpeza não falha o teste; o relatório registra anotação `cleanup` e aviso no console. |
| Sem lint/Prettier | P3 | Decisão de escopo documentada; o gate atual usa `tsc` e os testes. |

Nenhuma pendência P0/P1 permaneceu aberta após as correções.

## 10. Critérios de prontidão

| Critério | Situação |
| --- | --- |
| Código compila sem erros de tipo | Atendido |
| Testes smoke e críticos passam | Atendido (5/5 e 25/25) |
| Regressão completa passa sem falhas, skips ou flaky | Atendido (384/384) |
| Contratos locais e contra a API passam | Atendido (78/78 e 25/25) |
| Recursos criados são removidos mesmo em falha | Atendido nas rotas corrigidas; helpers com limpeza defensiva |
| Evidências de falha não expõem segredos | Atendido (sanitização coberta por testes) |
| Dependências sem vulnerabilidades conhecidas | Atendido (npm audit = 0) |
| Documentação operacional coerente com a suíte | Atendido |
| CI remoto comprovado | Atendido (run `40757900849`, sucesso) |
| Mutation testing completo reexecutado | Atendido (97,22%; 700/720) |

## 11. Conclusão e status

**Status: Aprovada (pendências P3 de execução encerradas na ETAPA 20).**

A suíte está funcionalmente aprovada: 384/384 testes passaram, sem skips,
falhas ou flaky; typecheck, contratos, segurança, impacto, latência, smoke e
críticos passaram; a auditoria de dependências ficou limpa. As correções de
limpeza reduzem o risco de resíduos na API pública compartilhada.

O CI remoto foi corrigido e validado: após duas falhas por 429, o pacing de
300 ms foi aplicado e a execução `40757900849` passou com 384/384. O mutation
testing completo foi reexecutado na ETAPA 20 e reproduziu 97,22% (700/720), com
20 sobreviventes classificados. Permanecem apenas riscos ambientais e de escopo
documentados, sem pendência P0/P1. Nenhum resultado foi declarado como aprovado
sem evidência real.
