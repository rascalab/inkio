import { expect, test } from '@playwright/test';

test('basic React example renders and serializes edits', async ({ page }) => {
  await page.goto('http://localhost:4173');

  await expect(page.getByRole('heading', { name: 'Basic React + Inkio Simple' })).toBeVisible();

  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.type(' Smoke E2E');

  await expect(page.locator('pre').first()).toContainText('Smoke E2E');
});
