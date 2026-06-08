import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

  //Expects page to have a text with 'Playwright Test is an end-to-end'.
  await expect(page.getByText('Playwright Test is an end-to-end' )).toBeVisible();

  //Expects page to have a link with href '/docs/intro#installing-playwright'.
  await expect(page.getByRole('link',{ name: 'How to install Playwright' })).toHaveAttribute('href','/docs/intro#installing-playwright');
});
