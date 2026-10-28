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
| 4 | Regressão integral | Suíte completa | `npm test` | 384/384, 0 skipped |
| 5 | Estabilidade comprovada | Relatório estruturado | `npx playwright test --reporter=json` | `flaky: 0` |
| 6 | Falhas explicadas | Anexo `requisicoes-api` + dica de diagnóstico | relatório HTML | toda falha classificada (seção 3) |

Critérios 2–4 são **cumulativos** (o grupo menor é subconjunto do maior); o
gate exige todos. Critério 6 é o que separa REPROVADO de INCONCLUSIVO.

> O gate cobre a **regressão funcional**. A avaliação de latência
> (`npm run test:latencia`) é diagnóstica, manual e **não faz parte** do gate:
> não aprova, não reprova e não bloqueia merge/release.
>
> A checagem local de contratos (`npm run test:contratos`, sem rede) roda
> **antes** do gate no CI: ela detecta um contrato quebrado no registro sem
> esperar pela API pública. Uma falha ali é defeito do projeto (não do
> ambiente) e reprova o pipeline.

## 3. Como classificar uma falha

| Sintoma | Classificação | Ação |
| --- | --- | --- |
| 4xx/5xx esperado ≠ recebido, reproduzível em nova execução | **Defeito do produto** | Reprova o gate se o teste for `@critico` |
| Asserção contradiz a documentação da API e o comportamento observado | **Defeito do teste** | Corrigir teste/asserção; gate não é reprovado pelo produto |
| `HTTP 429` ou status `0` (rede/timeout), não reproduzível na repetição | **Ambiente** | INCONCLUSIVO; repetir após janela de rate limit |
| Falha só em `--workers=2` | **Ambiente** (taxa por IP) | Executar com `workers: 1`, o modo suportado |

Regra fundamental: **um teste `@critico` falho por defeito reproduzível do
produto reprova o quality gate** — mesmo que os outros 383 testes passem.

## 4. Checklist de execução

```bash
npm ci                  # dependências limpas
npm run typecheck       # critério 1
npm run test:contratos  # contratos locais, sem rede (ETAPA 13)
npm run test:smoke      # critério 2 (~6 s)
npm run test:criticos   # critério 3 (~57 s)
npm test                # critério 4 (~3,7 min)
npm run report          # critérios 5 e 6, se houver falha
```

Em CI o workflow `.github/workflows/playwright.yml` executa o typecheck e os
contratos locais, calcula a seleção por impacto e, no modo completo, roda
smoke → críticos → regressão completa (com `retries: 2` para tornar flaky
visível no relatório). As chamadas usam pacing de 300 ms para reduzir o risco
de 429; a regressão completa leva cerca de 4,9 min no CI. Um teste que só passa
após retry é **instável**: investigar antes de aprovar.

## 5. O que o gate não faz

- Não força reprovação por falha de ambiente (429 da API pública compartilhada).
- Não aprova pelo simples exit code de um único comando: exige os grupos
  menores e a inspeção do relatório estruturado.
- Não aceita "aprovado com falha em crítico" nem "aprovado com flaky".
- Não mascara falha de teste ou de job no CI. O único `continue-on-error` do
  workflow é o da **seleção por impacto**, que, ao falhar, força o fallback
  conservador para a regressão completa em vez de pular testes.

## 6. Registro da última avaliação

| Critério | Comando | Resultado | Data |
| --- | --- | --- | --- |
| 1 | `npm run typecheck` | 0 erros | 2026-10-28 |
| 2 | `npm run test:smoke` | 5/5 aprovados | 2026-10-28 |
| 3 | `npm run test:criticos` | 25/25 aprovados, 0 flaky | 2026-10-28 |
| 4 | `npm test` | 384/384 aprovados, 222 s | 2026-10-28 |
| 5 | relatório estruturado | `flaky: 0`, `skipped: 0` | 2026-10-28 |
| — | `npm run test:contratos` | 78/78 aprovados (sem rede) | 2026-10-28 |
| — | GitHub Actions, run `40757900849` | Sucesso: 384/384 completos; 25/25 críticos, 5/5 smoke e 78/78 contratos | 2026-10-28 |

**Estado: APROVADO.**
