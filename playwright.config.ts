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
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit workers: the public ServeRest API returns HTTP 429 with high parallelism. */
  workers: process.env.CI ? 1 : 2,
  /* Reporters: terminal (list), HTML e JSON; no CI adiciona anotacoes do GitHub. */
  reporter: reporters,
  /* Shared settings for all tests. See https://playwright.dev/docs/api/class-testoptions */
  use: {
    baseURL: 'https://serverest.dev',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});