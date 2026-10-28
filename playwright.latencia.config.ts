import { defineConfig } from '@playwright/test';
import {
  carregarArquivoEnv,
  carregarConfiguracao,
} from './tests/helpers/configuracao';

carregarArquivoEnv();
const { baseURL } = carregarConfiguracao();

/**
 * Configuracao isolada da avaliacao de latencia da API.
 *
 * - `testDir` restrito a `tests/performance`: a regressao funcional nao
 *   executa esta suite (o config principal ignora esse diretorio);
 * - `workers: 1` e `fullyParallel: false`: as amostras sao coletadas de forma
 *   sequencial, sem concorrência e sem efeito de carga;
 * - reporter `list` apenas: nao abre navegador nem sobrescreve o relatorio
 *   HTML/JSON do pipeline funcional;
 * - timeout de teste folgado para caber as amostras, com timeout curto por
 *   requisicao definido na propria suite.
 */
export default defineConfig({
  testDir: './tests/performance',
  fullyParallel: false,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});
