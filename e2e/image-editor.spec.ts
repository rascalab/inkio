import { expect, test, type Locator, type Page } from '@playwright/test';

const HARNESS_URL = process.env.INKIO_IMAGE_EDITOR_E2E_URL ?? 'http://localhost:4174/image-editor-e2e';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

async function waitForHarness(page: Page) {
  await page.goto(HARNESS_URL);
  await expect(page.getByTestId('image-editor-e2e-fixture-state')).toContainText('ready');
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
}

async function expectImagePixelsChanged(page: Page, originalSrc: string | null, editedSrc: string | null) {
  const comparison = await page.evaluate(async ({ originalSrc, editedSrc }) => {
    const readPixels = async (src: string | null) => {
      if (!src) throw new Error('Image source is missing.');
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2d context.');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [original, edited] = await Promise.all([readPixels(originalSrc), readPixels(editedSrc)]);
    return {
      sameDimensions: original.width === edited.width && original.height === edited.height,
      // Ignore small differences introduced by decoding and re-encoding PNG pixels.
      changed: original.data.some((value, index) => Math.abs(value - edited.data[index]) > 8),
    };
  }, { originalSrc, editedSrc });

  expect(comparison.sameDimensions).toBe(true);
  expect(comparison.changed).toBe(true);
}

async function getStageFrameBox(page: Page) {
  const box = await page.getByTestId('inkio-ie-stage-frame').boundingBox();
  if (!box) {
    throw new Error('Stage frame is not visible.');
  }

  return box;
}

async function getTextSelectionEdges(page: Page) {
  return page.locator('.konvajs-content canvas').last().evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Expected selection canvas.');
    const context = canvas.getContext('2d');
    if (!context) throw new TypeError('Expected selection drawing context.');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < 0) return null;
    const box = canvas.getBoundingClientRect();
    return {
      right: box.x + (right + 1) * box.width / canvas.width,
      bottom: box.y + (bottom + 1) * box.height / canvas.height,
    };
  });
}

async function getStageViewportBox(page: Page) {
  const box = await page.locator('.inkio-ie-stage-viewport').boundingBox();
  if (!box) {
    throw new Error('Stage viewport is not visible.');
  }

  return box;
}

async function getRootDebugAttribute(page: Page, name: string) {
  return page.getByTestId('inkio-ie-root').getAttribute(name);
}

async function getSelectedAnnotation(page: Page) {
  const raw = await getRootDebugAttribute(page, 'data-debug-selected-annotation');
  return raw ? JSON.parse(raw) : null;
}

async function stageClientPoint(page: Page, point: { x: number; y: number }) {
  return page.evaluate((targetPoint) => {
    const stage = document.querySelector<HTMLElement>('[data-testid="inkio-ie-stage-frame"] .konvajs-content');
    if (!stage) {
      throw new Error('Konva stage container was not found.');
    }

    const rect = stage.getBoundingClientRect();
    return { x: rect.left + targetPoint.x, y: rect.top + targetPoint.y };
  }, point);
}

// Trusted pointer input (not synthetic MouseEvents): exercises Konva's real
// pointer/touch path including pressure-agnostic hit testing.
async function dragWithinStage(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const from = await stageClientPoint(page, start);
  const to = await stageClientPoint(page, end);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function clickStage(page: Page, point: { x: number; y: number }, clickCount = 1) {
  const at = await stageClientPoint(page, point);
  await page.mouse.move(at.x, at.y);
  if (clickCount > 1) {
    await page.mouse.dblclick(at.x, at.y);
  } else {
    await page.mouse.click(at.x, at.y);
  }
}

async function setRangeValue(locator: Locator, value: number) {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }, value);
}

async function setNumberValue(locator: Locator, value: number) {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(input, String(nextValue));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function setTextareaValue(locator: Locator, value: string, blur = false) {
  await locator.evaluate((element, { elementValue, shouldBlur }) => {
    const textarea = element as HTMLTextAreaElement;
    const prototype = Object.getPrototypeOf(textarea) as HTMLTextAreaElement;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(textarea, elementValue);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    if (shouldBlur) {
      textarea.blur();
    }
  }, { elementValue: value, shouldBlur: blur });
}

async function triggerButton(page: Page, testId: string) {
  await page.getByTestId(testId).click();
}

async function getRedRegion(page: Page, input: string | Buffer) {
  return page.evaluate(async (input) => {
    const source = typeof input === 'string' ? document.querySelector(input) : new Image();
    if (source instanceof HTMLImageElement && typeof input !== 'string') source.src = input.png;
    if (!(source instanceof HTMLCanvasElement) && !(source instanceof HTMLImageElement)) {
      throw new TypeError('Expected a canvas or an exported image.');
    }
    if (source instanceof HTMLImageElement) await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    canvas.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const context = canvas.getContext('2d');
    if (!context) throw new TypeError('No canvas context.');
    context.drawImage(source, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (data[index] > 225 && data[index + 1] > 50 && data[index + 1] < 85
          && data[index + 2] > 50 && data[index + 2] < 85 && data[index + 3] > 240) {
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
    }
    return right < left ? null : {
      x: left / width, y: top / height,
      width: (right - left + 1) / width, height: (bottom - top + 1) / height,
    };
  }, typeof input === 'string' ? input : { png: `data:image/png;base64,${input.toString('base64')}` });
}

async function closeModal(page: Page) {
  await triggerButton(page, 'inkio-ie-close');
  // Dirty editors show an inline discard-confirm card instead of closing.
  const confirm = page.getByTestId('inkio-ie-discard-confirm-ok');
  if (await confirm.count()) {
    await triggerButton(page, 'inkio-ie-discard-confirm-ok');
  }
}

async function waitForLayoutSettle(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }, 320);
    });
  });
}

async function expectEditorFitsViewport(page: Page) {
  expect(await page.getByTestId('inkio-ie-root').evaluate((root) => ({
    horizontal: root.scrollWidth - root.clientWidth,
    vertical: root.scrollHeight - root.clientHeight,
  }))).toEqual({ horizontal: 0, vertical: 0 });
  // A modal may be opened over an arbitrarily long document.
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  // The editor shows a discard confirm on close when dirty — accept it so close-flow tests proceed.
  page.on('dialog', (dialog) => { void dialog.accept(); });
});

test('desktop shell starts with topbar, canvas, left tool rail, and contextual options', async ({ page }) => {
  await waitForHarness(page);

  await expect(page.getByTestId('inkio-ie-topbar')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-toolbar-tools')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-tool-rail')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-close')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-topbar').getByRole('slider')).toHaveCount(0);
  const scale = page.getByRole('slider', { name: 'Scale' });
  await expect(scale).toBeVisible();
  const canvas = await getStageViewportBox(page);
  expect((await scale.boundingBox())!.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
  // The default 'resize' tool is always active, so its contextual row shows from the start.
  await expect(page.getByTestId('inkio-ie-util-panel')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'resize');

  const modalBox = await page.getByTestId('inkio-ie-modal-content').boundingBox();
  const viewport = page.viewportSize();

  expect(modalBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(modalBox!.width - viewport!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(modalBox!.height - viewport!.height)).toBeLessThanOrEqual(1);
});

test('resizing an untouched crop editor does not change the image or save a replacement', async ({ page }) => {
  await waitForHarness(page);
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-dirty', 'false');
  const originalCrop = await getRootDebugAttribute(page, 'data-debug-pending-crop');

  for (const viewport of [{ width: 1000, height: 800 }, { width: 390, height: 640 }]) {
    await page.setViewportSize(viewport);
    await waitForLayoutSettle(page);
    await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-pending-crop', originalCrop ?? '');
    await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-dirty', 'false');
  }

  await page.getByTestId('inkio-ie-resize-apply').click();
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-dirty', 'false');
  await expect(page.getByTestId('inkio-ie-undo')).toBeDisabled();

  await page.getByTestId('inkio-ie-save').click();
  await expect(page.getByTestId('inkio-ie-modal-content')).toHaveCount(0);
  await expect(page.locator('.image-editor-e2e-saved-image')).toHaveCount(0);
});

for (const width of [1440, 1000]) {
  test(`${width}px desktop keeps a narrow left rail and useful image space for every tool`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await waitForHarness(page);

    const toolButtons = page.locator('button[data-testid^="inkio-ie-tool-"]');
    for (const tool of await toolButtons.all()) {
      await tool.click();
      await waitForLayoutSettle(page);

      const rail = await page.getByTestId('inkio-ie-tool-rail').boundingBox();
      const panel = await page.getByTestId('inkio-ie-util-panel').boundingBox();
      const stage = await getStageViewportBox(page);
      if (!rail || !panel) throw new Error('Editor controls are missing.');

      expect(rail.width).toBeLessThanOrEqual(88);
      expect(rail.x + rail.width).toBeLessThanOrEqual(stage.x);
      expect(panel.y + panel.height).toBeLessThanOrEqual(stage.y);
      expect(panel.height).toBeLessThanOrEqual(104);
      expect(stage.width).toBeGreaterThanOrEqual(width - 168);
      expect(stage.height).toBeGreaterThanOrEqual(600);
      await expectEditorFitsViewport(page);
    }
  });
}

test('custom tool controls work in the reordered desktop rail and mobile tray and save their edits', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await waitForHarness(page);
  await triggerButton(page, 'inkio-ie-close');
  await page.getByRole('button', { name: 'Open custom tool demo' }).click();

  const toolbar = page.getByRole('toolbar', { name: 'Image editor tools' });
  const custom = toolbar.getByRole('button', { name: 'Photo preset' });
  const resize = toolbar.getByRole('button', { name: 'Resize' });
  const buttons = toolbar.getByRole('button');
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAccessibleName('Rotate');
  await expect(buttons.nth(1)).toHaveAccessibleName('Photo preset');
  await expect(buttons.nth(2)).toHaveAccessibleName('Resize');
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
  expect((await toolbar.boundingBox())!.x).toBeGreaterThanOrEqual((await getStageViewportBox(page)).x);

  await custom.focus();
  await custom.press('ArrowDown');
  await expect(resize).toBeFocused();
  await resize.press('Enter');
  await expect(resize).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 390, height: 640 });
  await expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
  const tray = (await toolbar.boundingBox())!;
  expect(tray.y + tray.height).toBeLessThanOrEqual((await getStageViewportBox(page)).y);
  await resize.focus();
  await resize.press('ArrowLeft');
  await expect(custom).toBeFocused();
  await custom.press('Space');
  await expect(custom).toHaveAttribute('aria-pressed', 'true');

  const preset = page.getByRole('button', { name: 'Make monochrome' });
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  await triggerButton(page, 'inkio-ie-undo');
  await expect(preset).toHaveAttribute('aria-pressed', 'false');
  await triggerButton(page, 'inkio-ie-redo');
  await expect(preset).toHaveAttribute('aria-pressed', 'true');

  const original = await page.getByTestId('image-editor-e2e-fixture-state').getAttribute('data-src');
  await triggerButton(page, 'inkio-ie-save');
  const saved = page.getByRole('img', { name: 'Saved image editor output' });
  await expect(saved).toBeVisible();
  await expectImagePixelsChanged(page, original, await saved.getAttribute('src'));
});

test('filter tool applies a preset and saves a filtered image', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-filter');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'filter');
  await expect(page.locator('.inkio-ie-filter-thumb-img').first()).toBeVisible();
  await triggerButton(page, 'inkio-ie-filter-grayscale');
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-filter', 'grayscale');

  await triggerButton(page, 'inkio-ie-save');
  const saved = page.locator('.image-editor-e2e-saved-image');
  await expect(saved).toBeVisible();
  await expect.poll(async () => saved.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  expect(pageErrors).toEqual([]);
});

test('finetune brightness brightens the saved image', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await waitForHarness(page);

  const luminance = (src: string | null) => page.evaluate((url) => new Promise<number>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('no 2d context'));
        return;
      }
      context.drawImage(img, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 40) {
        if (data[i + 3] > 8) {
          total += (data[i] + data[i + 1] + data[i + 2]) / 3;
          count += 1;
        }
      }
      resolve(count > 0 ? total / count : -1);
    };
    img.onerror = () => reject(new Error('img load failed'));
    img.src = url ?? '';
  }), src);

  const plainSrc = await page.getByTestId('image-editor-e2e-fixture-state').getAttribute('data-src');
  const plainLuminance = await luminance(plainSrc);

  await triggerButton(page, 'inkio-ie-tool-filter');
  await page.getByTestId('inkio-ie-finetune-trigger').click();
  // NOTE: real keyboard interaction with range inputs crashes headless
  // Chromium (also reproducible on the pre-existing brush-size slider, so
  // unrelated to finetune). Set via native setter + input event instead —
  // this still exercises dispatch, render, filter, and save end to end.
  await page.getByTestId('inkio-ie-finetune-brightness-range').evaluate((el) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, '0.5');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('inkio-ie-finetune-brightness-number')).toHaveValue('0.5');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-finetune-brightness-number')).toHaveCount(0);
  await triggerButton(page, 'inkio-ie-save');
  const savedImage = page.locator('.image-editor-e2e-saved-image').last();
  await expect(savedImage).toBeVisible();
  await expect
    .poll(async () => savedImage.getAttribute('src'), { timeout: 10000 })
    .not.toBe(plainSrc);
  const brightSrc = await savedImage.getAttribute('src');
  const brightLuminance = await luminance(brightSrc);

  expect(plainLuminance).toBeGreaterThan(0);
  expect(brightLuminance).toBeGreaterThan(plainLuminance + 5);
  expect(pageErrors).toEqual([]);
});

test('redact tool pixelates a region in the saved image', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await waitForHarness(page);

  const plainSrc = await page.getByTestId('image-editor-e2e-fixture-state').getAttribute('data-src');

  await triggerButton(page, 'inkio-ie-tool-redact');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'redact');
  await waitForLayoutSettle(page);
  await dragWithinStage(page, { x: 120, y: 90 }, { x: 300, y: 200 });
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '1');
  await page.getByTestId('inkio-ie-redact-strength-range-trigger').click();
  await setRangeValue(page.getByTestId('inkio-ie-redact-strength-range'), 18);
  await expect.poll(async () => (await getSelectedAnnotation(page))?.strength).toBe(18);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-redact-strength-range')).toHaveCount(0);

  await triggerButton(page, 'inkio-ie-save');
  const redactedImage = page.locator('.image-editor-e2e-saved-image').last();
  await expect(redactedImage).toBeVisible();
  await expect
    .poll(async () => redactedImage.getAttribute('src'), { timeout: 10000 })
    .not.toBe(plainSrc);
  const redactedSrc = await redactedImage.getAttribute('src');
  expect(redactedSrc).toMatch(/^data:image\/png;base64,/);
  expect(redactedSrc).not.toBe(plainSrc);
  await expectImagePixelsChanged(page, plainSrc, redactedSrc);
  expect(pageErrors).toEqual([]);
});

test('sticker tool places an emoji in the saved image', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await waitForHarness(page);

  const plainSrc = await page.getByTestId('image-editor-e2e-fixture-state').getAttribute('data-src');

  await triggerButton(page, 'inkio-ie-tool-sticker');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'sticker');
  await page.getByTestId('inkio-ie-sticker-picker-trigger').click();
  const stickerChoice = page.locator('.inkio-ie-emoji-btn').last();
  const emoji = await stickerChoice.textContent();
  await stickerChoice.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.inkio-ie-emoji-btn')).toHaveCount(0);
  await waitForLayoutSettle(page);
  await clickStage(page, { x: 200, y: 140 });
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '1');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.emoji).toBe(emoji);

  await triggerButton(page, 'inkio-ie-save');
  const stickerImage = page.locator('.image-editor-e2e-saved-image').last();
  await expect(stickerImage).toBeVisible();
  await expect
    .poll(async () => stickerImage.getAttribute('src'), { timeout: 10000 })
    .not.toBe(plainSrc);
  const stickerSrc = await stickerImage.getAttribute('src');
  expect(stickerSrc).toMatch(/^data:image\/png;base64,/);
  expect(stickerSrc).not.toBe(plainSrc);
  await expectImagePixelsChanged(page, plainSrc, stickerSrc);
  expect(pageErrors).toEqual([]);
});

test('desktop rail switches util panel per tool and stays open on retoggle', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-util-panel')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'draw');
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();

  const stageBefore = await getStageViewportBox(page);

  // Tools cannot be toggled off — re-selecting the active tool keeps the panel open.
  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-util-panel')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'draw');
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
  expect(await getStageViewportBox(page)).toEqual(stageBefore);
});

test('mobile rotate and flip show the same pixels that are saved', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await waitForHarness(page);
  await closeModal(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 160, 180);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(160, 0, 160, 180);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
    name: 'two-colors.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-image-width', '320');
  await page.getByTestId('inkio-ie-tool-rotate').click();
  await page.getByTestId('inkio-ie-rotate-cw').click();
  await page.getByTestId('inkio-ie-flip-horizontal').click();
  const frame = page.getByTestId('inkio-ie-stage-frame');
  const preview = await frame.screenshot({ animations: 'disabled', scale: 'css' });
  await page.getByTestId('inkio-ie-save').click();
  const saved = page.getByRole('img', { name: 'Saved image editor output' });
  await expect(saved).toBeVisible();
  const colors = await saved.evaluate(async (element, screenshot) => {
    const sample = async (image: HTMLImageElement) => {
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return [0.25, 0.75].map(y => Array.from(ctx.getImageData(
        canvas.width / 2, canvas.height * y, 1, 1,
      ).data));
    };
    const image = new Image();
    image.src = `data:image/png;base64,${screenshot}`;
    return Promise.all([sample(image), sample(element as HTMLImageElement)]);
  }, preview.toString('base64'));
  expect(colors[0]).toEqual(colors[1]);
  expect(colors[1]).toEqual([[0, 0, 255, 255], [255, 0, 0, 255]]);
});

test('a shape uses its release point when no intervening mousemove is delivered', async ({ page }) => {
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-shape').click();
  await waitForLayoutSettle(page);
  const stage = page.locator('[data-testid="inkio-ie-stage-frame"] .konvajs-content');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Expected a visible stage.');
  await stage.dispatchEvent('mousedown', { button: 0, clientX: box.x + box.width / 4, clientY: box.y + box.height / 4 });
  await page.locator('body').dispatchEvent('mouseup', {
    button: 0, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
  });

  // The fixture is 560 × 360; dragging across a quarter spans 140 × 90 source pixels.
  await expect.poll(() => getSelectedAnnotation(page)).toMatchObject({
    type: 'rect', width: expect.closeTo(140, 0), height: expect.closeTo(90, 0),
  });
});

test('a shape remains selectable at its painted location after rotating the photo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-shape').click();
  await page.getByTestId('inkio-ie-shape-fill-picker').click();
  await page.getByTestId('inkio-ie-color-swatch-ef4444').click();
  await page.keyboard.press('Escape');
  const frame = page.getByTestId('inkio-ie-stage-frame');
  const before = await getStageFrameBox(page);
  await dragWithinStage(page, { x: before.width * 0.15, y: before.height * 0.2 },
    { x: before.width * 0.35, y: before.height * 0.4 });
  await page.getByTestId('inkio-ie-tool-rotate').click();
  await page.getByTestId('inkio-ie-rotate-cw').click();
  const after = await getStageFrameBox(page);
  // A clockwise turn moves the center from (25%, 30%) to (70%, 25%).
  const painted = await getRedRegion(page, await frame.screenshot({ scale: 'css' }));
  expect(painted).not.toBeNull();
  const x = painted!.x + painted!.width / 2;
  const y = painted!.y + painted!.height / 2;
  expect(x).toBeCloseTo(0.7, 1);
  expect(y).toBeCloseTo(0.25, 1);
  await frame.click({ position: { x: after.width * x, y: after.height * y } });
  await expect(page.getByTestId('image-editor-e2e-selected-type')).toHaveText('rect');
  await page.getByTestId('inkio-ie-save').click();
  await expect(page.getByRole('img', { name: 'Saved image editor output' })).toBeVisible();
  const red = await getRedRegion(page, '.image-editor-e2e-saved-image');
  expect(red).not.toBeNull();
  expect(red!.x + red!.width / 2).toBeCloseTo(0.7, 1);
  expect(red!.y + red!.height / 2).toBeCloseTo(0.25, 1);
});

test('rotated resize reset preserves the full image through saving', async ({ page }) => {
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-rotate').click();
  await page.getByTestId('inkio-ie-rotate-cw').click();
  await page.getByTestId('inkio-ie-tool-resize').click();
  await expect(page.getByTestId('inkio-ie-resize-dimensions-trigger')).toContainText('360 × 560');
  await page.getByTestId('inkio-ie-resize-reset').click();
  await expect(page.getByTestId('inkio-ie-resize-dimensions-trigger')).toContainText('360 × 560');
  await expect.poll(async () => JSON.parse(
    await getRootDebugAttribute(page, 'data-debug-pending-crop') ?? 'null',
  )).toEqual({ x: 0, y: 0, width: 560, height: 360 });
  await page.getByTestId('inkio-ie-save').click();
  const saved = page.locator('.image-editor-e2e-saved-image');
  await expect(saved).toBeVisible();
  expect(await saved.evaluate((image) => {
    if (!(image instanceof HTMLImageElement)) throw new TypeError('Expected saved image.');
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([360, 560]);
});

for (const { field, sizes, output } of [
  { field: 'width', sizes: ['2x1', '20x13', '200x129'], output: [200, 129] },
  { field: 'height', sizes: ['3x2', '31x20', '311x200'], output: [311, 200] },
]) {
  test(`locked dimensions keep their ratio through sequential ${field} typing`, async ({ page }) => {
    await waitForHarness(page);
    await expect(page.getByTestId('inkio-ie-resize-dimensions-trigger')).toContainText('560 × 360');
    await page.getByTestId('inkio-ie-resize-dimensions-trigger').click();
    await expect(page.getByTestId('inkio-ie-resize-lock-aspect')).toHaveAttribute('aria-pressed', 'true');
    const input = page.getByTestId(`inkio-ie-resize-${field}`);
    await input.fill('');
    for (const [index, key] of ['2', '0', '0'].entries()) {
      await input.pressSequentially(key);
      await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText(sizes[index]);
      await expect(input).toBeFocused();
    }
    await page.getByTestId('inkio-ie-save').click();
    const saved = page.locator('.image-editor-e2e-saved-image');
    await expect(saved).toBeVisible();
    expect(await saved.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) throw new TypeError('Expected saved image.');
      return [image.naturalWidth, image.naturalHeight];
    })).toEqual(output);
  });
}

for (const rotatedCrop of [false, true]) {
  test(`resized and zoomed annotation pixels follow the pointer${rotatedCrop ? ' after rotated cropping' : ''}`, async ({ page }) => {
    await waitForHarness(page);
    if (rotatedCrop) {
      await page.getByTestId('inkio-ie-tool-rotate').click();
      await page.getByTestId('inkio-ie-rotate-cw').click();
      await wheelZoomPreview(page);
      await page.getByTestId('inkio-ie-tool-resize').click();
      await page.getByTestId('inkio-ie-crop-preset-1-1').click();
    }
    await page.getByTestId('inkio-ie-resize-dimensions-trigger').click();
    await page.getByTestId('inkio-ie-resize-lock-aspect').click();
    await page.getByTestId('inkio-ie-resize-width').fill('200.6');
    await page.getByTestId('inkio-ie-resize-height').fill('100.4');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inkio-ie-resize-height')).toHaveCount(0);
    await expect(page.getByTestId('inkio-ie-resize-dimensions-trigger')).toContainText('201 × 100');
    await page.getByTestId('inkio-ie-tool-shape').click();
    await page.getByTestId('inkio-ie-shape-fill-picker').click();
    await page.getByTestId('inkio-ie-color-swatch-ef4444').click();
    await page.getByTestId('inkio-ie-shape-color-picker').click();
    await page.getByTestId('inkio-ie-shape-stroke-transparent').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inkio-ie-color-picker')).toHaveCount(0);
    if (!rotatedCrop) {
      await wheelZoomPreview(page);
    }
    await waitForLayoutSettle(page);
    const stage = await getStageFrameBox(page);
    await dragWithinStage(page,
      { x: stage.width * 0.3, y: stage.height * 0.3 },
      { x: stage.width * 0.55, y: stage.height * 0.55 });
    await expect.poll(async () => {
      const red = await getRedRegion(page, '.konvajs-content canvas');
      return red ? Math.max(Math.abs(red.x - 0.3), Math.abs(red.y - 0.3),
        Math.abs(red.width - 0.25), Math.abs(red.height - 0.25)) : Infinity;
    }).toBeLessThanOrEqual(0.003);
    // Assert movement from the painted origin by the actual pointer delta.
    // Fractional CSS coordinates otherwise round twice (press and release).
    const before = (await getRedRegion(page, '.konvajs-content canvas'))!;
    const dx = Math.round(stage.width * 0.05);
    const dy = Math.round(stage.height * 0.05);
    const x = Math.round(stage.x + stage.width * 0.425);
    const y = Math.round(stage.y + stage.height * 0.425);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => {
      const red = await getRedRegion(page, '.konvajs-content canvas');
      return red ? Math.max(Math.abs(red.x - before.x - dx / stage.width),
        Math.abs(red.y - before.y - dy / stage.height)) : Infinity;
    }).toBeLessThanOrEqual(0.003);
    await page.getByTestId('inkio-ie-save').click();
    const saved = page.locator('.image-editor-e2e-saved-image');
    await expect(saved).toBeVisible();
    expect(await saved.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) throw new TypeError('Expected saved image.');
      return [image.naturalWidth, image.naturalHeight];
    })).toEqual([201, 100]);
    const exported = await getRedRegion(page, '.image-editor-e2e-saved-image');
    if (!exported) throw new TypeError('Exported annotation is missing.');
    expect(Math.abs(exported.x - 0.35)).toBeLessThanOrEqual(0.015);
    expect(Math.abs(exported.y - 0.35)).toBeLessThanOrEqual(0.015);
  });
}

test('text can be entered and reopened directly at its canvas position', async ({ page }) => {
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-text').click();
  await waitForLayoutSettle(page);
  const origin = await stageClientPoint(page, { x: 200, y: 160 });
  await page.mouse.click(origin.x, origin.y);
  const input = page.getByTestId('inkio-ie-text-content-input');
  await expect(input).toBeFocused();
  const box = await input.boundingBox();
  if (!box) throw new TypeError('Canvas text input is missing.');
  expect(Math.abs(box.x - origin.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.y - origin.y)).toBeLessThanOrEqual(2);
  await page.keyboard.type('Direct canvas text');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.text).toBe('Direct canvas text');
  await page.keyboard.press('Escape');
  await expect(input).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  const workspace = page.getByTestId('inkio-ie-canvas-workspace');
  await expect(workspace).toBeFocused();
  await page.getByTestId('inkio-ie-undo').click();
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '0');
  await page.getByTestId('inkio-ie-redo').click();
  await expect.poll(async () => (await getSelectedAnnotation(page))?.text).toBe('Direct canvas text');
  await workspace.press('Enter');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');

  await page.mouse.dblclick(origin.x + 12, origin.y + 12);
  await expect(input).toBeFocused();
  await input.fill('Edited in place\nSecond line\nThird line');
  await expect.poll(() => input.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true, keyCode: 229 });
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.text).toBe('Edited in place\nSecond line\nThird line');
});

test('clicking blank canvas commits text without opening another input', async ({ page }) => {
  await waitForHarness(page);
  await triggerButton(page, 'inkio-ie-tool-text');
  await waitForLayoutSettle(page);
  const frame = await getStageFrameBox(page);
  await clickStage(page, { x: frame.width / 4, y: frame.height / 4 });
  const input = page.getByTestId('inkio-ie-text-content-input');
  await input.fill('Keep this text');
  await clickStage(page, { x: frame.width * 0.85, y: frame.height * 0.85 });
  await expect(input).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-canvas-workspace')).toBeFocused();
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '1');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '0');
});

test('crop mode ignores annotations under the pointer and supports keyboard adjustments', async ({ page }) => {
  await waitForHarness(page);
  const workspace = page.getByTestId('inkio-ie-canvas-workspace');
  const root = page.getByTestId('inkio-ie-root');
  await triggerButton(page, 'inkio-ie-tool-shape');
  await workspace.press('Enter');
  await expect(root).toHaveAttribute('data-debug-annotation-count', '1');
  await triggerButton(page, 'inkio-ie-tool-resize');
  await waitForLayoutSettle(page);
  const frame = await getStageFrameBox(page);
  await clickStage(page, { x: frame.width * 0.4, y: frame.height / 2 });
  await expect(root).toHaveAttribute('data-debug-resolved-panel', 'resize');
  await expect(page.getByTestId('inkio-ie-selection-actions')).toHaveCount(0);

  const before = await root.getAttribute('data-debug-pending-crop');
  await workspace.press('Shift+ArrowUp');
  await expect(root).not.toHaveAttribute('data-debug-pending-crop', before ?? '');
  const resized = await root.getAttribute('data-debug-pending-crop');
  await workspace.press('ArrowRight');
  await expect(root).not.toHaveAttribute('data-debug-pending-crop', resized ?? '');
});

test('keyboard can place, edit, select and delete annotations', async ({ page }) => {
  await waitForHarness(page);
  const workspace = page.getByRole('application', { name: 'Image canvas' });
  const input = page.getByRole('textbox', { name: 'Text content' });
  const root = page.getByTestId('inkio-ie-root');
  await triggerButton(page, 'inkio-ie-tool-text');
  await workspace.press('Enter');
  await expect(input).toBeFocused();
  await input.fill('Keyboard text');
  await input.press('Control+Enter');
  await expect(workspace).toBeFocused();
  await workspace.press('Enter');
  await expect(input).toHaveValue('Keyboard text');
  await input.press('Escape');

  await triggerButton(page, 'inkio-ie-tool-sticker');
  await workspace.press('Enter');
  const picker = page.getByTestId('inkio-ie-sticker-picker-trigger');
  await picker.press('Enter');
  const choices = page.getByRole('dialog', { name: 'Sticker' }).getByRole('button');
  const emoji = await choices.last().textContent();
  await choices.last().press('Enter');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.emoji).toBe(emoji);
  await choices.last().press('Escape');
  const sticker = await getSelectedAnnotation(page);
  await workspace.press('ArrowRight');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.x).toBeGreaterThan(sticker.x);
  await workspace.press('Delete');
  await expect(root).toHaveAttribute('data-debug-annotation-count', '1');
  await workspace.press('Space');
  await expect(root).toHaveAttribute('data-debug-selected-type', 'text');
  await workspace.press('Delete');
  await expect(root).toHaveAttribute('data-debug-annotation-count', '0');

  await triggerButton(page, 'inkio-ie-tool-shape');
  await workspace.press('Enter');
  await expect(root).toHaveAttribute('data-debug-selected-type', 'rect');
  const shape = await getSelectedAnnotation(page);
  await workspace.press('ArrowDown');
  await expect.poll(async () => (await getSelectedAnnotation(page))?.y).toBeGreaterThan(shape.y);
  await workspace.press('Delete');
  await expect(root).toHaveAttribute('data-debug-annotation-count', '0');

  await triggerButton(page, 'inkio-ie-tool-draw');
  await workspace.press('Enter');
  await expect(root).toHaveAttribute('data-debug-selected-type', 'freedraw');
  expect((await getSelectedAnnotation(page))?.points).toHaveLength(4);
});

test('keyboard traverses a portaled options panel in trigger order', async ({ page }) => {
  await waitForHarness(page);
  const trigger = page.getByTestId('inkio-ie-resize-dimensions-trigger');
  const width = page.getByTestId('inkio-ie-resize-width');
  await trigger.press('Enter');
  await expect(width).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(width).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('inkio-ie-resize-height')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('inkio-ie-resize-lock-aspect')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(width).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-canvas-workspace')).toBeFocused();
  await trigger.press('Enter');
  await expect(width).toBeFocused();
  await width.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(width).toHaveCount(0);
});

test('refuses a decoded photo beyond the source side limit', async ({ page }) => {
  await waitForHarness(page);
  await closeModal(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8193;
    canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
    name: 'panorama.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  const root = page.getByTestId('inkio-ie-root');
  await expect(root.getByRole('alert')).toContainText('8,192');
  await expect(root.getByTestId('inkio-ie-stage-frame')).toHaveCount(0);
});

for (const useWorker of [true, false]) test(`a large PNG saves as a full-resolution Blob ${useWorker ? 'through the production worker' : 'with workers blocked'}`, async ({ page }) => {
  if (useWorker) {
    await page.addInitScript(() => {
      const encode = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        // Do not let the main-thread fallback conceal a broken production worker.
        if (this.width * this.height >= 2_000_000) throw new Error('Large export reached the DOM canvas');
        return encode.call(this, callback, type, quality);
      };
    });
  } else {
    await page.route('**/image-editor-e2e', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "worker-src 'none'" } });
    });
  }
  await waitForHarness(page);
  await closeModal(page);
  await page.getByLabel('Save as Blob').check();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 1000;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#20c050';
    context.fillRect(0, 0, 1050, 1000);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
    name: 'large-photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
  await page.getByTestId('inkio-ie-tool-rotate').click();
  await page.getByTestId('inkio-ie-rotate-cw').click();
  await page.getByTestId('inkio-ie-save').click();

  const saved = page.getByRole('img', { name: 'Saved image editor output' });
  await expect(saved).toBeVisible({ timeout: 20_000 });
  await expect(saved).toHaveAttribute('src', /^blob:/);
  const download = page.getByRole('link', { name: 'Download full image' });
  await expect(download).toHaveAttribute('href', /^blob:/);
  const previewSize = await saved.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    return Math.max(element.naturalWidth, element.naturalHeight);
  });
  expect(previewSize).toBeLessThanOrEqual(1200);
  const result = await download.evaluate(async (link: HTMLAnchorElement) => {
    const element = new Image();
    element.src = link.href;
    await element.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const pixel = (x: number, y: number) => {
      context.clearRect(0, 0, 1, 1);
      context.drawImage(element, x, y, 1, 1, 0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    return { width: element.naturalWidth, height: element.naturalHeight, top: pixel(500, 500), bottom: pixel(500, 1600) };
  });
  expect(result).toEqual({ width: 1000, height: 2100, top: [32, 192, 80, 255], bottom: [0, 0, 0, 0] });
});

test('banded filter fallback preserves the worker output, including global clarity and alpha', async ({ page }) => {
  let blockWorker = false;
  await page.route('**/image-editor-e2e', async (route) => {
    if (!blockWorker) return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "worker-src 'none'" } });
  });
  await page.goto(HARNESS_URL);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(42, 28, 15, 0.75)');
    gradient.addColorStop(1, 'rgba(80, 190, 140, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1970, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const save = async (blocked: boolean, rotate: boolean) => {
    blockWorker = blocked;
    await waitForHarness(page);
    await closeModal(page);
    await page.getByLabel('Save as Blob').check();
    await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
      name: 'color-bands.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
    });
    const editor = page.getByTestId('inkio-ie-root');
    await expect(editor.getByTestId('inkio-ie-stage-frame')).toBeVisible();
    await expect(editor).toHaveAttribute('data-debug-image-width', '2100');
    await page.getByTestId('inkio-ie-tool-filter').click();
    await page.getByTestId('inkio-ie-filter-sepia').click();
    await expect(editor).toHaveAttribute('data-debug-filter', 'sepia');
    await page.getByTestId('inkio-ie-finetune-trigger').click();
    const clarity = page.getByTestId('inkio-ie-finetune-clarity-number');
    await clarity.fill('0.4');
    await clarity.press('Tab');
    await expect(page.getByTestId('inkio-ie-finetune-clarity-range')).toHaveValue('0.4');
    await page.getByTestId('inkio-ie-finetune-trigger').click();
    await expect(clarity).toHaveCount(0);
    if (rotate) {
      await page.getByTestId('inkio-ie-tool-rotate').click();
      await page.getByTestId('inkio-ie-rotate-cw').click();
    }
    const worker = blocked ? undefined : page.waitForEvent('worker');
    await page.getByTestId('inkio-ie-save').click();
    await worker;
    const download = page.getByRole('link', { name: 'Download full image' });
    await expect(download).toBeVisible();
    return download.evaluate(async (link: HTMLAnchorElement) => {
      const blob = await (await fetch(link.href)).blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    });
  };
  for (const rotate of [false, true]) {
    const reference = await save(false, rotate);
    const fallback = await save(true, rotate);
    const comparison = await page.evaluate(async (sources) => {
      const pixels = await Promise.all(sources.map(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      }));
      const [a, b] = pixels;
      const maxDelta = [0, 0, 0, 0];
      for (let i = 0; i < a.data.length; i++) {
        const channel = i % 4;
        maxDelta[channel] = Math.max(maxDelta[channel], Math.abs(a.data[i] - b.data[i]));
      }
      return { dimensions: pixels.map(({ width, height }) => [width, height]), maxDelta };
    }, [reference, fallback]);
    const dimensions = rotate ? [1100, 2100] : [2100, 1100];
    expect(comparison).toEqual({ dimensions: [dimensions, dimensions], maxDelta: [0, 0, 0, 0] });
  }
});

for (const { width, text } of [
  { width: 1440, text: '' },
  { width: 1440, text: 'Resize this text' },
  { width: 390, text: '' },
  { width: 390, text: 'Resize this text' },
]) {
  test(`text resize handles stay visible during ${text ? 'populated' : 'empty'} direct entry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await waitForHarness(page);
    await page.getByTestId('inkio-ie-tool-text').click();
    await waitForLayoutSettle(page);
    await clickStage(page, { x: 40, y: 40 });
    const input = page.getByTestId('inkio-ie-text-content-input');
    await expect(input).toBeFocused();
    await expect.poll(() => getTextSelectionEdges(page)).not.toBeNull();
    await input.fill(text);
    const before = await getSelectedAnnotation(page);
    const box = await input.boundingBox();
    if (!box) throw new TypeError('Expected on-canvas text bounds.');
    const delta = text ? { x: 0, y: -10 } : { x: 40, y: 20 };
    const start = { x: box.x + (text ? box.width / 2 : box.width) + 2, y: box.y + box.height + 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 8 });
    await expect.poll(async () => {
      const resizing = await input.boundingBox();
      return resizing ? Math.max(
        Math.abs(resizing.width - (box.width + delta.x)),
        Math.abs(resizing.height - (box.height + delta.y)),
      ) : Infinity;
    }).toBeLessThanOrEqual(2);
    await expect(input).toBeFocused();
    await page.mouse.up();
    await expect.poll(async () => {
      const after = await getSelectedAnnotation(page);
      return after ? Math.max(
        Math.abs(after.width - (before.width + delta.x * before.width / box.width)),
        Math.abs(after.height - (before.height + delta.y * before.height / box.height)),
      ) : Infinity;
    }).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '1');
    await expect(input).toBeFocused();
    await expect.poll(async () => {
      const resized = await input.boundingBox();
      const edges = await getTextSelectionEdges(page);
      return resized && edges ? Math.max(
        Math.abs(edges.right - (resized.x + resized.width + 4)),
        Math.abs(edges.bottom - (resized.y + resized.height + 4)),
      ) : Infinity;
    }).toBeLessThanOrEqual(2);
    await input.fill('Edited after resizing');
    await expect.poll(async () => (await getSelectedAnnotation(page))?.text).toBe('Edited after resizing');
    expect((await getSelectedAnnotation(page)).fontSize).toBe(before.fontSize);
  });
}

for (const width of [1440, 390]) {
  test(`selection actions follow text while the pointer is held at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await waitForHarness(page);
    await page.getByTestId('inkio-ie-tool-text').click();
    await waitForLayoutSettle(page);
    const frame = await getStageFrameBox(page);
    await clickStage(page, { x: frame.width * 0.35, y: frame.height * 0.45 });
    const input = page.getByTestId('inkio-ie-text-content-input');
    await input.fill('Move me');
    const box = await input.boundingBox();
    if (!box) throw new TypeError('Expected text bounds.');
    await input.press('Escape');
    const actions = page.getByTestId('inkio-ie-selection-actions');
    const before = await actions.boundingBox();
    if (!before) throw new TypeError('Expected selection actions.');
    await page.mouse.move(box.x + 12, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 44, box.y + 52, { steps: 8 });
    await expect.poll(async () => {
      const moving = await actions.boundingBox();
      return moving ? Math.max(
        Math.abs(moving.x - before.x - 32),
        Math.abs(moving.y - before.y - 40),
      ) : Infinity;
    }).toBeLessThanOrEqual(2);
    await page.mouse.up();
    await page.getByTestId('inkio-ie-undo').click();
    await expect.poll(async () => {
      const restored = await actions.boundingBox();
      return restored ? Math.max(
        Math.abs(restored.x - before.x),
        Math.abs(restored.y - before.y),
      ) : Infinity;
    }).toBeLessThanOrEqual(2);
  });
}

for (const gesture of ['move', 'resize']) {
test(`redaction samples its current area during ${gesture} before pointer release`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-redact').click();
  await waitForLayoutSettle(page);
  const frame = await getStageFrameBox(page);
  const scale = frame.width / 560;
  await dragWithinStage(page,
    { x: 400 * scale, y: 80 * scale },
    { x: 460 * scale, y: 140 * scale },
  );
  const start = await stageClientPoint(page, {
    x: (gesture === 'move' ? 430 : 400) * scale,
    y: (gesture === 'move' ? 110 : 140) * scale,
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 230 * scale, start.y + (gesture === 'move' ? 100 : 160) * scale, { steps: 8 });
  await expect.poll(() => page.locator('.konvajs-content canvas').first().evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new TypeError('Expected image canvas.');
    const context = element.getContext('2d');
    if (!context) throw new TypeError('Expected image context.');
    const pixel = context.getImageData(
      Math.round(element.width * 200 / 560),
      Math.round(element.height * 210 / 360),
      1, 1,
    ).data;
    return pixel[2] - pixel[0];
  })).toBeGreaterThan(50);
  await page.mouse.up();
});
}

for (const resize of [false, true]) {
test(`finishing an empty text entry leaves no edit or undoable placeholder${resize ? ' after resizing' : ''}`, async ({ page }) => {
  await waitForHarness(page);
  await page.getByTestId('inkio-ie-tool-text').click();
  await waitForLayoutSettle(page);
  await clickStage(page, { x: 200, y: 160 });
  await expect(page.getByTestId('inkio-ie-text-content-input')).toBeFocused();
  if (resize) {
    const box = await page.getByTestId('inkio-ie-text-content-input').boundingBox();
    if (!box) throw new TypeError('Expected empty text bounds.');
    await page.mouse.move(box.x + box.width + 2, box.y + box.height + 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 42, box.y + box.height + 22, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('inkio-ie-text-content-input')).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '0');
  await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-dirty', 'false');
  await expect(page.getByTestId('inkio-ie-undo')).toBeDisabled();
});
}

test('text selection shows floating actions and deselect falls back to the contextual row', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-text');
  await waitForLayoutSettle(page);
  await dragWithinStage(page, { x: 110, y: 110 }, { x: 250, y: 152 });
  const textContentInput = page.getByTestId('inkio-ie-text-content-input');
  await expect(textContentInput).toBeVisible();
  await setTextareaValue(textContentInput, 'Dock title');
  await page.keyboard.press('Escape');
  await expect(textContentInput).toHaveCount(0);

  await expect(page.getByTestId('inkio-ie-selection-actions')).toBeVisible();
  const selectionActionsBox = await page.getByTestId('inkio-ie-selection-actions').boundingBox();
  const stageViewportBox = await getStageViewportBox(page);
  expect(selectionActionsBox).not.toBeNull();
  expect(selectionActionsBox!.x).toBeGreaterThanOrEqual(stageViewportBox.x);
  expect(selectionActionsBox!.x + selectionActionsBox!.width).toBeLessThanOrEqual(stageViewportBox.x + stageViewportBox.width);
  await clickStage(page, { x: 36, y: 36 });

  await expect(page.getByTestId('image-editor-e2e-selected-type')).toHaveText('none');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'text');
});

test('draw, shape, resize, and rotate controls work from the desktop contextual row', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await waitForLayoutSettle(page);
  await dragWithinStage(page, { x: 96, y: 180 }, { x: 240, y: 216 });
  await expect(page.getByTestId('image-editor-e2e-selected-type')).toHaveText('freedraw');
  await page.getByTestId('inkio-ie-draw-brush-size-range-trigger').click();
  await setRangeValue(page.getByTestId('inkio-ie-draw-brush-size-range'), 18);
  await page.getByTestId('inkio-ie-draw-opacity-range-trigger').click();
  await expect(page.getByTestId('inkio-ie-draw-brush-size-range')).toHaveCount(0);
  await setRangeValue(page.getByTestId('inkio-ie-draw-opacity-range'), 0.45);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-draw-opacity-range')).toHaveCount(0);
  await expect
    .poll(async () => {
      const current = await getSelectedAnnotation(page);
      return {
        opacity: current?.opacity,
        strokeWidth: current?.strokeWidth,
      };
    })
    .toEqual({ opacity: 0.45, strokeWidth: 18 });

  await triggerButton(page, 'inkio-ie-tool-shape');
  await triggerButton(page, 'inkio-ie-shape-fill-picker');
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-ef4444').click();
  await triggerButton(page, 'inkio-ie-shape-color-picker');
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-3b82f6').click();
  await page.getByTestId('inkio-ie-shape-stroke-width-range-trigger').click();
  await expect(page.getByTestId('inkio-ie-color-picker')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-shape-stroke-width-range')).toHaveCount(0);
  await waitForLayoutSettle(page);
  const box = await getStageFrameBox(page);
  const viewport = page.viewportSize()!;
  // Leave the image while staying inside the browser, where both engines
  // deliver the document-level move and release events.
  await dragWithinStage(page, { x: 420, y: 220 }, {
    x: viewport.width - box.x - 4,
    y: viewport.height - box.y - 4,
  });
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'shape');
  await triggerButton(page, 'inkio-ie-shape-color-picker');
  await triggerButton(page, 'inkio-ie-shape-stroke-transparent');
  await page.getByTestId('inkio-ie-shape-stroke-width-range-trigger').click();
  await setRangeValue(page.getByTestId('inkio-ie-shape-stroke-width-range'), 9);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-shape-stroke-width-range')).toHaveCount(0);

  const imageWidth = Number(await getRootDebugAttribute(page, 'data-debug-image-width'));
  const imageHeight = Number(await getRootDebugAttribute(page, 'data-debug-image-height'));
  await expect
    .poll(async () => {
      const current = await getSelectedAnnotation(page);
      return {
        fill: current?.fill,
        stroke: current?.stroke,
        strokeWidth: current?.strokeWidth,
        right: current ? Math.round(current.x + current.width) : 0,
        bottom: current ? Math.round(current.y + current.height) : 0,
      };
    })
    .toEqual({
      fill: '#ef4444',
      stroke: 'transparent',
      strokeWidth: 9,
      right: imageWidth,
      bottom: imageHeight,
    });

  await page.getByTestId('inkio-ie-layer-trigger').click();
  await expect(page.getByTestId('inkio-ie-layer-front')).toBeDisabled();
  await page.getByTestId('inkio-ie-layer-back').click();
  await expect(page.getByTestId('inkio-ie-layer-backward')).toBeDisabled();
  await expect(page.getByTestId('inkio-ie-layer-front')).toBeEnabled();
  await page.getByTestId('inkio-ie-layer-front').click();
  await expect(page.getByTestId('inkio-ie-layer-forward')).toBeDisabled();
  await expect.poll(() => page.getByRole('dialog', { name: 'Layer order' }).evaluate(
    (dialog) => dialog.contains(dialog.ownerDocument.activeElement),
  )).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-layer-front')).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-layer-trigger')).toBeFocused();

  await triggerButton(page, 'inkio-ie-tool-resize');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'resize');
  await expect.poll(async () => getRootDebugAttribute(page, 'data-debug-pending-crop')).not.toBe('');
  await triggerButton(page, 'inkio-ie-crop-preset-1-1');
  await page.getByTestId('inkio-ie-resize-dimensions-trigger').click();
  await triggerButton(page, 'inkio-ie-resize-lock-aspect');
  await setNumberValue(page.getByTestId('inkio-ie-resize-width'), 420);
  await setNumberValue(page.getByTestId('inkio-ie-resize-height'), 420);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inkio-ie-resize-width')).toHaveCount(0);
  await triggerButton(page, 'inkio-ie-resize-apply');
  await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText('420x420');
  await triggerButton(page, 'inkio-ie-resize-reset');
  await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText('none');

  const beforeRotate = await page.getByTestId('inkio-ie-stage-frame').evaluate((element) => ({
    width: Number(element.getAttribute('data-display-width')),
    height: Number(element.getAttribute('data-display-height')),
  }));
  await triggerButton(page, 'inkio-ie-tool-rotate');
  await expect(page.getByTestId('inkio-ie-util-panel-controls')).toHaveAttribute('data-panel', 'rotate');
  await triggerButton(page, 'inkio-ie-rotate-cw');
  await expect
    .poll(async () => page.getByTestId('inkio-ie-stage-frame').evaluate((element) => ({
      width: Number(element.getAttribute('data-display-width')),
      height: Number(element.getAttribute('data-display-height')),
    })))
    .not.toEqual(beforeRotate);
});

test('mobile shell uses top command bar, contextual options above the stage, and bottom tool tray', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await waitForHarness(page);

  await expect(page.getByTestId('inkio-ie-mobile-command-bar')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-tool-tray')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-util-panel')).toHaveCount(0);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-mobile-option-strip')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-option-strip-controls')).toHaveAttribute('data-panel', 'draw');
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
  const stage = await getStageViewportBox(page);
  const options = await page.getByTestId('inkio-ie-mobile-option-strip').boundingBox();
  const tray = await page.getByTestId('inkio-ie-mobile-tool-tray').boundingBox();
  if (!options || !tray) throw new Error('Mobile controls are missing.');
  expect(options.y + options.height).toBeLessThanOrEqual(stage.y);
  expect(options.height).toBeLessThanOrEqual(104);
  expect(stage.y + stage.height).toBeLessThanOrEqual(tray.y);
  expect(tray.y + tray.height).toBeLessThanOrEqual(640);
  expect(stage.height).toBeGreaterThanOrEqual(224);
  await expectEditorFitsViewport(page);

  // Tools cannot be toggled off — re-selecting keeps the option strip open.
  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-mobile-option-strip')).toBeVisible();
});

test('mobile tools stay in one comfortable row and the last tool is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await waitForHarness(page);
  const tray = page.getByRole('toolbar', { name: 'Image editor tools' });
  const controls = tray.getByRole('button');
  const boxes = await Promise.all((await controls.all()).map((button) => button.boundingBox()));
  const first = boxes[0]!;
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(Math.abs(box!.y - first.y)).toBeLessThanOrEqual(1);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const last = controls.last();
  await expect(last).not.toBeInViewport();
  await controls.nth(6).focus();
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Enter');
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  await expectEditorFitsViewport(page);

  await page.setViewportSize({ width: 634, height: 725 });
  await waitForLayoutSettle(page);
  for (const button of await controls.all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }
});

for (const width of [320, 390]) {
  test(`${width}px mobile annotation and discard actions offer 44px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await waitForHarness(page);
    await page.getByTestId('inkio-ie-tool-text').click();
    await waitForLayoutSettle(page);
    await clickStage(page, { x: 100, y: 100 });
    await page.getByTestId('inkio-ie-text-content-input').fill('Touch target');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inkio-ie-text-content-input')).toHaveCount(0);

    const deleteButton = page.getByTestId('inkio-ie-selection-delete');
    const deleteBox = await deleteButton.boundingBox();
    expect(deleteBox!.width).toBeGreaterThanOrEqual(44);
    expect(deleteBox!.height).toBeGreaterThanOrEqual(44);

    await page.getByTestId('inkio-ie-close').click();
    for (const id of ['inkio-ie-discard-confirm-ok', 'inkio-ie-discard-confirm-cancel']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByTestId('inkio-ie-discard-confirm-cancel')).toBeFocused();
    await page.getByTestId('inkio-ie-discard-confirm-cancel').click();
    await deleteButton.click();
    await expect(page.getByTestId('inkio-ie-root')).toHaveAttribute('data-debug-annotation-count', '0');
  });
}

for (const width of [1440, 390]) {
  test(`${width}px context popovers switch exclusively and Escape keeps the editor open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await waitForHarness(page);
    await page.getByTestId('inkio-ie-tool-draw').click();

    const brush = page.getByTestId('inkio-ie-draw-brush-size-range');
    const opacity = page.getByTestId('inkio-ie-draw-opacity-range');
    await expect(brush).toHaveCount(0);
    await expect(opacity).toHaveCount(0);
    await page.getByTestId('inkio-ie-draw-brush-size-range-trigger').click();
    await expect(brush).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(2);
    await expect(page.getByRole('dialog', { name: /Brush size/ }).getByRole('slider')).toBeVisible();
    await page.getByTestId('inkio-ie-draw-opacity-range-trigger').click();
    await expect(brush).toHaveCount(0);
    await expect(opacity).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(opacity).toHaveCount(0);
    await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
    await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
    await expect(page.getByTestId('inkio-ie-discard-confirm-ok')).toHaveCount(0);

    await page.getByTestId('inkio-ie-tool-filter').click();
    await expect(page.getByTestId('inkio-ie-finetune-brightness-number')).toHaveCount(0);
    await expect(page.getByTestId('inkio-ie-finetune-reset')).toHaveCount(0);
    await page.getByTestId('inkio-ie-finetune-trigger').click();
    for (const [field, value] of [
      ['brightness', 0.2],
      ['contrast', 20],
      ['saturation', 0.3],
      ['clarity', 0.4],
    ] as const) {
      const input = page.getByTestId(`inkio-ie-finetune-${field}-number`);
      await expect(input).toBeVisible();
      await setNumberValue(input, value);
      await expect(input).toHaveValue(String(value));
    }
    await page.getByTestId('inkio-ie-finetune-reset').click();
    for (const field of ['brightness', 'contrast', 'saturation', 'clarity']) {
      await expect(page.getByTestId(`inkio-ie-finetune-${field}-number`)).toHaveValue('0');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inkio-ie-finetune-reset')).toHaveCount(0);
    await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  });
}

test('mobile crop ratios and dimensions open through separate context popovers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await waitForHarness(page);

  const square = page.getByTestId('inkio-ie-crop-preset-1-1');
  const width = page.getByTestId('inkio-ie-resize-width');
  const height = page.getByTestId('inkio-ie-resize-height');
  await expect(square).toHaveCount(0);
  await expect(width).toHaveCount(0);
  await expect(height).toHaveCount(0);
  const dimensions = page.getByTestId('inkio-ie-resize-dimensions-trigger');
  await expect(page.getByTestId('inkio-ie-mobile-option-strip').getByTestId('inkio-ie-resize-dimensions-trigger')).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-zoom-controls').getByTestId('inkio-ie-resize-dimensions-trigger')).toBeVisible();
  await page.getByTestId('inkio-ie-crop-ratios-trigger').click();
  await square.click();
  await expect.poll(async () => {
    const crop = JSON.parse(await getRootDebugAttribute(page, 'data-debug-pending-crop') ?? 'null');
    return crop ? Math.abs(crop.width - crop.height) : null;
  }).toBeLessThanOrEqual(1);

  await dimensions.click();
  await expect(square).toHaveCount(0);
  await expect(width).toBeVisible();
  await expect(height).toBeVisible();
  await page.getByTestId('inkio-ie-resize-lock-aspect').click();
  await setNumberValue(width, 360);
  await setNumberValue(height, 360);
  await page.keyboard.press('Escape');
  await expect(width).toHaveCount(0);
  await expect(height).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  await page.getByTestId('inkio-ie-resize-apply').click();
  await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText('360x360');
});

test('a new portrait or landscape photo fits the available area without cropping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await waitForHarness(page);
  const root = page.getByTestId('inkio-ie-root');
  for (const [width, height] of [[1200, 600], [600, 1200]]) {
    await closeModal(page);
    const data = await page.evaluate(({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#4074ae';
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL().split(',')[1];
    }, { width, height });
    await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
      name: `photo-${width}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64'),
    });
    await expect(root).toHaveAttribute('data-debug-image-width', String(width));
    await expect(page.getByTestId('inkio-ie-zoom-label')).toHaveText('100%');
    await expect(page.getByTestId('inkio-ie-resize-dimensions-trigger')).toContainText(`${width} × ${height}`);
    const aperture = page.locator('.inkio-ie-crop-frame');
    await expect(aperture).toBeVisible();
    await expect.poll(async () => {
      const frame = (await aperture.boundingBox())!;
      const stage = await getStageViewportBox(page);
      const scale = Math.min(stage.width / width, stage.height / height);
      return Math.max(Math.abs(frame.width - width * scale), Math.abs(frame.height - height * scale));
    }).toBeLessThanOrEqual(1);
    await expect(root).toHaveAttribute('data-debug-dirty', 'false');
  }
});

test('mobile fits the image through the visible percentage control after zooming', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await waitForHarness(page);

  const scale = page.getByRole('slider', { name: 'Scale' });
  await scale.press('ArrowRight');
  await expect(page.getByTestId('inkio-ie-zoom-label')).not.toHaveText('100%');
  await page.getByTestId('inkio-ie-zoom-fit').click();
  await expect(page.getByTestId('inkio-ie-zoom-label')).toHaveText('100%');
});

test('text controls use font family, size px, and the shared color picker', async ({ page }) => {
  await waitForHarness(page);
  await closeModal(page);
  await expect(page.getByTestId('image-editor-e2e-open-state')).toHaveText('Modal: closed');
  await page.getByTestId('image-editor-e2e-theme-toggle').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('image-editor-e2e-theme')).toHaveText('dark');
  await page.getByTestId('image-editor-e2e-open').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-modal-content')).toHaveClass(/\bdark\b/);

  await triggerButton(page, 'inkio-ie-tool-text');
  await waitForLayoutSettle(page);
  await dragWithinStage(page, { x: 110, y: 110 }, { x: 260, y: 172 });

  const textContentInput = page.getByTestId('inkio-ie-text-content-input');
  await textContentInput.scrollIntoViewIfNeeded();
  await setTextareaValue(textContentInput, 'Updated glass heading');

  await expect
    .poll(async () => {
      const current = await getSelectedAnnotation(page);
      return current?.text;
    })
    .toBe('Updated glass heading');
  await page.keyboard.press('Escape');
  await expect(textContentInput).toHaveCount(0);

  const fontFamilyInput = page.getByTestId('inkio-ie-font-family-input');
  await fontFamilyInput.scrollIntoViewIfNeeded();
  await fontFamilyInput.selectOption('Georgia');

  await page.getByTestId('inkio-ie-text-font-size-range-trigger').click();
  const fontSizeInput = page.getByTestId('inkio-ie-font-size');
  await fontSizeInput.scrollIntoViewIfNeeded();
  await setNumberValue(fontSizeInput, 48);

  const colorPickerTrigger = page.getByTestId('inkio-ie-text-color-picker');
  await colorPickerTrigger.scrollIntoViewIfNeeded();
  await colorPickerTrigger.click();
  await expect(fontSizeInput).toHaveCount(0);
  await expect(page.getByTestId('inkio-ie-color-picker')).toBeVisible();
  const colorPickerBox = await page.getByTestId('inkio-ie-color-picker').boundingBox();
  const rootBox = await page.getByTestId('inkio-ie-root').boundingBox();
  expect(colorPickerBox).not.toBeNull();
  expect(rootBox).not.toBeNull();
  expect(colorPickerBox!.x).toBeGreaterThanOrEqual(rootBox!.x);
  expect(colorPickerBox!.y).toBeGreaterThanOrEqual(rootBox!.y);
  expect(colorPickerBox!.x + colorPickerBox!.width).toBeLessThanOrEqual(rootBox!.x + rootBox!.width);
  expect(colorPickerBox!.y + colorPickerBox!.height).toBeLessThanOrEqual(rootBox!.y + rootBox!.height);
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-ef4444').click();

  await expect
    .poll(async () => {
      const current = await getSelectedAnnotation(page);
      return {
        fontFamily: current?.fontFamily,
        fontSize: current?.fontSize,
        fill: current?.fill,
      };
    })
    .toEqual({
      fontFamily: 'Georgia',
      fontSize: 48,
      fill: '#ef4444',
    });
});

async function wheelZoomPreview(page: Page) {
  await page.getByTestId('inkio-ie-canvas-workspace').hover();
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => Number(await getRootDebugAttribute(page, 'data-debug-preview-zoom')))
    .toBeGreaterThan(1);
}

test('a fitted photo has a clean surround and only its real overflow is dimmed when zoomed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await waitForHarness(page);
  await closeModal(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 450;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#20c050';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.clearRect(0, 0, 315, canvas.height);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByTestId('image-editor-e2e-photo-input').setInputFiles({
    name: 'color-field.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  const aperture = page.locator('.inkio-ie-crop-frame');
  await expect(aperture).toBeVisible();
  await waitForLayoutSettle(page);
  const frame = (await aperture.boundingBox())!;
  const x = Math.round(frame.x + frame.width * 0.42);
  const clearX = Math.round(frame.x + frame.width * 0.04);
  const y = Math.round(frame.y);
  const sample = async () => {
    const png = (await page.screenshot({ scale: 'css', animations: 'disabled' })).toString('base64');
    return page.evaluate(async ({ png, x, y, clearX }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0);
      const pixel = (row: number) => Array.from(context.getImageData(x, row, 1, 1).data);
      return {
        inside: pixel(y + 24),
        outside: pixel(y - 8),
        transparent: Array.from(context.getImageData(clearX, y - 8, 1, 1).data),
      };
    }, { png, x, y, clearX });
  };
  const fitted = await sample();
  expect(fitted.inside.slice(0, 3)).toEqual([32, 192, 80]);
  expect(Math.abs(fitted.outside[1] - fitted.outside[0])).toBeLessThan(20);

  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.wheel(0, -350);
  await expect(page.getByTestId('inkio-ie-zoom-label')).not.toHaveText('100%');
  await expect.poll(async () => (await sample()).outside[1]).toBeLessThan(170);
  expect(await aperture.boundingBox()).toEqual(frame);
  const zoomed = await sample();
  expect(zoomed.inside.slice(0, 3)).toEqual([32, 192, 80]);
  expect(zoomed.outside[1] - zoomed.outside[0]).toBeGreaterThan(25);
  expect(zoomed.transparent).toEqual(fitted.transparent);
  await page.mouse.wheel(0, 350);
  await expect(page.getByTestId('inkio-ie-zoom-label')).toHaveText('100%');
  await expect.poll(async () => (await sample()).outside).toEqual(fitted.outside);
});

test('transparent and translucent pixels preview the same in both themes and export with alpha', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await waitForHarness(page);
  const modal = page.getByTestId('inkio-ie-modal-content');
  const preview = async () => {
    await waitForLayoutSettle(page);
    const frame = await getStageFrameBox(page);
    const png = (await page.screenshot({ scale: 'css' })).toString('base64');
    return page.evaluate(async ({ png, frame }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixel = (x: number, y: number) =>
        Array.from(context.getImageData(Math.round(x), Math.round(y), 1, 1).data);
      return {
        transparent: pixel(frame.x + 18, frame.y + 18),
        translucent: pixel(frame.x + frame.width * 0.42, frame.y + frame.height * 0.45),
        surround: pixel(frame.x + 18, frame.y - 12),
      };
    }, { png, frame });
  };

  const light = await preview();
  await closeModal(page);
  await page.getByTestId('image-editor-e2e-theme-toggle').click();
  await page.getByRole('button', { name: 'Open editor' }).click();
  await expect(modal).toBeVisible();
  const dark = await preview();
  expect(dark.surround).not.toEqual(light.surround);
  expect(dark.transparent).toEqual(light.transparent);
  expect(dark.translucent).toEqual(light.translucent);

  await page.getByTestId('inkio-ie-tool-rotate').click();
  await page.getByTestId('inkio-ie-rotate-cw').click();
  await page.getByTestId('inkio-ie-save').click();
  const saved = page.getByRole('img', { name: 'Saved image editor output' });
  await expect(saved).toBeVisible();
  expect(await saved.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return context.getImageData(14, 14, 1, 1).data[3];
  })).toBe(0);
});

test('crop drag springs back at fit and stops at the image boundary when zoomed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await waitForHarness(page);
  await waitForLayoutSettle(page);
  const aperture = page.locator('.inkio-ie-crop-frame');
  const fitted = await getStageFrameBox(page);
  const from = { x: fitted.x + fitted.width / 2, y: fitted.y + fitted.height / 2 };
  const originalCrop = await getRootDebugAttribute(page, 'data-debug-pending-crop');
  const originalFrame = await aperture.boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 70, { steps: 8 });
  await expect.poll(async () => (await getStageFrameBox(page)).x - fitted.x).toBeGreaterThan(4);
  expect(await getRootDebugAttribute(page, 'data-debug-pending-crop')).toBe(originalCrop);
  await page.mouse.up();
  await expect.poll(() => getStageFrameBox(page)).toEqual(fitted);
  await expect(page.getByTestId('inkio-ie-undo')).toBeDisabled();

  await page.mouse.move(from.x, from.y);
  await page.mouse.wheel(0, -300);
  await expect(page.getByTestId('inkio-ie-zoom-label')).not.toHaveText('100%');
  await page.mouse.down();
  await page.mouse.move(from.x + 260, from.y + 130, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => {
    const box = await getStageFrameBox(page);
    return Math.abs(box.x - originalFrame!.x);
  }).toBeLessThan(1);
  expect(await aperture.boundingBox()).toEqual(originalFrame);
});

test('wheel zoom updates preview zoom and crop mode keeps the crop frame fixed while image zoom changes', async ({ page }) => {
  await waitForHarness(page);

  // The default tool is 'resize' (crop mode) — switch to a non-crop tool so the wheel drives preview zoom.
  await triggerButton(page, 'inkio-ie-tool-draw');
  const previewBefore = Number(await getRootDebugAttribute(page, 'data-debug-preview-zoom'));
  await page.getByTestId('inkio-ie-canvas-workspace').hover();
  await page.mouse.wheel(0, -320);
  await expect
    .poll(async () => Number(await getRootDebugAttribute(page, 'data-debug-preview-zoom')))
    .toBeGreaterThan(previewBefore);

  await triggerButton(page, 'inkio-ie-tool-resize');
  await expect(page.getByTestId('inkio-ie-crop-overlay')).toBeVisible();
  const cropFrame = page.locator('.inkio-ie-crop-frame');
  const frameBefore = await cropFrame.boundingBox();
  expect(frameBefore).not.toBeNull();
  const cropZoomBefore = Number(await page.getByTestId('inkio-ie-crop-viewport-zoom').textContent());

  await page.getByTestId('inkio-ie-canvas-workspace').hover();
  await page.mouse.wheel(0, -400);

  // Wheel delivery + React state update can lag a frame (notably Firefox).
  await expect
    .poll(async () => Number(await page.getByTestId('inkio-ie-crop-viewport-zoom').textContent()))
    .toBeGreaterThan(cropZoomBefore);
  const frameAfter = await cropFrame.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(Math.abs(frameAfter!.x - frameBefore!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.y - frameBefore!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.width - frameBefore!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThanOrEqual(2);
});

test('viewport resizing preserves editor state and fits short mobile heights', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await waitForLayoutSettle(page);
  await dragWithinStage(page, { x: 80, y: 90 }, { x: 220, y: 130 });
  await expect(page.getByTestId('image-editor-e2e-dirty')).toHaveText('true');
  await expect(page.getByTestId('image-editor-e2e-annotation-count')).toHaveText('1');

  await page.setViewportSize({ width: 390, height: 640 });
  await waitForLayoutSettle(page);

  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-command-bar')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-tool-tray')).toBeVisible();
  await expect(page.getByTestId('image-editor-e2e-dirty')).toHaveText('true');
  await expect(page.getByTestId('image-editor-e2e-annotation-count')).toHaveText('1');

  await expectEditorFitsViewport(page);
  expect((await getStageViewportBox(page)).height).toBeGreaterThan(300);

  await page.setViewportSize({ width: 1440, height: 1080 });
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('image-editor-e2e-dirty')).toHaveText('true');
  await expect(page.getByTestId('image-editor-e2e-annotation-count')).toHaveText('1');
});
