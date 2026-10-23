import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  aplicarLimitesDiagnosticos,
  calcularEstatisticas,
  formatarResumo,
  media,
  mediana,
  medirRequisicao,
  MINIMO_AMOSTRAS_P95,
  percentil,
  type AmostraLatencia,
} from './latencia';

const SEGREDO = 'token-que-nao-deve-vazar';

function amostra(partial: Partial<AmostraLatencia> & { duracaoMs: number }): AmostraLatencia {
  return {
    cenario: 'cenario de teste',
    metodo: 'GET',
    endpoint: '/produtos',
    status: 200,
    resultado: 'sucesso',
    timeout: false,
    erroRede: false,
    erroHttp: false,
    ...partial,
  };
}

test.describe('Estatisticas de latencia', () => {
  test('calcula percentil por nearest-rank', () => {
    const valores = [10, 20, 30, 40, 50];

    // nearest-rank: menor valor com pelo menos p% das observacoes abaixo.
    expect(percentil(valores, 95)).toBe(50);
    expect(percentil(valores, 50)).toBe(30);
    expect(percentil(valores, 20)).toBe(10);
    expect(percentil([], 95)).toBeNull();
  });

  test('calcula mediana para quantidade par e impar de amostras', () => {
    expect(mediana([10, 20, 30])).toBe(20);
    expect(mediana([10, 20, 30, 40])).toBe(25);
    expect(mediana([])).toBeNull();
  });

  test('calcula media aritmetica', () => {
    expect(media([10, 20, 30])).toBe(20);
    expect(media([])).toBeNull();
  });

  test('ordena as amostras antes de calcular percentil e mediana', () => {
    const desordenados = [50, 10, 40, 20, 30];

    expect(percentil(desordenados, 95)).toBe(50);
    expect(percentil(desordenados, 20)).toBe(10);
    expect(mediana([30, 10, 20])).toBe(20);
    expect(mediana([40, 10, 30, 20])).toBe(25);
  });

  test('agrupa amostras por cenário, método e endpoint', () => {
    const amostras: AmostraLatencia[] = [
      amostra({ cenario: 'listagem', duracaoMs: 100 }),
      amostra({ cenario: 'listagem', duracaoMs: 200 }),
      amostra({
        cenario: 'login',
        metodo: 'POST',
        endpoint: '/login',
        duracaoMs: 300,
      }),
    ];

    const estatisticas = calcularEstatisticas(amostras);

    expect(estatisticas).toHaveLength(2);
    expect(estatisticas[0].amostras).toBe(2);
    expect(estatisticas[1].amostras).toBe(1);
  });

  test('separa amostras validas de timeouts e erros http', () => {
    const amostras: AmostraLatencia[] = [
      amostra({ duracaoMs: 100 }),
      amostra({ duracaoMs: 200 }),
      amostra({ duracaoMs: 300 }),
      amostra({ duracaoMs: 400 }),
      amostra({ duracaoMs: 500 }),
      amostra({
        duracaoMs: 15000,
        status: null,
        resultado: 'timeout',
        timeout: true,
      }),
      amostra({
        duracaoMs: 120,
        status: 500,
        resultado: 'erro-http',
        erroHttp: true,
      }),
      amostra({
        duracaoMs: 80,
        status: null,
        resultado: 'erro-rede',
        erroRede: true,
      }),
    ];

    const [estatistica] = calcularEstatisticas(amostras);

    expect(estatistica.amostras).toBe(8);
    expect(estatistica.validas).toBe(5);
    expect(estatistica.timeouts).toBe(1);
    expect(estatistica.errosHttp).toBe(1);
    expect(estatistica.errosRede).toBe(1);
    expect(estatistica.minimoMs).toBe(100);
    expect(estatistica.maximoMs).toBe(500);
    expect(estatistica.mediaMs).toBe(300);
    expect(estatistica.medianaMs).toBe(300);
    expect(estatistica.p95Ms).toBe(500);
  });

  test('marca p95 como nao confiavel quando a amostra e pequena', () => {
    const poucas = Array.from({ length: 5 }, (_, indice) =>
      amostra({ duracaoMs: 100 + indice }),
    );

    expect(calcularEstatisticas(poucas)[0].p95Confiavel).toBe(false);
  });

  test('marca p95 como confiavel a partir do minimo de amostras', () => {
    const suficientes = Array.from(
      { length: MINIMO_AMOSTRAS_P95 },
      (_, indice) => amostra({ duracaoMs: 100 + indice }),
    );

    expect(calcularEstatisticas(suficientes)[0].p95Confiavel).toBe(true);
  });

  test('conta amostras acima do limite experimental sem alterar o resultado', () => {
    const amostras: AmostraLatencia[] = [
      amostra({ cenario: 'listagem', duracaoMs: 100 }),
      amostra({ cenario: 'listagem', duracaoMs: 900 }),
      amostra({ cenario: 'listagem', duracaoMs: 1200 }),
    ];

    const [estatistica] = aplicarLimitesDiagnosticos(
      calcularEstatisticas(amostras),
      amostras,
      { listagem: 1000 },
    );

    expect(estatistica.limiteDiagnosticoMs).toBe(1000);
    expect(estatistica.acimaDoLimite).toBe(1);
    expect(estatistica.maximoMs).toBe(1200);
  });

  test('conta apenas amostras válidas acima do limite e por cenário', () => {
    const amostras: AmostraLatencia[] = [
      amostra({ cenario: 'listagem', duracaoMs: 1000 }),
      amostra({ cenario: 'listagem', duracaoMs: 1001 }),
      amostra({
        cenario: 'listagem',
        duracaoMs: 5000,
        status: 500,
        resultado: 'erro-http',
        erroHttp: true,
      }),
      amostra({ cenario: 'detalhe', duracaoMs: 5000 }),
    ];

    const resultado = aplicarLimitesDiagnosticos(
      calcularEstatisticas(amostras),
      amostras,
      { listagem: 1000 },
    );

    const listagem = resultado.find(
      (estatistica) => estatistica.cenario === 'listagem',
    )!;
    const detalhe = resultado.find(
      (estatistica) => estatistica.cenario === 'detalhe',
    )!;

    expect(listagem.limiteDiagnosticoMs).toBe(1000);
    expect(listagem.acimaDoLimite).toBe(1);
    expect(detalhe.limiteDiagnosticoMs).toBeUndefined();
    expect(detalhe.acimaDoLimite).toBeUndefined();
  });

  test('resumo do console sinaliza percentil de amostra pequena', () => {
    const resumo = formatarResumo(calcularEstatisticas([amostra({ duracaoMs: 100 })]));

    expect(resumo).toContain('cenario de teste');
    expect(resumo).toContain('*');
  });

  test('resumo do console inclui cabeçalhos, colunas e total de falhas', () => {
    const estatisticas = calcularEstatisticas([
      amostra({ cenario: 'listagem', duracaoMs: 100 }),
      amostra({ cenario: 'listagem', duracaoMs: 300 }),
      amostra({
        cenario: 'listagem',
        duracaoMs: 50,
        status: 500,
        resultado: 'erro-http',
        erroHttp: true,
      }),
      amostra({
        cenario: 'listagem',
        duracaoMs: 60,
        status: null,
        resultado: 'timeout',
        timeout: true,
      }),
      amostra({
        cenario: 'listagem',
        duracaoMs: 70,
        status: null,
        resultado: 'erro-rede',
        erroRede: true,
      }),
    ]);

    const resumo = formatarResumo(estatisticas);
    const linhas = resumo.split('\n');
    const cabecalho = linhas[0].trim().split(/\s+/);
    const colunas = linhas[1].trim().split(/\s+/);

    expect(cabecalho).toEqual([
      'cenario',
      'n',
      'min(ms)',
      'media(ms)',
      'mediana(ms)',
      'max(ms)',
      'p95(ms)',
      'falhas',
    ]);
    expect(colunas).toEqual([
      'listagem',
      '2',
      '100',
      '200',
      '200',
      '300',
      '300*',
      '3',
    ]);
    expect(linhas[linhas.length - 2]).toBe('');
    expect(resumo).toContain('* p95 de amostra pequena');
  });

  test('resumo do console usa hífen quando não há amostras válidas', () => {
    const resumo = formatarResumo(
      calcularEstatisticas([
        amostra({
          cenario: 'listagem',
          duracaoMs: 50,
          status: 500,
          resultado: 'erro-http',
          erroHttp: true,
        }),
      ]),
    );

    const colunas = resumo
      .split('\n')
      .find((linha) => linha.startsWith('listagem'))!
      .trim()
      .split(/\s+/);

    expect(colunas).toEqual(['listagem', '0', '-', '-', '-', '-', '-*', '1']);
  });

  test('resumo do console não marca p95 confiável com asterisco', () => {
    const suficientes = calcularEstatisticas(
      Array.from({ length: MINIMO_AMOSTRAS_P95 }, (_, indice) =>
        amostra({ cenario: 'listagem', duracaoMs: 100 + indice }),
      ),
    );

    const colunas = formatarResumo(suficientes)
      .split('\n')
      .find((linha) => linha.startsWith('listagem'))!
      .trim()
      .split(/\s+/);

    expect(colunas[6]).toBe('118');
    expect(colunas.join(' ')).not.toContain('*');
  });
});

function requisicaoFalsa(resposta: {
  status: number;
  corpo?: unknown;
  falha?: Error;
}) {
  const chamadas: Array<{
    endpoint: string;
    opcoes: Record<string, unknown>;
  }> = [];

  const request = {
    fetch: async (endpoint: string, opcoes: Record<string, unknown>) => {
      chamadas.push({ endpoint, opcoes });
      if (resposta.falha) {
        throw resposta.falha;
      }
      return {
        status: () => resposta.status,
        json: async () => resposta.corpo,
      };
    },
  } as unknown as APIRequestContext;

  return { request, chamadas };
}

const MEDICAO = {
  cenario: 'listagem',
  metodo: 'GET' as const,
  endpoint: '/produtos',
};

test.describe('Medicao de requisicoes', () => {
  test('classifica resposta bem-sucedida e preserva o corpo', async () => {
    const { request, chamadas } = requisicaoFalsa({
      status: 201,
      corpo: { ok: true },
    });

    const resultado = await medirRequisicao(request, MEDICAO);

    expect(resultado.amostra.resultado).toBe('sucesso');
    expect(resultado.amostra.status).toBe(201);
    expect(resultado.amostra.timeout).toBe(false);
    expect(resultado.amostra.erroRede).toBe(false);
    expect(resultado.amostra.erroHttp).toBe(false);
    expect(resultado.corpo).toEqual({ ok: true });
    expect(resultado.amostra.duracaoMs).toBeGreaterThanOrEqual(0);
    expect(chamadas[0].opcoes.timeout).toBe(15000);
  });

  test('classifica respostas HTTP nos limites de sucesso', async () => {
    const casos: Array<[number, string]> = [
      [199, 'erro-http'],
      [200, 'sucesso'],
      [399, 'sucesso'],
      [400, 'erro-http'],
      [500, 'erro-http'],
    ];

    for (const [status, esperado] of casos) {
      const { request } = requisicaoFalsa({ status, corpo: {} });
      const resultado = await medirRequisicao(request, MEDICAO);

      expect(resultado.amostra.resultado, String(status)).toBe(esperado);
      expect(resultado.amostra.erroHttp, String(status)).toBe(
        esperado === 'erro-http',
      );
    }
  });

  test('usa o timeout informado na requisição', async () => {
    const { request, chamadas } = requisicaoFalsa({ status: 200, corpo: {} });

    await medirRequisicao(request, { ...MEDICAO, timeoutMs: 1234 });

    expect(chamadas[0].opcoes.timeout).toBe(1234);
  });

  test('classifica timeout pelo tipo do erro', async () => {
    const erro = new Error('falha de transporte');
    erro.name = 'TimeoutError';
    const { request } = requisicaoFalsa({ status: 0, falha: erro });

    const resultado = await medirRequisicao(request, MEDICAO);

    expect(resultado.amostra.resultado).toBe('timeout');
    expect(resultado.amostra.timeout).toBe(true);
    expect(resultado.amostra.erroRede).toBe(false);
    expect(resultado.amostra.erroHttp).toBe(false);
    expect(resultado.amostra.status).toBeNull();
    expect(resultado.corpo).toBeUndefined();
  });

  test('classifica timeout pelas mensagens conhecidas', async () => {
    const mensagens = [
      'request timeout',
      'request timed out',
      'tempo limite excedido',
      'excedeu o tempo',
    ];

    for (const mensagem of mensagens) {
      const { request } = requisicaoFalsa({
        status: 0,
        falha: new Error(mensagem),
      });

      const resultado = await medirRequisicao(request, MEDICAO);

      expect(resultado.amostra.resultado, mensagem).toBe('timeout');
    }
  });

  test('classifica falha de rede e sanitiza a observação', async () => {
    const { request } = requisicaoFalsa({
      status: 0,
      falha: new Error(`conexão recusada com Bearer ${SEGREDO}`),
    });

    const resultado = await medirRequisicao(request, MEDICAO);

    expect(resultado.amostra.resultado).toBe('erro-rede');
    expect(resultado.amostra.erroRede).toBe(true);
    expect(resultado.amostra.timeout).toBe(false);
    expect(resultado.amostra.observacao).not.toContain(SEGREDO);
    expect(resultado.amostra.observacao).toContain('[REDACTED]');
  });

  test('limita a observação a 200 caracteres', async () => {
    const { request } = requisicaoFalsa({
      status: 0,
      falha: new Error('x'.repeat(300)),
    });

    const resultado = await medirRequisicao(request, MEDICAO);

    expect(resultado.amostra.observacao).toHaveLength(200);
  });
});
