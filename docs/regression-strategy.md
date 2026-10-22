# Estratégia de Regressão — Suíte API ServeRest

Documento da **ETAPA 10**. Define a classificação de risco dos cenários, os
grupos de execução (smoke, críticos, regressão completa), como cada grupo é
implementado e as regras de evolução da priorização.

## 1. Objetivo

A suíte tem **184 testes** e leva ~2 min contra uma API pública compartilhada.
Não faz sentido executar tudo sempre: para feedback rápido em pull requests e
para decisão de release, os cenários foram classificados por risco e agrupados
em níveis de regressão com comandos reais e medidos.

## 2. Classificação de risco

Critério: **impacto de uma regressão não detectada** sobre usuários e sobre a
integridade de dados (estoque, carrinhos, permissões), combinado com a
probabilidade de o cenário representar um caminho real de uso.

| Risco | Definição | Cenários | Qtd |
| --- | --- | --- | --- |
| **Alto** | Regressão compromete autenticação/autorização, integridade de estoque/carrinhos, persistência de CRUD ou o contrato de login | login (sucesso, senha incorreta, email inexistente); listagem estrutural de `/usuarios` e `/produtos`; health check; proteção administrativa de `/produtos` (sem token, comum, vínculo com carrinho); CRUD de usuários/produtos com persistência e exclusão bloqueada por carrinho; criação de carrinho com efeito exato no estoque; segundo carrinho rejeitado; estoque acima do disponível; concluir/cancelar compra (efeitos e idempotência); fluxo ponta a ponta de compra concluída | 25 |
| **Médio** | Regressão degrada comportamento documentado, mas sem perda de dados: filtros, validações de payload, duplicidades, ids inexistente/malformados, mensagens de erro | filtros por cada campo e combinados; payloads sem campo ou com tipo errado; email duplicado; produto duplicado; id inexistente e formato inválido | 99 |
| **Baixo** | Contrato secundário observado por execução, sem exigência documentada: chaves de query não permitidas; mensagem exata de "nenhum registro" | defesa de API por chave de query não permitida (3 rotas); mensagens de resultado vazio | incluídos nos médios acima, sem tag |

Os 25 cenários de **risco alto** recebem a tag `@critico` no título; os 5 que
também validam o contrato mínimo de um ponto de entrada da API recebem
`@smoke` (subconjunto dos críticos). Os demais 119 permanecem sem tag e só
entram na regressão completa.

## 3. Grupos de execução

| Grupo | Seletor | Testes | Tempo medido | Uso |
| --- | --- | --- | --- | --- |
| **Smoke** | `npm run test:smoke` (`--grep @smoke`) | 5 | ~6 s | Sinal imediato de que a API responde, o login funciona e os contratos básicos de listagem não mudaram |
| **Críticos** | `npm run test:criticos` (`--grep @critico`) | 25 | ~37 s | Gate de regressão de risco alto: permissões, estoque, carrinhos e persistência de CRUD |
| **Regressão completa** | `npm test` | 184 | ~122 s | Validação integral antes de merge/release; engloba os dois grupos acima |

Todas as execuções usam `workers: 1` (a API pública limita a taxa por IP;
ver `README.md`).

> A avaliação de latência (`npm run test:latencia`) **não** faz parte de
> nenhum desses grupos: ela roda em config próprio, é manual e não bloqueia a
> regressão funcional. Ver `docs/performance-testing.md`.

## 4. Como a priorização é implementada

- Tags no **título** do teste (`test('... @smoke @critico')`) — o mecanismo
  nativo do Playwright, sem dependência externa e visível no relatório.
- Seletor via `--grep` nos scripts do `package.json`; nenhum arquivo é
  duplicado e nenhum teste é ignorado por configuração.
- Smoke é **sempre subconjunto** dos críticos: um teste que só serve de sinal
  rápido também protege o risco alto correspondente.

Cenários parametrizados (`for (const caso of casos)`) e blocos `serial` de
carrinhos **não** recebem tag: a tag é aplicada apenas a cenários unitários e
nomeados, evitando seleção parcial de loops.

## 5. Justificativas de exclusão do smoke e dos críticos

| Cenário | Por quê não é smoke/crítico |
| --- | --- |
| Filtros (`?nome=`, `?preco=`, combinados) | Regressão degradaria busca, mas não perde dados nem quebra permissão; ~40 chamadas por execução |
| Validações de payload por campo (57 cenários) | Alto volume, baixo risco individual: cada um reusa o mesmo caminho de rejeição 400 |
| Id inexistente / formato inválido | Mesmo caminho de erro (400) já exercitado pelos críticos via payload inválido |
| Segundo `DELETE` idempotente de usuário/produto inexistente | Comportamento de resultado vazio, sem efeito de dados |
| Chaves de query não permitidas | Defesa observada por execução, não é requisito documentado |

## 6. Auditoria de estabilidade

Verificado na suíte antes de fixar os grupos:

| Verificação | Resultado |
| --- | --- |
| `waitForTimeout` / waits fixos | **0 ocorrências** em `tests/` |
| `test.skip` / `fixme` / `slow` | **0 ocorrências** |
| Retries locais (`retries` fora do CI) | `0` local, `2` no CI (flaky fica visível no relatório) |
| Dados compartilhados entre testes | Nenhum: cada teste cria e remove os próprios recursos |
| Paralelismo | `workers: 1` (429 em `--workers=2`, medido) |

## 7. Regras de evolução

1. Novo cenário de risco alto (permissão, estoque, carrinho, persistência de
   CRUD, contrato de login) **deve** nascer com `@critico`.
2. Smoke só muda quando um novo ponto de entrada se torna fundamental;
   mantenha ≤ 8 testes e < 30 s.
3. Ao adicionar/remover tags, atualizar as tabelas deste documento e a linha
   de grupos na matriz de rastreabilidade.
4. Grupo que passa a falhar por defeito reproduzível do produto reprovado o
   quality gate (`docs/quality-gate.md`); grupo que falha por ambiente é
   **inconclusivo**, não aprovado.

## 8. Evidência da última execução

| Grupo | Comando | Data | Resultado |
| --- | --- | --- | --- |
| Smoke | `npm run test:smoke` | 2026-10-22 | 5/5 aprovados |
| Críticos | `npm run test:criticos` | 2026-10-22 | 25/25 aprovados |
| Regressão completa | `npm test` | 2026-10-22 | 184/184 aprovados, ~122 s |
| Latência (manual, isolada) | `npm run test:latencia` | 2026-10-22 | 4/4 aprovados, 20 amostras, ~5 s |

Evidências: relatório HTML (`playwright-report/index.html`) de cada execução e,
para a avaliação de latência, `performance-results/*.json`.
