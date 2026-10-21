# Quality Gate — Critérios de Aprovação da Suíte

Documento da **ETAPA 10**. Define o que significa "aprovado" para esta suíte e
como classificar cada falha antes de decidir por merge ou release.

## 1. Estados possíveis

| Estado | Significado | Efeito |
| --- | --- | --- |
| **APROVADO** | Todos os critérios da seção 2 foram verificados e cumpridos | Merge/release liberados |
| **REPROVADO** | Pelo menos um teste do grupo `@critico` falhou por **defeito reproduzível do produto** | Merge/release bloqueados |
| **INCONCLUSIVO** | Falha causada por ambiente (429, indisponibilidade, rede) e não reproduzível em nova tentativa | Nada é aprovado **nem** reprovado; repetir a execução |

Não existe estado "aprovado com ressalvas": falha de ambiente não vira aprovação
por conveniência, e defeito de crítico não é negociado por prazo.

## 2. Critérios do gate

| # | Critério | Como verificar | Comando | Esperado |
| --- | --- | --- | --- | --- |
| 1 | Sem erros de tipo | `tsc --noEmit` | `npm run typecheck` | 0 erros |
| 2 | Contratos básicos OK | Grupo smoke | `npm run test:smoke` | 5/5 |
| 3 | Risco alto protegido | Grupo críticos | `npm run test:criticos` | 25/25, **0 flaky** |
| 4 | Regressão integral | Suíte completa | `npm test` | 144/144, 0 skipped |
| 5 | Estabilidade comprovada | Relatório | `test-results/results.json` | `flaky: 0` |
| 6 | Falhas explicadas | Anexo `requisicoes-api` + dica de diagnóstico | relatório HTML | toda falha classificada (seção 3) |

Critérios 2–4 são **cumulativos** (o grupo menor é subconjunto do maior); o
gate exige todos. Critério 6 é o que separa REPROVADO de INCONCLUSIVO.

## 3. Como classificar uma falha

| Sintoma | Classificação | Ação |
| --- | --- | --- |
| 4xx/5xx esperado ≠ recebido, reproduzível em nova execução | **Defeito do produto** | Reprova o gate se o teste for `@critico` |
| Asserção contradiz a documentação da API e o comportamento observado | **Defeito do teste** | Corrigir teste/asserção; gate não é reprovado pelo produto |
| `HTTP 429` ou status `0` (rede/timeout), não reproduzível na repetição | **Ambiente** | INCONCLUSIVO; repetir após janela de rate limit |
| Falha só em `--workers=2` | **Ambiente** (taxa por IP) | Executar com `workers: 1`, o modo suportado |

Regra fundamental: **um teste `@critico` falho por defeito reproduzível do
produto reprova o quality gate** — mesmo que os outros 139 testes passem.

## 4. Checklist de execução

```bash
npm ci                 # dependências limpas
npm run typecheck      # critério 1
npm run test:smoke     # critério 2 (~6 s)
npm run test:criticos  # critério 3 (~37 s)
npm test               # critério 4 (~108 s)
npm run report         # critérios 5 e 6, se houver falha
```

Em CI o mesmo percurso roda no workflow `.github/workflows/playwright.yml`
(smoke → regressão completa, com `retries: 2` para tornar flaky visível no
relatório). Um teste que só passa após retry é **instável**: investigar antes
de aprovar.

## 5. O que o gate não faz

- Não força reprovação por falha de ambiente (429 da API pública compartilhada).
- Não aprova pelo simples exit code de um único comando: exige os grupos
  menores e a inspeção do `results.json`.
- Não aceita "aprovado com falha em crítico" nem "aprovado com flaky".
- Não usa `continue-on-error` nem mascara status de job no CI.

## 6. Registro da última avaliação

| Critério | Comando | Resultado | Data |
| --- | --- | --- | --- |
| 1 | `npm run typecheck` | 0 erros | 2026-10-21 |
| 2 | `npm run test:smoke` | 5/5 aprovados | 2026-10-21 |
| 3 | `npm run test:criticos` | 25/25 aprovados, 0 flaky | 2026-10-21 |
| 4 | `npm test` | 144/144 aprovados | 2026-10-21 |
| 5 | `results.json` | `flaky: 0`, `skipped: 0` | 2026-10-21 |

**Estado: APROVADO.**
