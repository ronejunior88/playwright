import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import { lerJson } from '../helpers/resposta';
import {
  validarListaCarrinhos,
  validarListaProdutos,
  validarListaUsuarios,
  validarProduto,
} from '../helpers/contrato';
import {
  aplicarLimitesDiagnosticos,
  calcularEstatisticas,
  formatarResumo,
  medirRequisicao,
  type AmostraLatencia,
  type MetodoMedido,
} from '../helpers/latencia';

/**
 * Suíte de avaliação de latência da API.
 *
 * Características obrigatórias desta etapa:
 * - somente requisições GET de baixo impacto (leituras), sem criação nem
 *   alteração de dados;
 * - amostras fixas e sequenciais: sem concorrência, sem teste de carga;
 * - execução isolada da regressão funcional (config dedicado), para não
 *   misturar métricas de desempenho com os resultados funcionais;
 * - os limites usados são hipóteses locais de diagnóstico, não SLAs, e
 *   nunca reprovam a execução por causa de uma amostra lenta isolada.
 */

/** Quantidade fixa de amostras por cenário. */
const AMOSTRAS_POR_CENARIO = 5;

/** Timeout por requisição: acima disso a amostra é contada como timeout. */
const TIMEOUT_REQUISICAO_MS = 10_000;

/** Artefatos de medição ficam fora do controle de versão. */
const DIRETORIO_RESULTADOS = 'performance-results';

interface Cenario {
  nome: string;
  metodo: MetodoMedido;
  endpoint: string;
  /** Hipótese local de tempo aceitável; não é SLA. */
  limiteDiagnosticoMs: number;
  validar: (corpo: unknown) => void;
}

const CENARIOS: Cenario[] = [
  {
    nome: 'listagem de usuarios',
    metodo: 'GET',
    endpoint: '/usuarios',
    limiteDiagnosticoMs: 2000,
    validar: validarListaUsuarios,
  },
  {
    nome: 'listagem de produtos',
    metodo: 'GET',
    endpoint: '/produtos',
    limiteDiagnosticoMs: 2000,
    validar: validarListaProdutos,
  },
  {
    nome: 'listagem de carrinhos',
    metodo: 'GET',
    endpoint: '/carrinhos',
    limiteDiagnosticoMs: 2500,
    validar: validarListaCarrinhos,
  },
];

const amostras: AmostraLatencia[] = [];

function carimbo(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function coletar(
  request: APIRequestContext,
  cenario: Cenario,
): Promise<void> {
  for (let indice = 1; indice <= AMOSTRAS_POR_CENARIO; indice += 1) {
    const { amostra, corpo } = await medirRequisicao(request, {
      cenario: cenario.nome,
      metodo: cenario.metodo,
      endpoint: cenario.endpoint,
      timeoutMs: TIMEOUT_REQUISICAO_MS,
    });

    amostras.push(amostra);

    // As assertions são funcionais. Latência não reprova: apenas é medida.
    expect(
      amostra.timeout,
      `timeout na amostra ${indice} de ${cenario.nome}`,
    ).toBe(false);
    expect(
      amostra.erroRede,
      `falha de rede na amostra ${indice} de ${cenario.nome}`,
    ).toBe(false);
    expect(
      amostra.status,
      `status HTTP inesperado na amostra ${indice} de ${cenario.nome}`,
    ).toBe(200);
    expect(
      amostra.resultado,
      `resultado inesperado na amostra ${indice} de ${cenario.nome}`,
    ).toBe('sucesso');

    cenario.validar(corpo);
  }
}

test.describe('Avaliacao de latencia da API', () => {
  for (const cenario of CENARIOS) {
    test(`mede a latencia de ${cenario.nome}`, async ({ request }) => {
      await coletar(request, cenario);
    });
  }

  test('mede a latencia da consulta de produto por id', async ({ request }) => {
    // Preparação fora da janela de medição: a listagem usada para obter o id
    // não é registrada como amostra de latência.
    const preparacao = await request.get('/produtos');
    const lista = await lerJson<{
      produtos: Array<{ _id?: string }>;
    }>(preparacao, 200);
    const id = lista.produtos[0]?._id;

    expect(
      id,
      'a API deve expor ao menos um produto para a medicao por id',
    ).toBeTruthy();

    await coletar(request, {
      nome: 'consulta de produto por id',
      metodo: 'GET',
      endpoint: `/produtos/${id}`,
      limiteDiagnosticoMs: 1500,
      validar: validarProduto,
    });
  });

  test.afterAll(async ({ baseURL }) => {
    const limites = Object.fromEntries(
      CENARIOS.map((cenario) => [cenario.nome, cenario.limiteDiagnosticoMs]),
    );
    limites['consulta de produto por id'] = 1500;

    const estatisticas = aplicarLimitesDiagnosticos(
      calcularEstatisticas(amostras),
      amostras,
      limites,
    );

    console.log(`\n${formatarResumo(estatisticas)}`);
    console.log(
      'Limites locais sao hipoteses de diagnostico, nao SLAs; nenhuma amostra lenta reprova a execucao.',
    );

    const payload = {
      geradoEm: new Date().toISOString(),
      api: baseURL ?? null,
      amostrasPorCenario: AMOSTRAS_POR_CENARIO,
      timeoutRequisicaoMs: TIMEOUT_REQUISICAO_MS,
      observacoes: [
        'Amostras pequenas: percentil 95 indica tendencia, nao desempenho sustentado.',
        'Limites registrados sao hipoteses locais de diagnostico, sem qualquer SLA.',
        'Somente requisicoes GET de leitura foram executadas.',
      ],
      resumo: estatisticas,
      amostras,
    };

    const diretorio = resolve(process.cwd(), DIRETORIO_RESULTADOS);
    mkdirSync(diretorio, { recursive: true });
    const arquivo = resolve(diretorio, `latencia-${carimbo()}.json`);
    writeFileSync(arquivo, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`Metricas de latencia gravadas em ${arquivo}`);
  });
});
