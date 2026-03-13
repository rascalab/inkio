import { expect, test } from '@playwright/test';

test('next app router example renders extensions and serializes edits', async ({ page }) => {
  await page.goto('http://localhost:4174');

  await expect(page.getByRole('heading', { name: 'Next.js App Router + Inkio Extensions' })).toBeVisible();

  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  await editor.hover();
  await expect(page.locator('[aria-label="Block handle"]')).toHaveCount(1);

  await editor.click();
  await page.keyboard.type(' Smoke Next');

  await expect(page.locator('pre').first()).toContainText('Smoke Next');
});
