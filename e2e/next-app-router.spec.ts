import { expect, test } from '@playwright/test';

test('next app router example serves editor content in the initial HTML', async ({ page }) => {
  const response = await page.request.get('http://localhost:4174');
  expect(response.ok()).toBeTruthy();

  const html = await response.text();
  expect(html).toContain('Next.js App Router + Inkio Extensions');
  expect(html).toContain('Inkio in Next.js');
  expect(html).not.toContain('Loading editor...');
});

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

test('next app router example opens the image editor from an inserted image block', async ({ page }) => {
  await page.goto('http://localhost:4174');

  await page.getByTestId('next-editor-insert-demo-image').click();
  await expect(page.locator('.inkio-image-block-container')).toHaveCount(1);

  await page.locator('.inkio-image-block-container').hover();
  await page.getByTestId('inkio-image-block-edit').click();

  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  const frameBox = await page.getByTestId('inkio-ie-stage-frame').boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox!.width).toBeGreaterThan(600);
  expect(frameBox!.height).toBeGreaterThan(400);
  await page.getByTestId('inkio-ie-close').click();
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeHidden();
});

test('next app router example inserts an image from the slash command without a transaction error', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('http://localhost:4174');

  const editor = page.locator('.ProseMirror').first();
  await editor.evaluate((node) => {
    const element = node as HTMLElement;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/image');
  await expect(page.getByRole('option', { name: 'Image' })).toBeVisible();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('option', { name: 'Image' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'slash-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9lQAAAAASUVORK5CYII=',
      'base64',
    ),
  });

  await expect(page.locator('.inkio-image-block-container')).toHaveCount(1);
  expect(pageErrors).not.toEqual(
    expect.arrayContaining([expect.stringContaining('Applying a mismatched transaction')]),
  );
});
