# Mutation Testing — Avaliação da Força da Suíte

Documento da **ETAPA 15**. Mede o quanto a suíte local detecta defeitos
realmente introduzidos no código, complementando a cobertura de linhas com uma
métrica de **qualidade das asserções**.

## 1. Objetivo

A cobertura de código responde "esta linha foi executada?"; o mutation testing
responde "se esta linha estivesse errada, algum teste falharia?". O objetivo
desta etapa foi:

- medir a força dos testes locais que não dependem da API pública;
- encontrar asserções ausentes ou fracas;
- melhorar os testes sem enfraquecer nenhuma verificação existente;
- documentar ferramenta, configuração, resultados e limitações.

A API ServeRest **não foi alterada nem submetida a carga**; a avaliação roda
apenas contra os testes offline do projeto.

## 2. Escopo da avaliação

Foram mutados cinco arquivos com lógica própria e testes offline:

| Arquivo | Papel | Testes que o exercitam |
| --- | --- | --- |
| `contracts/schema.ts` | motor de validação de schemas | `tests/contratos/schema.spec.ts` |
| `contracts/index.ts` | API pública de contratos (`verificarContrato`, `tipoMime`, `filtrarContratos`) | `tests/contratos/contratos.spec.ts` |
| `tests/helpers/diagnostico.ts` | sanitização e classificação de status | `tests/helpers/diagnostico.sanitizer.spec.ts` |
| `tests/helpers/latencia.ts` | medição, estatística e resumo de latência | `tests/helpers/latencia.spec.ts` |
| `tests/helpers/resposta.ts` | leitura e validação de respostas JSON | `tests/helpers/resposta.spec.ts` |

Total: **123 testes offline** (50 de schema, 28 de registro, 16 de sanitização,
21 de latência e 8 de resposta), executados com `workers: 1` e sem rede.

### Fora do escopo (e por quê)

| Arquivo | Motivo da exclusão |
| --- | --- |
| `contracts/contratos.ts` | registro de dados (671 linhas, 25 contratos). Os testes de consistência são circulares em relação ao próprio registro e mutações de string gerariam milhares de sobreviventes sem revelar lógica de teste. A verdade dos dados é verificada contra a API em `npm run test:contratos:api`. |
| `tests/helpers/contrato.ts` | validadores legados sem testes offline dedicados; exercitados apenas via rede, o que impediria um ciclo de mutação rápido e determinístico. |
| `tests/fixtures.ts`, `tests/helpers/*.ts` de dados | infraestrutura de teste e geração de dados, sem asserções próprias. |

## 3. Ferramenta e configuração

- **StrykerJS 10.0.0** (`@stryker-mutator/core`), instalado como devDependency.
- Não existe runner oficial de Playwright para o Stryker; foi usado o
  `testRunner: "command"` embutido, que executa um comando de teste por mutante.
- Configuração em `stryker.conf.json`:

| Opção | Valor | Justificativa |
| --- | --- | --- |
| `testRunner` | `command` | único runner compatível com Playwright |
| `commandRunner.command` | `npx playwright test <5 specs> --reporter=line --workers=1` | roda só a suíte offline, sem 429 e sem rede |
| `coverageAnalysis` | `off` | o command runner não fornece cobertura por teste |
| `mutate` | 5 arquivos da seção 2 | foco em lógica local |
| `reporters` | `clear-text`, `json` | leitura no console + dados brutos |
| `thresholds` | high 90 / low 80 / break 0 | `break` 0 não bloqueia pipeline; ver seção 13 |
| `timeoutMS` | 120000 | folga para o Playwright iniciar em cada mutante |
| `concurrency` | 4 | 16 CPUs disponíveis; reduz o tempo total |
| `tempDirName` | `.stryker-tmp` | diretório de trabalho isolado e ignorado pelo Git |

Mutadores aplicados pelo Stryker na execução final (720 mutantes):

| Mutador | Mutantes |
| --- | --- |
| `ConditionalExpression` | 180 |
| `StringLiteral` | 165 |
| `BlockStatement` | 108 |
| `EqualityOperator` | 77 |
| `LogicalOperator` | 42 |
| `BooleanLiteral` | 30 |
| `ArrayDeclaration` | 28 |
| `MethodExpression` | 21 |
| `ObjectLiteral` | 19 |
| `ArrowFunction` | 18 |
| `ArithmeticOperator` | 17 |
| `Regex` | 10 |
| `CallExpression` | 5 |
| **Total** | **720** |

## 4. Como executar

```bash
npm ci
npm run test:mutacao     # equivale a: npx stryker run
```

- Relatório de console: tabela por arquivo com `% Mutation score`, mortos,
  sobreviventes, sem cobertura e erros.
- Relatório estruturado: `reports/mutation/mutation.json` (ignorado pelo Git).
- Mutantes são aplicados em cópia temporária (`.stryker-tmp/`, também
  ignorado); **nenhuma mutação é commitada**.
- Execução final: **18 min 28 s** (dry run de 3,5 s; ~1,5 s por mutante com
  4 processos).

O dry run do command runner aparece como "Ran 1 tests" porque o runner reporta
o comando como uma única unidade; isso não é a contagem de testes executados.

## 5. Compatibilidade com TypeScript 7

O projeto usa TypeScript **7.0.2 nativo (`tsgo`)**, que não expõe a API
programática completa. O `TSConfigPreprocessor` do Stryker chama
`ts.parseConfigFileTextToJson`, ausente nessa distribuição, e a execução falha
com:

```
TypeError: ts.parseConfigFileTextToJson is not a function
```

Solução adotada: apontar `tsconfigFile` para um arquivo inexistente
(`tsconfig.stryker-ausente.json`). O preprocessor então não encontra o projeto
e é ignorado; os testes continuam compilando pelo `tsconfig.json` normal via
Playwright. Isso é seguro aqui porque o `tsconfig.json` não usa `extends` nem
`references` — não há configuração herdada a perder.

Alternativas descartadas: `inPlace: true` (risco de deixar mutação no
workspace), downgrade de TypeScript (invasivo para o projeto) e checker de
tipos do Stryker (incompatível com a API nativa). Quando o TypeScript expuser a
API ou o projeto voltar a uma versão com API completa, o workaround deve ser
removido e a configuração revalidada.

## 6. Metodologia de análise

Cada mutante sobrevivente foi classificado em uma destas categorias:

| Categoria | Significado | Ação |
| --- | --- | --- |
| **Equivalente** | o mutante produz o mesmo comportamento observável no domínio válido | documentar, não perseguir |
| **Defensivo** | proteção para entrada que não ocorre no contrato (ex.: `Error` sem `message`) | documentar |
| **Cosmético** | altera apenas alinhamento/padding de texto, não valores | documentar |
| **Número mágico** | altera um limite de formatação sem efeito semântico | documentar |
| **Lacuna real** | comportamento verificável que nenhum teste cobria | **corrigir o teste** |

Regras aplicadas: nenhuma asserção existente foi removida ou afrouxada; não
foram criados snapshots de layout; asserções novas verificam **comportamento**
(caminho, `esperado`, `recebido`, `mensagem`, classificação, colunas do resumo),
não a implementação interna.

## 7. Resultado inicial

Primeira execução, antes de qualquer melhoria nos testes:

| Arquivo | Mutantes | Mortos | Sobreviventes | Score |
| --- | --- | --- | --- | --- |
| `contracts/index.ts` | 110 | 79 | 31 | 71,82% |
| `contracts/schema.ts` | 316 | 241 | 75 | 76,27% |
| `tests/helpers/diagnostico.ts` | 89 | 75 | 14 | 84,27% |
| `tests/helpers/latencia.ts` | 191 | 88 | 103 | 46,07% |
| `tests/helpers/resposta.ts` | 13 | 11 | 2 | 84,62% |
| **Total** | **719** | **494** | **225** | **68,71%** |

Latência era o ponto mais fraco: a estatística era testada, mas a medição de
requisições, os limites por cenário e a formatação do resumo não tinham
asserções. `schema.ts` também deixava passar mutações de limites e de
mensagens de diagnóstico.

## 8. Lacunas de asserção identificadas

| Área | Lacuna | Exemplo de mutante que sobrevivia |
| --- | --- | --- |
| Schema — texto/número | limites inclusivos e exclusivos não eram verificados nas bordas | `valor.length < min` → `<=` |
| Schema — mensagens | `esperado`, `recebido` e `mensagem` não eram assertados | troca de texto em `criarDivergencia` |
| Schema — mapa de textos | sem casos `null`, primitivos, chaves proibidas e `minChaves` | `opcoes.minChaves !== undefined &&` → `true &&` |
| Contratos | content-type ausente se confundia com a string `"ausente"` | fallback `?? 'ausente'` |
| Contratos | filtros não tinham caso negativo (situação inexistente) | remoção da comparação de `situacao` |
| Sanitizador | nem todas as 14 chaves sensíveis e variações de Bearer/JWT eram cobertas | regex de chave sensível alterada |
| Latência | `medirRequisicao` nunca era chamada com `APIRequestContext` falso | classificação de 199/200/399/400 |
| Latência | agrupamento/ordenação não eram verificados antes de percentil e mediana | remoção do `sort` |
| Latência | resumo do console não tinha cabeçalho, colunas e falhas assertados | `p95Confiavel ? '' : '*'` |
| Resposta | contexto padrão e mensagens de falha não eram verificados | remoção do contexto padrão |

A lacuna do content-type revelou um problema de **produção**: usar
`resposta.contentType ?? 'ausente'` tornava impossível distinguir ausência real
do header da string literal `"ausente"`. O fallback foi corrigido para
`resposta.contentType === null ? undefined : resposta.contentType`, e o
diagnóstico passou a reportar a ausência corretamente.

## 9. Melhorias implementadas

Quarenta testes offline foram adicionados (83 → 123), sem rede:

| Arquivo | Antes | Depois | Principais adições |
| --- | --- | --- | --- |
| `tests/contratos/schema.spec.ts` | 35 | 50 | limites inclusivos/exclusivos, mensagens completas, `mapaDeTextos` (null, primitivos, chaves, `minChaves`), obrigatoriedade por tipo, caminhos aninhados, não ecoar strings |
| `tests/contratos/contratos.spec.ts` | 21 | 28 | precedência corpo/corpoTexto, content-type ausente, erro tipado, filtros por endpoint/autenticação/fonte, filtro negativo de situação, `tipoMime` com espaços |
| `tests/helpers/diagnostico.sanitizer.spec.ts` | 12 | 16 | 14 chaves sensíveis, Bearer com espaçamento variável, JWT completo, string direta, arrays aninhados |
| `tests/helpers/latencia.spec.ts` | 8 | 21 | `medirRequisicao` com request falso (status, timeout, erro de rede), ordenação, limites por cenário, resumo (cabeçalho, colunas, falhas, hífen, p95 confiável) |
| `tests/helpers/resposta.spec.ts` | 7 | 8 | contexto padrão documentado na mensagem de falha |

A alteração de produção em `contracts/index.ts` (fallback de content-type)
também faz parte das melhorias.

## 10. Resultado final

Execução final, após as melhorias:

| Arquivo | Mutantes | Mortos | Sobreviventes | Score | Antes | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| `contracts/index.ts` | 111 | 111 | 0 | **100,00%** | 71,82% | +28,18 |
| `contracts/schema.ts` | 316 | 306 | 10 | **96,84%** | 76,27% | +20,57 |
| `tests/helpers/diagnostico.ts` | 89 | 89 | 0 | **100,00%** | 84,27% | +15,73 |
| `tests/helpers/latencia.ts` | 191 | 182 | 9 | **95,29%** | 46,07% | +49,22 |
| `tests/helpers/resposta.ts` | 13 | 12 | 1 | **92,31%** | 84,62% | +7,69 |
| **Total** | **720** | **700** | **20** | **97,22%** | **68,71%** | **+28,51** |

- `Timeout`, `NoCoverage`, `RuntimeError` e `CompileError`: **0**.
- O total de mutantes subiu de 719 para 720 por causa da alteração de produção
  em `contracts/index.ts` (uma condição a mais no fallback de content-type).
- Score acima do threshold `high` (90) configurado.

## 11. Sobreviventes remanescentes

Os 20 sobreviventes foram analisados individualmente:

| # | Local | Mutador | Classificação | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | `schema.ts:128` | `min !== undefined &&` → `true &&` | Equivalente | comparar `length` com `undefined` é sempre `false`; o guarda não muda o resultado |
| 2 | `schema.ts:138` | `max !== undefined &&` → `true &&` | Equivalente | idem para o limite superior de texto |
| 3 | `schema.ts:186` | remove `typeof valor !== 'number'` | Equivalente | `Number.isFinite` já rejeita qualquer não número, sem coerção |
| 4 | `schema.ts:195` | `min !== undefined &&` → `true &&` | Equivalente | idem para número |
| 5 | `schema.ts:205` | `max !== undefined &&` → `true &&` | Equivalente | idem |
| 6 | `schema.ts:215` | `exclusivoMin !== undefined &&` → `true &&` | Equivalente | idem |
| 7 | `schema.ts:278` | `opcoes.proibidos ?? []` → `["Stryker was here"]` | Defensivo | só difere se o schema não declarar proibidos **e** o corpo contiver exatamente essa chave |
| 8 | `schema.ts:367` | `minItens !== undefined &&` → `true &&` | Equivalente | idem para arrays |
| 9 | `schema.ts:395` | `opcoes.proibidas ?? []` → `["Stryker was here"]` | Defensivo | idem para mapa de textos |
| 10 | `schema.ts:409` | `minChaves !== undefined &&` → `true &&` | Equivalente | idem para chaves |
| 11 | `latencia.ts:148` | `performance.now() - inicio` → `+` | Não determinístico | o valor medido mudaria, mas o teste com request falso não pode distinguir sem depender de tempo real |
| 12 | `latencia.ts:151` | `erro.message ?? ''` → sentinela | Defensivo | `Error` sempre tem `message`; valores não `Error` não fazem parte do contrato |
| 13 | `latencia.ts:203` | `length - 1` → `length + 1` | Equivalente | índice de nearest-rank é sempre ≤ `length - 1` para percentual 0–100; o limite superior nunca é acionado |
| 14 | `latencia.ts:328` | larguras → `() => undefined` | Cosmético | `padEnd(0)` mantém as colunas separáveis; só o alinhamento muda |
| 15 | `latencia.ts:329` | `Math.max` → `Math.min` | Cosmético | larguras menores, mesmos valores e mesma leitura por colunas |
| 16 | `latencia.ts:331` | larguras das linhas → `() => undefined` | Cosmético | idem |
| 17 | `latencia.ts:338` | `coluna === 0` → `true` | Cosmético | muda apenas `padStart`/`padEnd` da primeira coluna |
| 18 | `latencia.ts:338` | `coluna === 0` → `false` | Cosmético | idem |
| 19 | `latencia.ts:338` | `coluna === 0` → `!==` | Cosmético | idem |
| 20 | `resposta.ts:64` | `content-type ?? ''` → sentinela | Equivalente | o valor do header não entra na mensagem de erro; o caminho "ausente" é classificado pelo diagnóstico |

Resumo: **10 equivalentes**, **3 defensivos**, **6 cosméticos** e **1 não
determinístico**. Nenhuma lacuna funcional relevante permaneceu aberta — as
lacunas reais encontradas foram corrigidas (seção 9).

## 12. Limitações

1. **Sem runner oficial de Playwright**: o command runner reexecuta o comando
   inteiro por mutante (`coverageAnalysis: off`), sem seleção por teste. Isso
   torna a execução lenta (~18,5 min) e impede atribuir um mutante a um teste
   específico.
2. **Custo**: a avaliação não entra no quality gate por commit; é manual e
   indicada para mudanças em `contracts/` ou nos helpers.
3. **Mutação de helpers de teste**: o score inclui os próprios helpers; uma
   alteração grande neles muda a base de mutantes. Compare execuções sobre o
   mesmo conjunto de arquivos.
4. **Mutantes equivalentes**: 8 dos 20 sobreviventes são equivalentes e não
   podem ser mortos sem testes artificiais. Perseguir 100% pioraria a suíte.
5. **Formatação**: 6 sobreviventes são cosméticos. Asserções de alinhamento
   seriam frágeis e não verificam comportamento; foram deliberadamente evitadas.
6. **Dados do registro**: todos os 25 contratos estão como `situacao:
   confirmado`; não há contrato divergente/parcial para exercitar esses ramos.
   O registro foi excluído da mutação por ser dados, não lógica.
7. **TypeScript 7**: o workaround de `tsconfigFile` ignora o preprocessor de
   tsconfig; hoje não há `extends`/`references`, mas isso deve ser revisto se o
   tsconfig ganhar herança.
8. **`NoCoverage: 0` não é cobertura**: como todos os testes rodam para cada
   mutante, o relatório não distingue código não exercitado. A cobertura
   continua sendo avaliada em `docs/coverage-analysis.md`.
9. **Validade do contrato**: mutation testing valida a lógica local, não a
   aderência à API real; isso permanece com `npm run test:contratos:api`.

## 13. Recomendações e conclusão

Recomendações:

- manter a execução manual antes de releases que toquem `contracts/` ou
  `tests/helpers/`;
- em um job dedicado (noturno ou manual), elevar `thresholds.break` para 80 e
  manter `high` em 90 — **não** adicionar ao gate por commit enquanto o custo
  for ~18 min;
- remover o workaround de `tsconfigFile` quando a API do TypeScript estiver
  disponível, revalidando a configuração;
- se for necessário separar a força do código de produção da força dos helpers,
  gerar dois relatórios com listas de `mutate` distintas;
- reavaliar os sobreviventes cosméticos/equiparados apenas quando o código
  mudar; não criar asserções só para aumentar o número.

Validações desta etapa (2026-10-22):

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | 0 erros |
| Suíte offline (5 specs) | 123/123 aprovados |
| `npm run test:contratos` | 78/78 aprovados (sem rede) |
| `npm run test:contratos:api` | 25/25 aprovados |
| `npm test` | 312/312 aprovados (~2,3 min) |
| `npx stryker run` | **97,22%** (700/720), 0 erros, 0 timeouts |
| `git diff --check` | sem problemas de whitespace |

**Conclusão:** a suíte local é forte (97,22%, +28,51 p.p. sobre a linha de
base) e as lacunas encontradas foram corrigidas com asserções de comportamento.
Os 20 sobreviventes restantes estão classificados e justificados; não há
evidência de defeito não detectado no escopo avaliado.
