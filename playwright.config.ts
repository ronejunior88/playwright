import { defineConfig, type ReporterDescription } from '@playwright/test';

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { open: 'never' }],
  ['json', { outputFile: 'test-results/results.json' }],
];

if (process.env.CI) {
  reporters.push(['github']);
}

export default defineConfig({
  testDir: './tests',
  /*
   * A avaliacao de latencia roda em config proprio (playwright.latencia.config.ts).
   * Fica de fora da regressao funcional para nao misturar metricas de
   * desempenho com os resultados funcionais nem adicionar chamadas a API.
   */
  testIgnore: '**/performance/**',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Timeout explicito por teste: a suite e 100% de API, sem navegador. */
  timeout: 30_000,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /*
   * 1 worker: a API publica compartilhada limita a taxa de requisicoes por IP.
   * Com 2 workers (~20 req/s) o health check (GET, somente leitura) ja recebe
   * HTTP 429; com 1 worker (~10 req/s) a su inteira passa. Use
   * `npm run test:paralelo` apenas quando o ambiente permitir.
   */
  workers: 1,
  /* Reporters: terminal (list), HTML e JSON; no CI adiciona anotacoes do GitHub. */
  reporter: [['html', { open: 'always' }]], 
  /* Shared settings for all tests. See https://playwright.dev/docs/api/class-testoptions */
  use: {
    baseURL: 'https://serverest.dev',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});