import { expect, test } from '@playwright/test';
import {
  aplicarLimitesDiagnosticos,
  calcularEstatisticas,
  formatarResumo,
  media,
  mediana,
  MINIMO_AMOSTRAS_P95,
  percentil,
  type AmostraLatencia,
} from './latencia';

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

  test('resumo do console sinaliza percentil de amostra pequena', () => {
    const resumo = formatarResumo(calcularEstatisticas([amostra({ duracaoMs: 100 })]));

    expect(resumo).toContain('cenario de teste');
    expect(resumo).toContain('*');
  });
});
