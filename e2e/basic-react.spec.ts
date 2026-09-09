import { expect, test } from '@playwright/test';

test('basic React example renders and serializes edits', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('http://localhost:4173');

  await expect(page.getByRole('heading', { name: 'Basic React + Inkio Simple' })).toBeVisible();

  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  // Seeded HTML content renders inside the editor.
  await expect(editor).toContainText('Hello Inkio');

  // Default simple UI shows the persistent toolbar.
  await expect(page.getByRole('toolbar', { name: 'Editor toolbar' })).toBeVisible();

  await editor.click();
  await page.keyboard.type(' Smoke E2E');

  await expect(page.locator('pre').first()).toContainText('Smoke E2E');

  // Toolbar bold applies to subsequently typed text and serializes as a mark.
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' BoldCheck');
  const jsonOutput = page.locator('pre').first();
  await expect(jsonOutput).toContainText('BoldCheck');
  await expect(jsonOutput).toContainText('"bold"');

  expect(pageErrors).toEqual([]);
});
