import { defineConfig } from '@playwright/test';

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
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all tests. See https://playwright.dev/docs/api/class-testoptions */
  use: {
    baseURL: 'https://serverest.dev',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});