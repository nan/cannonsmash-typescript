// tests/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('app loads without errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');

  // Check the title
  await expect(page).toHaveTitle(/CannonSmash/);

  // Assert that there were no console errors
  expect(consoleErrors).toHaveLength(0);
});
