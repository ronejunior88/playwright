# Avaliação de latência da API (ETAPA 12)

Suíte **isolada**, leve e manual que mede o tempo de resposta de endpoints
`GET` de baixo impacto da API pública [ServeRest](https://serverest.dev).

O objetivo é produzir uma **evidência de linha de base** para discussions de
desempenho — não certificar desempenho. A API é pública e compartilhada, então
as medições representam o ambiente compartilhado no momento da execução, não
a infraestrutura de um ambiente dedicado.

---

## 1. O que esta etapa faz (e o que não faz)

| Faz | Não faz |
| --- | --- |
| Mede o tempo de resposta de 4 endpoints `GET` de leitura | Não mede carga, throughput, concorrência ou ramp-up |
| Coleta 5 amostras fixas por cenário, sequenciais | Não cria, altera ou exclui dados (nenhum `POST`/`PUT`/`DELETE`) |
| Reporta mínimo, máximo, média, mediana e p95 | Não define nem valida SLA |
| Separa falha funcional, erro HTTP, timeout e erro de rede | Não reprova a execução por causa de uma amostra lenta isolada |
| Persiste um artefato JSON local | Não versiona métricas nem altera o resultado da regressão funcional |

**Não existe SLA oficial desta API.** Os limites registrados na seção 5 são
hipóteses locais de diagnóstico, criadas nesta etapa para dar um piso de
comparação — não são um acordo de nível de serviço.

---

## 2. Cenários medidos

Todos os endpoints são públicos, de leitura e **sem autenticação**, o que
mantém a medição sem estado e sem criação de dados.

| Cenário | Requisição | Amostras | Contrato verificado |
| --- | --- | --- | --- |
| listagem de usuarios | `GET /usuarios` | 5 | `quantidade` + `usuarios[]` (`validarListaUsuarios`) |
| listagem de produtos | `GET /produtos` | 5 | `quantidade` + `produtos[]` (`validarListaProdutos`) |
| listagem de carrinhos | `GET /carrinhos` | 5 | `quantidade` + `carrinhos[]` (`validarListaCarrinhos`) |
| consulta de produto por id | `GET /produtos/{id}` | 5 | produto individual (`validarProduto`) |

Total por execução: **20 requisições** de leitura (mais 1 leitura auxiliar,
fora da janela de medição, para obter o `id` do produto).

A consulta por id reutiliza um produto **já existente na API** — nada é criado
para a medição, e portanto nada precisa ser excluído depois.

---

## 3. Janela de medição

- O tempo medido (`duracaoMs`) cobre **apenas a chamada HTTP**: do início da
  requisição até o recebimento e o parse do corpo.
- **Preparação de dados fica fora da janela.** A leitura usada para obter o
  `id` do produto não é registrada como amostra.
- O relógio usado é `performance.now()` (alta resolução, monotônico), não
  `Date.now()`.
- Timeout por requisição: **10 s**. Estourar esse valor conta como `timeout`,
  não como resposta lenta.
- As requisições são **sequenciais** (`workers: 1`, `fullyParallel: false`):
  não há concorrência, para não haver interferência entre amostras.

---

## 4. Métricas calculadas

| Métrica | Cálculo | Observação |
| --- | --- | --- |
| `minimoMs` / `maximoMs` | menor e maior duração válida | — |
| `mediaMs` | média aritmética das amostras válidas | — |
| `medianaMs` | valor central (média dos dois centrais quando par) | mais resistente a outliers que a média |
| `p95Ms` | percentil 95 por *nearest-rank* (`ceil(0.95 * n) - 1`) | ver alerta abaixo |
| `validas` | amostras com resposta HTTP `2xx`/`3xx` | únicas que entram nas métricas de tempo |
| `errosHttp` | respostas com status de erro | — |
| `timeouts` | requisições que estouraram 10 s | — |
| `errosRede` | falha de conexão sem resposta HTTP | — |

> **Percentil 95 com amostra pequena é apenas tendência.**
> Com `n = 5`, o p95 por *nearest-rank* é simplesmente o valor máximo da
> amostra — não descreve o comportamento sustentado da API. Por isso o
> resultado é marcado com `p95Confiavel: false` e exibido com `*` no console.
> A suíte considera confiável o p95 apenas a partir de **20 amostras
> válidas** (`MINIMO_AMOSTRAS_P95`), e ainda assim apenas como indicação
> estatística — não como garantia de desempenho.

**Falhas nunca são diluídas.** Timeouts, erros HTTP e erros de rede ficam
contados à parte e **não** entram na média, na mediana ou no p95. Uma falha de
transporte é tratada como falha de transporte, e não como "resposta lenta".

**Falha de assertion ≠ falha de transporte.** O transporte é capturado e
classificado pelo helper; a validação de contrato roda no corpo do teste, com
as mensagens da asserção. Um `expect` falhando nunca é reportado como erro de
rede.

---

## 5. Limites experimentais locais (hipóteses, não SLAs)

| Cenário | Limite local | Amostras acima (execução de referência) |
| --- | --- | --- |
| listagem de usuarios | 2000 ms | 0 |
| listagem de produtos | 2000 ms | 0 |
| listagem de carrinhos | 2500 ms | 0 |
| consulta de produto por id | 1500 ms | 0 |

Esses limites existem apenas para sinalizar desvios na comparação entre
execuções. Eles:

- **não** reprovam a execução — uma amostra lenta isolada nunca falha a suíte;
- **não** são requisitos de aceitação, e nada no repositório os trata como tal;
- podem ser revistos livremente, já que não há contrato de performance a
  respeitar.

---

## 6. Como executar

```bash
npm run test:latencia
```

Equivale a:

```bash
npx playwright test --config=playwright.latencia.config.ts
```

A suíte usa um **config dedicado** (`playwright.latencia.config.ts`) com:

| Opção | Valor | Motivo |
| --- | --- | --- |
| `testDir` | `./tests/performance` | isola a avaliação de desempenho |
| `workers` | `1` | amostras sequenciais, sem concorrência |
| `fullyParallel` | `false` | evita paralelismo dentro do arquivo |
| `timeout` | `120000` | acomoda as 5 amostras do cenário |
| `reporter` | `list` | não abre navegador nem sobrescreve o relatório HTML/JSON da regressão |

### Isolamento da regressão funcional

`playwright.config.ts` ignora `**/performance/**`. Com isso:

- `npm test` executa **somente** a regressão funcional — as métricas de
  desempenho não se misturam aos resultados funcionais;
- a regressão funcional **não** faz as 21 requisições extras da medição,
  preservando a taxa de requisições do ambiente público compartilhado;
- a avaliação de desempenho **não** sobrescreve `playwright-report/` nem
  `test-results/results.json`.

---

## 7. Artefatos gerados

Cada execução grava um arquivo em `performance-results/` (fora do controle de
versão, listado no `.gitignore`):

```
performance-results/latencia-<timestamp-iso>.json
```

Conteúdo:

- `geradoEm`, `api`, `amostrasPorCenario`, `timeoutRequisicaoMs`;
- `observacoes`: os avisos sobre p95 de amostra pequena e sobre a ausência de
  SLA;
- `resumo`: uma entrada por cenário com todas as métricas;
- `amostras`: cada requisição individual (cenário, método, endpoint, status,
  duração e classificação do desfecho).

**O que nunca é gravado:** tokens, senhas, cookies, cabeçalhos, corpos de
resposta ou dados pessoais. O arquivo contém apenas método, endpoint,
status, tempo e desfecho. Os endpoints passam pelo sanitizador existente
(`tests/helpers/diagnostico.ts`).

---

## 8. Execução de referência (2026-10-22)

Comando: `npm run test:latencia` — 4 testes aprovados, 20 amostras, 0 falhas,
~4,6 s de execução.

| Cenário | n | min (ms) | média (ms) | mediana (ms) | max (ms) | p95 (ms) | falhas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| listagem de usuarios | 5 | 160,21 | 205,28 | 165,07 | 366,03 | 366,03* | 0 |
| listagem de produtos | 5 | 161,15 | 169,16 | 168,11 | 182,89 | 182,89* | 0 |
| listagem de carrinhos | 5 | 161,78 | 172,11 | 174,01 | 177,85 | 177,85* | 0 |
| consulta de produto por id | 5 | 160,66 | 161,30 | 160,73 | 162,48 | 162,48* | 0 |

`*` p95 de amostra pequena (n = 5): indica tendência, não desempenho
sustentado.

A dispersão da listagem de usuários (mediana 165 ms, máximo 366 ms) ilustra
por que amostras isoladas não servem como medida de desempenho: a API pública
sofre variação de ambiente.

---

## 9. Decisão sobre o CI (execução manual)

A avaliação de latência **não** roda no pipeline do GitHub Actions. Motivos:

1. **Variabilidade do ambiente.** A API é pública e compartilhada; o resultado
   depende da carga de terceiros no momento da medição. Um número medido em
   um runner efêmero não é comparável ao número de uma execução local.
2. **Risco de limite de taxa.** A API responde **429** quando a taxa de
   requisições por IP sobe. Somar as 21 requisições da medição ao pipeline
   aumentaria o risco de Reprovar a regressão funcional por condição de
   ambiente.
3. **Ausência de limiar de decisão.** Como não existe SLA, o resultado não tem
   valor de gate: ele informa, não aprova nem reprova.

Consequência prática: o pipeline funcional
(`.github/workflows/playwright.yml`) permanece inalterado, e a medição é
acionada sob demanda com `npm run test:latencia`, registrando o resultado no
artefato local e, se necessário, no relatório da etapa.

---

## 10. Limitações conhecidas

- **Amostra pequena (n = 5 por cenário).** Suficiente para uma linha de base
  e para detectar desvios grandes; insuficiente para caracterizar
  distribuição ou cauda de latência.
- **Ausência de SLA.** Não existe valor oficial de referência contra o qual
  comparar.
- **Sem controle de ambiente.** Não há ambiente dedicado, com carga
  controlada, o que impede qualquer conclusão sobre a infraestrutura da API.
- **Endpoint `/carrinhos` devolve dados de terceiros.** A leitura expõe
  carrinhos de outros usuários da API pública; o corpo não é registrado, mas
  o status e o tempo de resposta também refletem o tamanho da base de dados
  compartilhada.
- **Percentil 95 com n = 5 equivale ao máximo da amostra.**
- **Uma única API, uma única região.** Não há comparação entre endpoints
  alternativos nem entre regiões.

---

## 11. Arquivos relacionados

| Arquivo | Papel |
| --- | --- |
| `tests/helpers/latencia.ts` | helper reutilizável: medição, classificação de falhas e estatística |
| `tests/helpers/latencia.spec.ts` | testes unitários do cálculo estatístico (sem rede) |
| `tests/performance/api-latency.spec.ts` | suíte isolada de avaliação de latência |
| `playwright.latencia.config.ts` | config dedicado da suíte de desempenho |
| `tests/helpers/diagnostico.ts` | sanitização usada na medição |
| `docs/quality-gate.md` | critérios de aprovação da regressão funcional |
| `docs/regression-strategy.md` | classificação de risco e grupos de regressão |
| `docs/security-testing.md` | sanitização de evidência e achados de segurança |
