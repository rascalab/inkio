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

test('classic editor keeps the phone toolbar usable and its popover on the editor palette', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('http://localhost:4173');
  const theme = page.getByLabel('Editor theme');
  const editor = page.getByRole('textbox', { name: 'Rich text editor' });
  const toolbar = page.getByRole('toolbar', { name: 'Editor toolbar' });
  await expect(toolbar).toBeVisible();
  await expect(editor).toBeVisible();
  expect((await toolbar.boundingBox())!.height).toBeLessThan(68);

  await theme.selectOption('custom');
  await editor.getByRole('heading', { name: 'Hello Inkio' }).click({ clickCount: 3 });
  const link = toolbar.getByRole('button', { name: 'Add link', exact: true });
  await link.press('Enter');
  const dialog = page.getByRole('dialog');
  const field = dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  const panelPixel = () => dialog.locator('.inkio-link-popover').evaluate((panel) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = getComputedStyle(panel).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  });
  const [red, green, blue, alpha] = await panelPixel();
  expect(red).toBeGreaterThan(235);
  expect(green).toBeGreaterThan(220);
  expect(blue).toBeGreaterThan(210);
  expect(alpha).toBe(255);
  await field.fill('https://example.com');
  // A narrow toolbar can scroll the anchor away while its dialog stays open.
  await toolbar.getByRole('button').first().scrollIntoViewIfNeeded();
  const save = dialog.getByRole('button', { name: 'Save' });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(save).toBeInViewport({ ratio: 1 });
  await save.click();
  await expect(editor.getByRole('link', { name: 'Hello Inkio' })).toHaveAttribute('href', 'https://example.com');

  await theme.selectOption('dark');
  await expect(toolbar).not.toHaveCSS('background-color', 'rgb(247, 237, 216)');
  await link.press('Enter');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('https://example.com');
  const dark = await panelPixel();
  expect(Math.max(...dark.slice(0, 3))).toBeLessThan(40);
  expect(dark[3]).toBe(255);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(editor).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
