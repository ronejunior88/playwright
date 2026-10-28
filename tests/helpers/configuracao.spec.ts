import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  carregarArquivoEnv,
  carregarConfiguracao,
  ErroConfiguracao,
  RETRIES_CI,
  TIMEOUT_ENV,
  TIMEOUT_MAXIMO_MS,
  TIMEOUT_PADRAO_MS,
  URL_BASE_ENV,
  URL_BASE_PADRAO,
  WORKERS_PADRAO,
} from './configuracao';

const chavesAmbiente: string[] = [];
const diretoriosTemporarios: string[] = [];

test.afterEach(() => {
  for (const chave of chavesAmbiente.splice(0)) {
    delete process.env[chave];
  }

  for (const diretorio of diretoriosTemporarios.splice(0)) {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test.describe('Configuração da suíte', () => {
  test('usa os padrões quando o ambiente está vazio', () => {
    expect(carregarConfiguracao({})).toEqual({
      baseURL: URL_BASE_PADRAO,
      timeout: TIMEOUT_PADRAO_MS,
      workers: WORKERS_PADRAO,
      retries: 0,
      ci: false,
    });
  });

  test('aceita URL e timeout informados e normaliza a barra final', () => {
    const configuracao = carregarConfiguracao({
      [URL_BASE_ENV]: 'https://exemplo.test/api/',
      [TIMEOUT_ENV]: '45000',
    });

    expect(configuracao.baseURL).toBe('https://exemplo.test/api');
    expect(configuracao.timeout).toBe(45_000);
  });

  test('preserva caminho e porta da URL configurada', () => {
    const configuracao = carregarConfiguracao({
      [URL_BASE_ENV]: 'http://localhost:3000/serve-rest/',
    });

    expect(configuracao.baseURL).toBe('http://localhost:3000/serve-rest');
  });

  test('aplica retries apenas quando CI é verdadeiro', () => {
    expect(carregarConfiguracao({ CI: 'true' }).retries).toBe(RETRIES_CI);
    expect(carregarConfiguracao({ CI: 'TRUE' }).retries).toBe(RETRIES_CI);
    expect(carregarConfiguracao({ CI: 'false' }).retries).toBe(0);
    expect(carregarConfiguracao({ CI: '1' }).retries).toBe(0);
  });

  test('aceita o timeout máximo e trata valor vazio como padrão', () => {
    expect(
      carregarConfiguracao({ [TIMEOUT_ENV]: String(TIMEOUT_MAXIMO_MS) })
        .timeout,
    ).toBe(TIMEOUT_MAXIMO_MS);
    expect(carregarConfiguracao({ [TIMEOUT_ENV]: '' }).timeout).toBe(
      TIMEOUT_PADRAO_MS,
    );
  });

  const urlsInvalidas = [
    ['vazia', ''],
    ['sem esquema', 'serverest.dev'],
    ['com protocolo não suportado', 'ftp://serverest.dev'],
    ['com credenciais', 'https://usuario:senha@serverest.dev'],
    ['com query string', 'https://serverest.dev?ambiente=teste'],
    ['com fragmento', 'https://serverest.dev#topo'],
  ] as const;

  for (const [rotulo, valor] of urlsInvalidas) {
    test(`rejeita URL ${rotulo}`, () => {
      expect(() =>
        carregarConfiguracao({ [URL_BASE_ENV]: valor }),
      ).toThrow(ErroConfiguracao);
    });
  }

  const timeoutsInvalidos = [
    ['texto', 'abc'],
    ['zero', '0'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['acima do limite', String(TIMEOUT_MAXIMO_MS + 1)],
  ] as const;

  for (const [rotulo, valor] of timeoutsInvalidos) {
    test(`rejeita timeout ${rotulo}`, () => {
      expect(() =>
        carregarConfiguracao({ [TIMEOUT_ENV]: valor }),
      ).toThrow(ErroConfiguracao);
    });
  }

  test('carrega .env existente sem sobrescrever variáveis já definidas', () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'serve-rest-env-'));
    diretoriosTemporarios.push(diretorio);

    const sufixo = `${process.pid}_${Date.now()}`;
    const chaveNova = `SERVE_REST_TESTE_${sufixo}`;
    const chaveExistente = `SERVE_REST_EXISTENTE_${sufixo}`;
    const arquivo = join(diretorio, '.env');

    process.env[chaveExistente] = 'externo';
    chavesAmbiente.push(chaveExistente);
    writeFileSync(
      arquivo,
      `${chaveNova}=novo\n${chaveExistente}=arquivo\n`,
      'utf8',
    );

    expect(carregarArquivoEnv(arquivo)).toBe(true);

    chavesAmbiente.push(chaveNova);
    expect(process.env[chaveNova]).toBe('novo');
    expect(process.env[chaveExistente]).toBe('externo');
  });

  test('ignora .env ausente', () => {
    const arquivo = join(tmpdir(), `serve-rest-inexistente-${process.pid}.env`);

    expect(carregarArquivoEnv(arquivo)).toBe(false);
  });
});
