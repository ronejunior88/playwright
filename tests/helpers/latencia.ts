import { performance } from 'node:perf_hooks';
import type { APIRequestContext } from '@playwright/test';
import { sanitizarTexto } from './diagnostico';

/**
 * Tipos de método aceitos pela medição. A suíte de desempenho usa apenas
 * `GET`: leituras não alteram dados nem exigem limpeza de recursos criados.
 */
export type MetodoMedido = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Classificação do desfecho de uma requisição. Mantém separado o que é
 * falha de transporte (timeout/rede) do que é resposta HTTP válida e do que
 * é falha funcional (status de erro).
 */
export type ResultadoFuncional =
  | 'sucesso'
  | 'erro-http'
  | 'timeout'
  | 'erro-rede';

export interface AmostraLatencia {
  /** Nome lógico do cenário, estável entre execuções. */
  cenario: string;
  metodo: MetodoMedido;
  /** Endpoint sem query string e sanitizado. */
  endpoint: string;
  /** Status HTTP; `null` quando não houve resposta. */
  status: number | null;
  /** Tempo total da chamada HTTP em milissegundos. */
  duracaoMs: number;
  resultado: ResultadoFuncional;
  timeout: boolean;
  erroRede: boolean;
  erroHttp: boolean;
  /** Mensagem curta e sanitizada, apenas quando houve erro. */
  observacao?: string;
}

export interface MedicaoRequest {
  cenario: string;
  metodo: MetodoMedido;
  endpoint: string;
  /** Timeout da requisição; padrão: 15 s. */
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ResultadoMedicao {
  amostra: AmostraLatencia;
  /**
   * Corpo da resposta, mantido apenas em memória para as assertions do
   * cenário. Nunca é persistido no arquivo de métricas.
   */
  corpo: unknown;
}

export interface EstatisticasLatencia {
  cenario: string;
  metodo: MetodoMedido;
  endpoint: string;
  /** Total de amostras coletas (válidas + falhas). */
  amostras: number;
  /** Amostras com resposta HTTP bem-sucedida. */
  validas: number;
  /** Respostas HTTP com status de erro. */
  errosHttp: number;
  /** Requisições que estouraram o timeout. */
  timeouts: number;
  /** Falhas de conexão/rede sem resposta HTTP. */
  errosRede: number;
  minimoMs: number | null;
  maximoMs: number | null;
  mediaMs: number | null;
  medianaMs: number | null;
  p95Ms: number | null;
  /**
   * `false` quando a amostra é pequena demais para que o percentil seja
   * interpretado como desempenho sustentado.
   */
  p95Confiavel: boolean;
  /**
   * Limite experimental local (hipótese de trabalho). Não é SLA e não
   * provoca falha de teste: serve apenas como sinal de diagnóstico.
   */
  limiteDiagnosticoMs?: number;
  /** Quantidade de amostras acima do limite experimental. */
  acimaDoLimite?: number;
}

/**
 * Quantidade mínima de amostras para que o percentil 95 seja interpretável
 * como indicação de desempenho sustentado. Abaixo disso o valor é exibido
 * como informação de tendencies, não como garantia.
 */
export const MINIMO_AMOSTRAS_P95 = 20;

const TIMEOUT_PADRAO_MS = 15_000;

function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function ehTimeout(erro: unknown, mensagem: string): boolean {
  if (erro instanceof Error && erro.name === 'TimeoutError') {
    return true;
  }
  const normalizada = mensagem.toLowerCase();
  return (
    normalizada.includes('timeout') ||
    normalizada.includes('timed out') ||
    normalizada.includes('tempo limite') ||
    normalizada.includes('excedeu o tempo')
  );
}

/**
 * Executa uma requisição medindo o tempo de ida e volta.
 *
 * O tempo medido cobre **apenas** a chamada HTTP (envio + recebimento do
 * corpo); preparação de dados (criação de contas, busca de ids) fica fora da
 * janela. Falhas de transporte são capturadas e classificadas — nunca
 * confundidas com falha de assertion, que continua sendo responsabilidade
 * do cenário.
 */
export async function medirRequisicao(
  request: APIRequestContext,
  medicao: MedicaoRequest,
): Promise<ResultadoMedicao> {
  const inicio = performance.now();
  let status: number | null = null;
  let corpo: unknown;
  let erro: unknown;

  try {
    const resposta = await request.fetch(medicao.endpoint, {
      method: medicao.metodo,
      headers: medicao.headers,
      timeout: medicao.timeoutMs ?? TIMEOUT_PADRAO_MS,
    });
    status = resposta.status();
    corpo = await resposta.json().catch(() => undefined);
  } catch (capturado) {
    erro = capturado;
  }

  const duracaoMs = arredondar(performance.now() - inicio);

  if (erro !== undefined) {
    const mensagem = sanitizarTexto((erro as Error).message ?? '');
    const foiTimeout = ehTimeout(erro, mensagem);
    return {
      amostra: {
        cenario: medicao.cenario,
        metodo: medicao.metodo,
        endpoint: sanitizarTexto(medicao.endpoint),
        status: null,
        duracaoMs,
        resultado: foiTimeout ? 'timeout' : 'erro-rede',
        timeout: foiTimeout,
        erroRede: !foiTimeout,
        erroHttp: false,
        observacao: mensagem.slice(0, 200),
      },
      corpo: undefined,
    };
  }

  const statusHttp = status ?? 0;
  const bemSucedido = statusHttp >= 200 && statusHttp < 400;

  return {
    amostra: {
      cenario: medicao.cenario,
      metodo: medicao.metodo,
      endpoint: sanitizarTexto(medicao.endpoint),
      status: statusHttp,
      duracaoMs,
      resultado: bemSucedido ? 'sucesso' : 'erro-http',
      timeout: false,
      erroRede: false,
      erroHttp: !bemSucedido,
    },
    corpo,
  };
}

function ordenar(valores: number[]): number[] {
  return [...valores].sort((a, b) => a - b);
}

/**
 * Percentil por nearest-rank (ceil(p/100 * n) - 1 na amostra ordenada).
 * Método escolhido por ser explicável e não inventar valores entre amostras.
 */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) {
    return null;
  }
  const ordenados = ordenar(valores);
  const indice = Math.ceil((p / 100) * ordenados.length) - 1;
  const seguro = Math.min(Math.max(indice, 0), ordenados.length - 1);
  return ordenados[seguro];
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) {
    return null;
  }
  const ordenados = ordenar(valores);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) {
    return ordenados[meio];
  }
  return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export function media(valores: number[]): number | null {
  if (valores.length === 0) {
    return null;
  }
  const soma = valores.reduce((total, valor) => total + valor, 0);
  return soma / valores.length;
}

/**
 * Agrega as amostras por cenário e calcula as métricas. Apenas amostras com
 * resposta HTTP bem-sucedida entram nas métricas de latência; timeouts,
 * erros de rede e erros HTTP são contabilizados à parte, para que uma falha
 * de transporte nunca seja diluída dentro de uma média.
 */
export function calcularEstatisticas(
  amostras: AmostraLatencia[],
): EstatisticasLatencia[] {
  const grupos = new Map<string, AmostraLatencia[]>();

  for (const amostra of amostras) {
    const chave = `${amostra.cenario}|${amostra.metodo}|${amostra.endpoint}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.push(amostra);
    } else {
      grupos.set(chave, [amostra]);
    }
  }

  const resultado: EstatisticasLatencia[] = [];

  for (const grupo of grupos.values()) {
    const primeira = grupo[0];
    const validas = grupo.filter((a) => a.resultado === 'sucesso');
    const duracoes = validas.map((a) => a.duracaoMs);

    resultado.push({
      cenario: primeira.cenario,
      metodo: primeira.metodo,
      endpoint: primeira.endpoint,
      amostras: grupo.length,
      validas: validas.length,
      errosHttp: grupo.filter((a) => a.erroHttp).length,
      timeouts: grupo.filter((a) => a.timeout).length,
      errosRede: grupo.filter((a) => a.erroRede).length,
      minimoMs: duracoes.length ? arredondar(Math.min(...duracoes)) : null,
      maximoMs: duracoes.length ? arredondar(Math.max(...duracoes)) : null,
      mediaMs: duracoes.length ? arredondar(media(duracoes)!) : null,
      medianaMs: duracoes.length ? arredondar(mediana(duracoes)!) : null,
      p95Ms: duracoes.length ? arredondar(percentil(duracoes, 95)!) : null,
      p95Confiavel: duracoes.length >= MINIMO_AMOSTRAS_P95,
    });
  }

  return resultado;
}

/**
 * Anexa os limites experimentais (hipóteses de trabalho locais) e conta as
 * amostras acima deles. Não provoca falha: é sinal de diagnóstico.
 */
export function aplicarLimitesDiagnosticos(
  estatisticas: EstatisticasLatencia[],
  amostras: AmostraLatencia[],
  limites: Record<string, number>,
): EstatisticasLatencia[] {
  return estatisticas.map((estatistica) => {
    const limite = limites[estatistica.cenario];
    if (limite === undefined) {
      return estatistica;
    }
    const acima = amostras.filter(
      (a) =>
        a.cenario === estatistica.cenario &&
        a.resultado === 'sucesso' &&
        a.duracaoMs > limite,
    ).length;
    return {
      ...estatistica,
      limiteDiagnosticoMs: limite,
      acimaDoLimite: acima,
    };
  });
}

/** Resumo legível para o console, sem qualquer dado sensível. */
export function formatarResumo(estatisticas: EstatisticasLatencia[]): string {
  const cabecalhos = [
    'cenario',
    'n',
    'min(ms)',
    'media(ms)',
    'mediana(ms)',
    'max(ms)',
    'p95(ms)',
    'falhas',
  ];

  const linhas = estatisticas.map((e) => [
    e.cenario,
    String(e.validas),
    String(e.minimoMs ?? '-'),
    String(e.mediaMs ?? '-'),
    String(e.medianaMs ?? '-'),
    String(e.maximoMs ?? '-'),
    `${e.p95Ms ?? '-'}${e.p95Confiavel ? '' : '*'}`,
    String(e.errosHttp + e.timeouts + e.errosRede),
  ]);

  const larguras = cabecalhos.map((cabecalho, coluna) =>
    Math.max(
      cabecalho.length,
      ...linhas.map((linha) => linha[coluna].length),
    ),
  );

  const formatar = (celulas: string[]): string =>
    celulas
      .map((celula, coluna) =>
        coluna === 0
          ? celula.padEnd(larguras[coluna])
          : celula.padStart(larguras[coluna]),
      )
      .join('  ');

  return [
    formatar(cabecalhos),
    ...linhas.map(formatar),
    '',
    '* p95 de amostra pequena: apenas tendencia, nao desempenho sustentado.',
  ].join('\n');
}
