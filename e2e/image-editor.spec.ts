import { expect, test, type Locator, type Page } from '@playwright/test';

const HARNESS_URL = 'http://localhost:4174/image-editor-e2e';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

async function waitForHarness(page: Page) {
  await page.goto(HARNESS_URL);
  await expect(page.getByTestId('image-editor-e2e-fixture-state')).toContainText('ready');
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
}

async function getStageFrameBox(page: Page) {
  const box = await page.getByTestId('inkio-ie-stage-frame').boundingBox();
  if (!box) {
    throw new Error('Stage frame is not visible.');
  }

  return box;
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

async function dragWithinStage(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await page.evaluate(({ startPoint, endPoint }) => {
    const stage = document.querySelector<HTMLElement>('[data-testid="inkio-ie-stage-frame"] .konvajs-content');
    if (!stage) {
      throw new Error('Konva stage container was not found.');
    }

    const rect = stage.getBoundingClientRect();
    const toClientPoint = (point: { x: number; y: number }) => ({
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
    });
    const from = toClientPoint(startPoint);
    const to = toClientPoint(endPoint);

    stage.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        buttons: 1,
        ...from,
      }),
    );

    for (let step = 1; step <= 8; step += 1) {
      const progress = step / 8;
      const clientX = from.clientX + (to.clientX - from.clientX) * progress;
      const clientY = from.clientY + (to.clientY - from.clientY) * progress;
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX,
          clientY,
        }),
      );
    }

    document.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        buttons: 0,
        ...to,
      }),
    );
  }, { startPoint: start, endPoint: end });
}

async function clickStage(page: Page, point: { x: number; y: number }, clickCount = 1) {
  await page.evaluate(({ targetPoint, clickCount: count }) => {
    const stage = document.querySelector<HTMLElement>('[data-testid="inkio-ie-stage-frame"] .konvajs-content');
    if (!stage) {
      throw new Error('Konva stage container was not found.');
    }

    const rect = stage.getBoundingClientRect();
    const clientX = rect.left + targetPoint.x;
    const clientY = rect.top + targetPoint.y;

    const fireClick = (detail: number) => {
      stage.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX,
          clientY,
          detail,
        }),
      );
      stage.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          buttons: 0,
          clientX,
          clientY,
          detail,
        }),
      );
      stage.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          detail,
        }),
      );
    };

    fireClick(1);
    if (count > 1) {
      fireClick(2);
      stage.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          detail: 2,
        }),
      );
    }
  }, { targetPoint: point, clickCount });
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
  await page.getByTestId(testId).evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
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

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
});

test('desktop shell starts with left rail + canvas + top-right close and no bottom dock', async ({ page }) => {
  await waitForHarness(page);

  await expect(page.getByTestId('inkio-ie-toolbar-history')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-toolbar-tools')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-close')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-desktop-zoom-cluster')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-zoom-controls')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-bottom-dock')).toHaveCount(0);

  const modalBox = await page.getByTestId('inkio-ie-modal-content').boundingBox();
  const viewport = page.viewportSize();

  expect(modalBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(modalBox!.width - viewport!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(modalBox!.height - viewport!.height)).toBeLessThanOrEqual(1);
});

test('desktop dock opens from tools and retoggle closes it without hiding the stage', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-bottom-dock')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-bottom-dock-controls')).toHaveAttribute('data-panel', 'draw');
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();

  const transition = await page.locator('.inkio-ie-stage-viewport').evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(transition).toContain('0.25s');

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-bottom-dock')).toHaveCount(0);
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();
});

test('text selection shows floating actions and deselect falls back to the parked tool dock', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-text');
  await dragWithinStage(page, { x: 110, y: 110 }, { x: 250, y: 152 });
  const textContentInput = page.getByTestId('inkio-ie-text-content-input');
  await expect(textContentInput).toBeVisible();
  await setTextareaValue(textContentInput, 'Dock title');

  await expect(page.getByTestId('inkio-ie-selection-actions')).toBeVisible();
  const selectionActionsBox = await page.getByTestId('inkio-ie-selection-actions').boundingBox();
  const stageViewportBox = await getStageViewportBox(page);
  expect(selectionActionsBox).not.toBeNull();
  expect(selectionActionsBox!.x).toBeGreaterThanOrEqual(stageViewportBox.x);
  expect(selectionActionsBox!.x + selectionActionsBox!.width).toBeLessThanOrEqual(stageViewportBox.x + stageViewportBox.width);
  await clickStage(page, { x: 36, y: 36 });

  await expect(page.getByTestId('image-editor-e2e-selected-type')).toHaveText('none');
  await expect(page.getByTestId('inkio-ie-bottom-dock-controls')).toHaveAttribute('data-panel', 'text');
});

test('draw, shape, resize, and rotate controls work from the new desktop dock', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await dragWithinStage(page, { x: 96, y: 180 }, { x: 240, y: 216 });
  await expect(page.getByTestId('image-editor-e2e-selected-type')).toHaveText('freedraw');
  await setRangeValue(page.getByTestId('inkio-ie-draw-brush-size-range'), 18);
  await setRangeValue(page.getByTestId('inkio-ie-draw-opacity-range'), 0.45);
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
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-ef4444').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await triggerButton(page, 'inkio-ie-shape-color-picker');
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-3b82f6').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  const box = await getStageFrameBox(page);
  await dragWithinStage(page, { x: 420, y: 220 }, { x: box.width + 120, y: box.height + 120 });
  await expect(page.getByTestId('inkio-ie-bottom-dock-controls')).toHaveAttribute('data-panel', 'shape');
  await triggerButton(page, 'inkio-ie-shape-color-picker');
  await triggerButton(page, 'inkio-ie-shape-stroke-transparent');
  await setRangeValue(page.getByTestId('inkio-ie-shape-stroke-width-range'), 9);

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

  await triggerButton(page, 'inkio-ie-tool-resize');
  await expect(page.getByTestId('inkio-ie-bottom-dock-controls')).toHaveAttribute('data-panel', 'resize');
  await expect.poll(async () => getRootDebugAttribute(page, 'data-debug-pending-crop')).not.toBe('');
  await triggerButton(page, 'inkio-ie-crop-preset-1-1');
  await triggerButton(page, 'inkio-ie-resize-lock-aspect');
  await setNumberValue(page.getByTestId('inkio-ie-resize-width'), 420);
  await setNumberValue(page.getByTestId('inkio-ie-resize-height'), 420);
  await triggerButton(page, 'inkio-ie-resize-apply');
  await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText('420x420');
  await triggerButton(page, 'inkio-ie-resize-reset');
  await expect(page.getByTestId('image-editor-e2e-output-size')).toHaveText('none');

  const beforeRotate = await page.getByTestId('inkio-ie-stage-frame').evaluate((element) => ({
    width: Number(element.getAttribute('data-display-width')),
    height: Number(element.getAttribute('data-display-height')),
  }));
  await triggerButton(page, 'inkio-ie-tool-rotate');
  await expect(page.getByTestId('inkio-ie-bottom-dock-controls')).toHaveAttribute('data-panel', 'rotate');
  await triggerButton(page, 'inkio-ie-rotate-cw');
  await expect
    .poll(async () => page.getByTestId('inkio-ie-stage-frame').evaluate((element) => ({
      width: Number(element.getAttribute('data-display-width')),
      height: Number(element.getAttribute('data-display-height')),
    })))
    .not.toEqual(beforeRotate);
});

test('mobile shell uses top command bar, bottom option strip, and bottom tool tray', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForHarness(page);

  await expect(page.getByTestId('inkio-ie-mobile-command-bar')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-tool-tray')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-bottom-dock')).toHaveCount(0);

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-mobile-option-strip')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-mobile-option-strip-controls')).toHaveAttribute('data-panel', 'draw');
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('inkio-ie-stage-frame')).toBeVisible();

  await triggerButton(page, 'inkio-ie-tool-draw');
  await expect(page.getByTestId('inkio-ie-mobile-option-strip')).toHaveCount(0);
});

test('text controls use font family, size px, and the shared color picker', async ({ page }) => {
  await waitForHarness(page);
  await triggerButton(page, 'inkio-ie-close');
  await expect(page.getByTestId('image-editor-e2e-open-state')).toHaveText('Modal: closed');
  await page.getByTestId('image-editor-e2e-theme-toggle').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('image-editor-e2e-theme')).toHaveText('dark');
  await page.getByTestId('image-editor-e2e-open').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-modal-content')).toHaveAttribute('data-theme', 'dark');

  await triggerButton(page, 'inkio-ie-tool-text');
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

  const fontFamilyInput = page.getByTestId('inkio-ie-font-family-input');
  await fontFamilyInput.scrollIntoViewIfNeeded();
  await fontFamilyInput.selectOption('Georgia');

  const fontSizeInput = page.getByTestId('inkio-ie-font-size');
  await fontSizeInput.scrollIntoViewIfNeeded();
  await setNumberValue(fontSizeInput, 48);

  const colorPickerTrigger = page.getByTestId('inkio-ie-text-color-picker');
  await colorPickerTrigger.scrollIntoViewIfNeeded();
  await colorPickerTrigger.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('inkio-ie-color-picker')).toBeVisible();
  const colorPickerBox = await page.getByTestId('inkio-ie-color-picker').boundingBox();
  const rootBox = await page.getByTestId('inkio-ie-root').boundingBox();
  expect(colorPickerBox).not.toBeNull();
  expect(rootBox).not.toBeNull();
  expect(colorPickerBox!.x).toBeGreaterThanOrEqual(rootBox!.x);
  expect(colorPickerBox!.y).toBeGreaterThanOrEqual(rootBox!.y);
  expect(colorPickerBox!.x + colorPickerBox!.width).toBeLessThanOrEqual(rootBox!.x + rootBox!.width);
  expect(colorPickerBox!.y + colorPickerBox!.height).toBeLessThanOrEqual(rootBox!.y + rootBox!.height);
  await page.getByTestId('inkio-ie-color-picker').getByTestId('inkio-ie-color-swatch-ef4444').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

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

test('wheel zoom updates preview zoom and crop mode keeps the crop frame fixed while image zoom changes', async ({ page }) => {
  await waitForHarness(page);

  await expect(page.getByTestId('inkio-ie-zoom-indicator')).toHaveCount(0);
  const previewBefore = Number(await getRootDebugAttribute(page, 'data-debug-preview-zoom'));
  await page.getByTestId('inkio-ie-canvas-workspace').hover();
  await page.mouse.wheel(0, -320);
  await expect
    .poll(async () => Number(await getRootDebugAttribute(page, 'data-debug-preview-zoom')))
    .toBeGreaterThan(previewBefore);
  await expect(page.getByTestId('inkio-ie-zoom-indicator')).toHaveText(/%/);

  await triggerButton(page, 'inkio-ie-tool-resize');
  await expect(page.getByTestId('inkio-ie-crop-overlay')).toBeVisible();
  await expect(page.getByTestId('inkio-ie-zoom-indicator')).toHaveText(/^Crop \d+%$/);
  const cropFrame = page.locator('.inkio-ie-crop-frame');
  const frameBefore = await cropFrame.boundingBox();
  expect(frameBefore).not.toBeNull();
  const cropZoomBefore = Number(await page.getByTestId('inkio-ie-crop-viewport-zoom').textContent());

  await page.getByTestId('inkio-ie-canvas-workspace').hover();
  await page.mouse.wheel(0, -400);

  const cropZoomAfter = Number(await page.getByTestId('inkio-ie-crop-viewport-zoom').textContent());
  const frameAfter = await cropFrame.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(cropZoomAfter).toBeGreaterThan(cropZoomBefore);
  expect(Math.abs(frameAfter!.x - frameBefore!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.y - frameBefore!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.width - frameBefore!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThanOrEqual(2);
});

test('viewport resizing preserves editor state and short mobile heights use the scroll shell', async ({ page }) => {
  await waitForHarness(page);

  await triggerButton(page, 'inkio-ie-tool-draw');
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

  const rootMetrics = await page.getByTestId('inkio-ie-root').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(rootMetrics.overflowY).toBe('auto');
  expect(rootMetrics.scrollHeight).toBeGreaterThan(rootMetrics.clientHeight);

  await page.setViewportSize({ width: 1440, height: 1080 });
  await waitForLayoutSettle(page);
  await expect(page.getByTestId('image-editor-e2e-dirty')).toHaveText('true');
  await expect(page.getByTestId('image-editor-e2e-annotation-count')).toHaveText('1');
});
