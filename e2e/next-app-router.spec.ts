import { devices, expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { compositionTest } from './composition';

async function selectCommentText(editor: Locator) {
  const phrase = 'This example';
  const paragraph = editor.locator('p').first();
  // Drag across the rendered text: the browser and ProseMirror see one
  // selection gesture rather than racing an injected DOM Range on focus.
  const positions = await paragraph.evaluate((el, length) => {
    const text = el.firstChild;
    if (!(text instanceof Text)) throw new Error('Expected the demo paragraph to start with text.');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, length);
    const { left, right, top, height } = range.getBoundingClientRect();
    const bounds = el.getBoundingClientRect();
    const y = top + height / 2 - bounds.top;
    return { sourcePosition: { x: left - bounds.left, y }, targetPosition: { x: right - bounds.left, y } };
  }, phrase.length);
  await paragraph.dragTo(paragraph, positions);
  await expect(editor).toBeFocused();
  await expect.poll(() => editor.evaluate(() => window.getSelection()?.toString())).toBe(phrase);
  // ProseMirror consumes selectionchange after the browser selection is set.
  await expect.poll(() => editor.evaluate((element) => {
    // Tiptap attaches its editor to the rendered ProseMirror element.
    const tiptapElement = element as HTMLElement & {
      editor?: { state: { selection: { from: number; to: number }; doc: { textBetween: (from: number, to: number) => string } } };
    };
    const state = tiptapElement.editor?.state;
    return state?.doc.textBetween(state.selection.from, state.selection.to);
  })).toBe(phrase);
}

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
  await page.setViewportSize({ width: 1440, height: 1080 });
  // The editor shows a discard confirm on close when dirty — accept it so the modal can close.
  page.on('dialog', (dialog) => { void dialog.accept(); });
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
  // Dirty editors show an inline discard-confirm card instead of closing.
  const confirm = page.getByTestId('inkio-ie-discard-confirm-ok');
  if (await confirm.count()) {
    await confirm.click();
  }
  await expect(page.getByTestId('inkio-ie-modal-content')).toBeHidden();
});

const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

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
    buffer: Buffer.from(onePixelPng, 'base64'),
  });

  await expect(page.locator('.inkio-image-block-container')).toHaveCount(1);
  expect(pageErrors).not.toEqual(
    expect.arrayContaining([expect.stringContaining('Applying a mismatched transaction')]),
  );

  // The image takes the empty line's place, and writing continues below it.
  await page.keyboard.type('below the image');
  const lastBlocks = await editor.evaluate((root) => {
    const { content } = (root as unknown as { editor: { getJSON: () => { content: { type: string; content?: unknown[] }[] } } }).editor.getJSON();
    return content.slice(-2);
  });
  expect(lastBlocks).toMatchObject([
    { type: 'imageBlock' },
    { type: 'paragraph', content: [{ type: 'text', text: 'below the image' }] },
  ]);
});

test('cells selected in a table merge and split from its menu', async ({ page }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();
  await editor.evaluate((root) => {
    const { editor: instance } = root as unknown as { editor: { commands: { clearContent: () => void; focus: () => void; insertTable: (options: { rows: number; cols: number; withHeaderRow: boolean }) => void } } };
    // `commands` holds one transaction: read it again for each command.
    instance.commands.clearContent();
    instance.commands.focus();
    instance.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
  });

  const cells = editor.locator('td');
  const menu = page.locator('.inkio-table-context-menu');
  const first = (await cells.nth(0).boundingBox())!;
  const second = (await cells.nth(1).boundingBox())!;

  // A plain cell offers only what the table has no other way to do.
  await cells.nth(0).click({ button: 'right' });
  await expect(menu.getByRole('menuitem')).toHaveText(['행 삭제', '열 삭제']);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await page.mouse.move(first.x + 20, first.y + 15);
  await page.mouse.down();
  await page.mouse.move(second.x + 20, second.y + 15, { steps: 8 });
  await page.mouse.up();
  await expect(editor.locator('.selectedCell')).toHaveCount(2);
  // The formatting menu would cover the row above.
  await expect(page.locator('.inkio-floating-overlay.is-visible')).toHaveCount(0);

  await page.mouse.click(second.x + 20, second.y + 15, { button: 'right' });
  await expect(menu).toBeVisible();
  await expect(editor.locator('.selectedCell')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: '셀 병합' }).click();
  await expect(editor.locator('td[colspan="2"]')).toHaveCount(1);

  await editor.locator('td[colspan="2"]').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '셀 분할' }).click();
  await expect(editor.locator('td[colspan="2"]')).toHaveCount(0);
  await expect(cells).toHaveCount(6);
});

async function focusEditorEnd(page: import('@playwright/test').Page) {
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();
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
}

test('next app router example shows hashtag suggestions without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('#ink');

  await expect(page.getByRole('option', { name: '#inkio' })).toBeVisible();
  expect(pageErrors).not.toEqual(
    expect.arrayContaining([expect.stringContaining("reading 'onError'")]),
  );
});

test('next app router example shows mention suggestions without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('@ad');

  await expect(page.getByRole('option', { name: 'ada' })).toBeVisible();
  expect(pageErrors).not.toEqual(
    expect.arrayContaining([expect.stringContaining("reading 'onError'")]),
  );
});

test('next app router example creates a wiki link node from [[ ]] syntax', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('[[Knowledge Base]]');

  const wikiLink = page.locator('.ProseMirror span[data-wiki-link]');
  await expect(wikiLink).toHaveCount(1);
  await expect(wikiLink).toHaveText('Knowledge Base');
  expect(pageErrors).toEqual([]);
});

test('next app router example picks a wiki link page from the [[ popup and reports clicks', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('[[Know');

  await expect(page.getByRole('option', { name: 'Knowledge Base' })).toBeVisible();
  await page.keyboard.press('Enter');

  const wikiLink = page.locator('.ProseMirror span[data-wiki-link]');
  await expect(wikiLink).toHaveText('Knowledge Base');
  await expect(page.locator('.ProseMirror')).not.toContainText('[[Know');

  await wikiLink.click();
  await expect(page.getByTestId('next-editor-wiki-link-target')).toHaveText('Wiki link clicked: Knowledge Base');
  expect(pageErrors).toEqual([]);
});

test('next app router example viewer follows the edited document', async ({ page }) => {
  await page.goto('http://localhost:4174/viewer-e2e');
  const viewer = page.getByTestId('viewer-e2e-viewer');
  await expect(viewer).toContainText('Viewer harness');
  const preview = page.getByTestId('static-preview');
  const text = preview.locator('.inkio-content span').first();
  await expect(text).toHaveCSS('color', 'rgb(18, 86, 120)');

  await focusEditorEnd(page);
  await page.keyboard.type(' mirrored into the viewer');

  await expect(viewer).toContainText('Viewer harness mirrored into the viewer');
  await expect(text).toHaveCSS('color', 'rgb(18, 86, 120)');
  await expect(preview).toContainText('Viewer harness mirrored into the viewer');
  await expect(preview.locator('.inkio-content p').first()).toHaveCSS('text-align', 'center');
});

test('the floating toolbar returns Enter to the editor after keyboard navigation', async ({ page }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  const editor = page.locator('.ProseMirror').first();
  const blocks = editor.locator(':scope > p');
  const before = await blocks.count();
  const buttons = page.locator('.inkio-floating-overlay.is-visible button:enabled');
  await buttons.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(buttons.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(blocks).toHaveCount(before + 1);
});

test('next app router example suggestion popup never shows the empty state while matches exist', async ({ page }) => {
  await page.goto('http://localhost:4174');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');

  // Record every DOM state, not just the final one: the empty state can
  // flash between keystrokes while each query loads.
  await page.evaluate(() => {
    const w = window as unknown as { __sawEmpty: boolean };
    w.__sawEmpty = false;
    new MutationObserver(() => {
      if (document.querySelector('.inkio-suggestion-empty')) w.__sawEmpty = true;
    }).observe(document.body, { childList: true, subtree: true });
  });

  // Each step narrows the list (5 -> 4 -> 1 tags), so waiting for the new
  // count proves that keystroke's query finished before the next one.
  for (const [key, count] of [['#', 5], ['i', 4], ['n', 1]] as const) {
    await page.keyboard.type(key);
    await expect(page.getByRole('option')).toHaveCount(count);
  }
  await expect(page.getByRole('option', { name: '#inkio' })).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __sawEmpty: boolean }).__sawEmpty)).toBe(false);
});

test('next app router example adds a comment through the comment composer', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  // Select text in the first paragraph so the comment shortcut has a range to anchor.
  await selectCommentText(editor);
  await page.keyboard.press('ControlOrMeta+Shift+m');

  const composer = page.locator('.inkio-comment-composer');
  await expect(composer).toBeVisible();
  await composer.locator('.inkio-comment-composer-input').fill('A smoke-test comment');
  await composer.locator('.inkio-comment-composer-submit').click();

  // Browsers split the marked range into different numbers of spans for the
  // same keystrokes — assert a single distinct thread id instead of span count.
  await expect
    .poll(() =>
      editor.locator('[data-comment-id]').evaluateAll(
        (els) => new Set(els.map((el) => el.getAttribute('data-comment-id'))).size,
      ),
    )
    .toBe(1);
  await expect(page.locator('.inkio-comment-panel')).toContainText('A smoke-test comment');
  expect(pageErrors).toEqual([]);
});

test('next app router example inserts a bookmark that resolves a preview', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  await expect(page.locator('.ProseMirror').first()).toBeVisible();
  await page.getByTestId('next-editor-insert-demo-bookmark').click();

  const bookmark = page.locator('.inkio-bookmark-wrapper');
  await expect(bookmark).toHaveCount(1);
  await expect(bookmark).toContainText('Example Domain');
  expect(pageErrors).toEqual([]);
});

test('next app router example replies to, resolves, and deletes a comment thread', async ({ page }) => {
  // The longest flow here: on a loaded machine every step passes but the page
  // load alone can take most of the default 30 seconds.
  test.slow();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => { pageErrors.push(error.message); });

  await page.goto('http://localhost:4174');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  // Create a comment on the first paragraph.
  await selectCommentText(editor);
  await page.keyboard.press('ControlOrMeta+Shift+m');
  const composer = page.locator('.inkio-comment-composer');
  await expect(composer).toBeVisible();
  await composer.locator('.inkio-comment-composer-input').fill('Thread root');
  await composer.locator('.inkio-comment-composer-submit').click();
  await expect(page.locator('.inkio-comment-msg')).toHaveCount(1);

  // Reply to the thread.
  const replyInput = page.locator('.inkio-comment-reply-input').first();
  await replyInput.fill('A threaded reply');
  await expect(replyInput).toBeFocused();
  await expect(replyInput).not.toHaveCSS('box-shadow', 'none');
  await page.locator('.inkio-comment-reply-send').first().click();
  await expect(page.locator('.inkio-comment-msg')).toHaveCount(2);

  // Resolve the thread.
  await page.locator('.inkio-comment-action-btn.resolve').first().click();
  await expect(page.locator('.inkio-comment-thread.is-resolved')).toHaveCount(1);
  await expect(page.locator('.inkio-comment-action-btn.resolve')).toHaveCount(0);

  // Delete the thread — removes both the panel entry and the in-document mark.
  await page.locator('.inkio-comment-action-btn.delete').first().click();
  await expect(page.locator('.inkio-comment-thread')).toHaveCount(0);
  await expect(editor.locator('[data-comment-id]')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('next app router example hides a comment thread while its text is deleted', async ({ page }) => {
  await page.goto('http://localhost:4174');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();

  await selectCommentText(editor);
  await page.keyboard.press('ControlOrMeta+Shift+m');
  const composer = page.locator('.inkio-comment-composer');
  await expect(composer).toBeVisible();
  await composer.locator('.inkio-comment-composer-input').fill('On deleted text');
  await composer.locator('.inkio-comment-composer-submit').click();
  const thread = page.locator('.inkio-comment-thread');
  await expect(thread).toHaveCount(1);
  await expect(page.locator('.inkio-comment-thread-quote')).toHaveText('This example');

  await page.locator('.inkio-comment-thread-quote').click();
  await expect(editor).toBeFocused();
  await expect.poll(() => editor.evaluate(() => window.getSelection()?.toString())).toBe('This example');
  await page.keyboard.press('Backspace');
  await expect(thread).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(thread).toHaveCount(1);
  await expect(thread).toContainText('On deleted text');
});

compositionTest('slash menu speaks the editor locale and finds a command typed in Korean', async ({ page, ime }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  await expect(page.locator('.inkio-suggestion-header')).toHaveCount(0);
  await expect(page.getByRole('listbox', { name: '추천 항목' })).toBeVisible();

  await ime.compose('ㅍ', '표');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveText('표');

  await ime.press('Enter');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor.locator('table')).toHaveCount(1);
  await expect(editor).not.toContainText('/표');
});

compositionTest('slash menu says nothing matched in the editor locale', async ({ page, ime }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  await ime.compose('ㅎ', '하', '핳');
  await expect(page.locator('.inkio-suggestion-empty')).toHaveText('검색 결과 없음');
});

compositionTest('Korean composition lands where the caret is', async ({ page, ime }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  const editor = page.locator('.ProseMirror').first();
  const preedit = await editor.evaluateHandle(root => {
    const text: string[] = [];
    const capture = (event: Event) => {
      const value = root.querySelector('p')!.textContent!;
      // Chromium emits another input with unchanged text on commit.
      if (event.isTrusted && text[text.length - 1] !== value) text.push(value);
    };
    root.addEventListener('compositionstart', () => root.addEventListener('input', capture), { once: true });
    root.addEventListener('compositionend', () => root.removeEventListener('input', capture), { once: true });
    return text;
  });

  await ime.compose('ㅎ', '하', '한');
  await expect.poll(() => preedit.jsonValue()).toEqual(['슬래시 시험ㅎ', '슬래시 시험하', '슬래시 시험한']);
  await ime.compose('ㄱ', '그', '글');
  await ime.press('Enter');
  await ime.compose('ㄷ', '다', '달');
  await ime.press('Backspace');

  const paragraphs = editor.locator('p');
  await expect(paragraphs.first()).toHaveText('슬래시 시험한글');
  await expect(paragraphs.nth(1)).toHaveText('');
});

const blockEditor = (page: import('@playwright/test').Page) => page.locator('.ProseMirror').first();

const blockOutline = (page: import('@playwright/test').Page) =>
  blockEditor(page).evaluate((root) =>
    Array.from(root.children).map((child) => {
      if (child.tagName === 'UL') {
        return `UL:${Array.from(child.children).map((item) => item.textContent).join('/')}`;
      }
      const code = child.querySelector('pre');
      return code ? `PRE:${code.textContent}` : `${child.tagName}:${child.textContent}`;
    }),
  );

function touchContext(browser: Browser, viewport = devices['Pixel 7'].viewport) {
  const name = browser.browserType().name();
  // Firefox supports touch and narrow viewports, but not isMobile emulation.
  const device = name === 'firefox' ? { hasTouch: true } : devices[name === 'webkit' ? 'iPhone 13' : 'Pixel 7'];
  return browser.newContext({ ...device, viewport });
}

type TouchPoint = { x: number; y: number };
type TouchPhase = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';

async function touchDriver(page: Page) {
  const name = page.context().browser()!.browserType().name();
  let send: (phase: TouchPhase, point: TouchPoint) => Promise<unknown>;
  if (name === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    send = (type, point) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [point],
    });
  } else {
    // Playwright's public Touchscreen only taps. Use the local driver's native
    // protocols for continuous trusted input and real browser pointer capture.
    type Session = { send(method: string, params: object): Promise<unknown> };
    const { _connection } = page as unknown as {
      _connection: { toImpl(page: Page): { delegate: { _session: Session; _pageProxySession: Session } } };
    };
    const driver = _connection.toImpl(page).delegate;
    send = (type, { x, y }) => {
      const point = { x: Math.round(x), y: Math.round(y) };
      return name === 'firefox'
        ? driver._session.send('Page.dispatchTouchEvent', { type, touchPoints: [point], modifiers: 0 })
        : driver._pageProxySession.send('Input.dispatchTouchEvent', { type, touchPoints: [{ ...point, id: 0 }] });
    };
  }
  return async (point: TouchPoint) => {
    await send('touchStart', point);
    return {
      async move(x: number, y: number) {
        const start = point;
        for (let step = 1; step <= 12; step++) {
          point = { x: start.x + (x - start.x) * step / 12, y: start.y + (y - start.y) * step / 12 };
          await send('touchMove', point);
        }
      },
      end: () => send('touchEnd', point),
      cancel: () => send('touchCancel', point),
    };
  };
}

async function dragBlock(
  page: Page,
  source: string,
  target: string,
  side: 'above' | 'below',
) {
  const editor = blockEditor(page);
  const from = editor.getByText(source, { exact: true });
  await from.hover();
  const handle = page.locator('[aria-label="블록 핸들"]');
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();

  const box = (await editor.getByText(target, { exact: true }).boundingBox())!;
  const y = side === 'above' ? box.y + 2 : box.y + box.height - 2;
  await page.mouse.move(box.x + 10, y, { steps: 8 });
  await page.mouse.move(box.x + 12, y);
  await page.mouse.up();
}

test.describe('block drag onto a list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4174/block-e2e');
    await expect(blockEditor(page)).toContainText('끝 문단');
  });

  test('lands between the items and splits the list', async ({ page }) => {
    await dragBlock(page, '끝 문단', '하나', 'below');
    expect(await blockOutline(page)).toEqual(['P:앞 문단', 'UL:하나', 'P:끝 문단', 'UL:둘', 'PRE:코드']);
  });

  test('lands beside the list at its ends', async ({ page }) => {
    await dragBlock(page, '끝 문단', '하나', 'above');
    expect(await blockOutline(page)).toEqual(['P:앞 문단', 'P:끝 문단', 'UL:하나/둘', 'PRE:코드']);

    await dragBlock(page, '앞 문단', '둘', 'below');
    expect(await blockOutline(page)).toEqual(['P:끝 문단', 'UL:하나/둘', 'P:앞 문단', 'PRE:코드']);
  });

  test('undoes as one step', async ({ page }) => {
    await dragBlock(page, '끝 문단', '하나', 'below');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await blockOutline(page)).toEqual(['P:앞 문단', 'UL:하나/둘', 'P:끝 문단', 'PRE:코드']);
  });

  test('still moves a list item inside its list', async ({ page }) => {
    await dragBlock(page, '둘', '하나', 'above');
    expect(await blockOutline(page)).toEqual(['P:앞 문단', 'UL:둘/하나', 'P:끝 문단', 'PRE:코드']);
  });
});

// Copy writes the test input to the browser clipboard. Pasting with the
// platform shortcut exercises the native paste event, including rich data.
async function pasteClipboard(page: Page, plain: string, rich?: string) {
  await page.evaluate(({ plain, rich }) => {
    document.addEventListener('copy', event => {
      event.clipboardData!.setData('text/plain', plain);
      if (rich) event.clipboardData!.setData('text/html', rich);
      event.preventDefault();
    }, { capture: true, once: true });
  }, { plain, rich });
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');
}

test.describe('markdown paste', () => {
  async function pasteText(page: import('@playwright/test').Page, target: string, text: string, html?: string) {
    await blockEditor(page).getByText(target, { exact: true }).click();
    await page.keyboard.press('End');
    await pasteClipboard(page, text, html);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4174/block-e2e');
    await expect(blockEditor(page)).toContainText('끝 문단');
  });

  test('becomes headings, lists and tables', async ({ page }) => {
    await pasteText(page, '끝 문단', '## 범위\n\n- 가\n- 나\n\n| 이름 | 값 |\n| --- | --- |\n| 기간 | 3~5일 |');
    const editor = blockEditor(page);
    await expect(editor.locator('h2')).toHaveText('범위');
    await expect(editor.locator('ul li')).toHaveCount(4);
    await expect(editor.locator('table td').nth(1)).toHaveText('3~5일');
    await expect(editor.locator('s, del')).toHaveCount(0);
  });

  test('stays in the paragraph when it is only a span', async ({ page }) => {
    await pasteText(page, '끝 문단', '그리고 **굵게**');
    const editor = blockEditor(page);
    await expect(editor.locator('p', { hasText: '끝 문단' })).toHaveText('끝 문단그리고 굵게');
    await expect(editor.locator('p strong')).toHaveText('굵게');
  });

  test('preserves the destination of a link with a bracketed label', async ({ page }) => {
    await pasteText(page, '끝 문단', '## 링크\n\n[[Guide]](/guide) · [[Wiki]]');
    const editor = blockEditor(page);
    await expect(editor.getByRole('link', { name: '[Guide]', exact: true })).toHaveAttribute('href', '/guide');
    await expect(editor.locator('[data-wiki-link]')).toHaveText('Wiki');
  });

  test('leaves plain sentences, rich copies and code blocks alone', async ({ page }) => {
    await pasteText(page, '끝 문단', ' 2 - 1 = 1');
    const editor = blockEditor(page);
    await expect(editor.locator('p', { hasText: '끝 문단' })).toHaveText('끝 문단 2 - 1 = 1');

    await pasteText(page, '하나', '**원문**', '<em>서식</em>');
    await expect(editor.locator('li em')).toHaveText('서식');

    await pasteText(page, '코드', '\n## 제목');
    await expect(editor.locator('pre')).toContainText('## 제목');
    await expect(editor.locator('h2')).toHaveCount(0);
  });
});

test('typing right after a click lands at the click', async ({ page }) => {
  await page.goto('http://localhost:4174/block-e2e');
  const editor = blockEditor(page);
  await editor.getByText('끝 문단', { exact: true }).click();
  await page.keyboard.type('X');
  await expect(editor.locator('p').first()).toHaveText('앞 문단');
  await expect(editor.locator('p', { hasText: '끝' })).toContainText('X');
});

compositionTest('a table inserted from the menu takes Korean and Tab moves between cells', async ({ page, ime }) => {
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await ime.compose('ㅍ', '표');
  await expect(page.getByRole('option')).toHaveCount(1);
  await ime.press('Enter');

  const table = page.locator('.ProseMirror').first().locator('table');
  await ime.compose('ㅇ', '이', '이름');
  await ime.press('Tab');
  await ime.compose('ㄱ', '가', '값');
  await expect(table.locator('th').nth(0)).toHaveText('이름');
  await expect(table.locator('th').nth(1)).toHaveText('값');
  await expect(table.locator('tr')).toHaveCount(3);
});

test.describe('editor surfaces', () => {
  const long = Array.from({ length: 40 }, (_, i) => `문단 ${i}`).join('\n\n');

  async function replaceWith(page: import('@playwright/test').Page, markdown: string) {
    const editor = blockEditor(page);
    await editor.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await pasteClipboard(page, markdown);
    // Tiptap moves focus on the next frame; keys sent before it race the caret.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4174/block-e2e');
    await expect(blockEditor(page)).toContainText('끝 문단');
  });

  test('a task checkbox sits on the line of its text', async ({ page }) => {
    await replaceWith(page, '- [ ] 할 일');
    const gap = await page.evaluate(() => {
      const box = document.querySelector('.inkio-task-checkbox-btn')!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.ProseMirror li p')!);
      const text = range.getBoundingClientRect();
      return Math.abs(box.top + box.height / 2 - (text.top + text.height / 2));
    });
    expect(gap).toBeLessThan(2);
  });

  test('table headers line up with their column', async ({ page }) => {
    await replaceWith(page, '| 이름 | 값 |\n| --- | --- |\n| 기간 | 3~5일 |');
    await expect(page.locator('.ProseMirror th').first()).toHaveCSS('text-align', 'start');
  });

  test('overlays follow a page scrolled under a filtered ancestor', async ({ page }) => {
    await replaceWith(page, `${long}\n\n| 이름 | 값 |\n| --- | --- |\n| 기간 | 3~5일 |\n\n마지막`);

    const cell = page.locator('.ProseMirror td').first();
    await cell.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
    await cell.hover();
    const plus = page.locator('.inkio-table-insert--column').first();
    await expect(plus).toBeVisible();
    const table = (await page.locator('.ProseMirror table').boundingBox())!;
    expect(Math.abs((await plus.boundingBox())!.y - table.y)).toBeLessThan(40);

    const box = (await cell.boundingBox())!;
    await page.mouse.click(box.x + 20, box.y + 10, { button: 'right' });
    // Under the pointer, or shifted up only as far as the viewport requires.
    const menu = (await page.locator('.inkio-table-context-menu').boundingBox())!;
    expect(menu.y).toBeLessThanOrEqual(box.y + 10);
    expect(menu.y + menu.height).toBeGreaterThanOrEqual(box.y + 10);
  });

  test('the formatting menu follows a page scrolled under a filtered ancestor', async ({ page }) => {
    await replaceWith(page, `${long}\n\n마지막`);
    const last = page.locator('.ProseMirror p', { hasText: '마지막' });
    await last.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
    const line = (await last.boundingBox())!;
    await page.mouse.move(line.x + 2, line.y + line.height / 2);
    await page.mouse.down();
    await page.mouse.move(line.x + 60, line.y + line.height / 2, { steps: 6 });
    await page.mouse.up();
    const bubble = page.locator('.inkio-floating-overlay.is-visible .inkio-bubble-menu');
    await expect(bubble).toBeVisible();
    expect(Math.abs((await bubble.boundingBox())!.y - (await last.boundingBox())!.y)).toBeLessThan(80);
  });

  test('positions built-in menus around their anchors and keeps the bottom toolbar in view', async ({ page }) => {
    await page.getByLabel('Custom menu layout').check();
    const editor = blockEditor(page);
    const toolbar = page.getByRole('toolbar', { name: 'Editor toolbar' });
    const body = page.locator('.inkio-editor-body');
    const bottom = (rect: { y: number; height: number }) => rect.y + rect.height;
    const first = editor.getByText('앞 문단', { exact: true });
    await first.click({ clickCount: 3 });
    const bubble = page.getByRole('toolbar', { name: '서식 도구' });
    await expect(bubble).toBeVisible();
    await expect.poll(async () => (await bubble.boundingBox())!.y - bottom((await first.boundingBox())!)).toBeGreaterThan(8);
    expect((await toolbar.boundingBox())!.y).toBeGreaterThanOrEqual(bottom((await body.boundingBox())!) - 1);

    await first.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const floating = page.getByRole('toolbar', { name: '블록 도구' });
    await expect(floating).toBeVisible();
    const emptyLine = editor.locator('p').nth(1);
    await expect.poll(async () => (await floating.boundingBox())!.x - (await emptyLine.boundingBox())!.x).toBeGreaterThan(20);

    await replaceWith(page, '| 이름 | 값 |\n| --- | --- |\n| 기간 | 3~5일 |');
    const cell = editor.locator('td').last();
    await cell.scrollIntoViewIfNeeded();
    const rect = (await cell.boundingBox())!;
    const x = rect.x + rect.width / 2;
    await page.mouse.click(x, rect.y + rect.height / 2, { button: 'right' });
    const tableMenu = page.locator('.inkio-table-context-menu');
    await expect(tableMenu).toBeVisible();
    await expect.poll(async () => {
      const menu = (await tableMenu.boundingBox())!;
      return x - menu.x - menu.width;
    }).toBeGreaterThanOrEqual(11);
  });

  test('shows the picked-up block and insertion point, then clears both on drop', async ({ page }) => {
    const editor = blockEditor(page);
    const last = editor.getByText('끝 문단', { exact: true });
    await last.click();
    await page.keyboard.press('End');
    const suffix = ' keeps its original line breaks when it is lifted into a padded drag preview.';
    await page.keyboard.insertText(suffix);
    const text = `끝 문단${suffix}`;
    const source = editor.getByText(text, { exact: true });
    const target = editor.getByText('앞 문단', { exact: true });
    const handle = page.getByRole('button', { name: '블록 핸들' });
    const marker = page.locator('.inkio-block-drop-marker');
    let lineCounts: number[] | undefined;
    await page.exposeFunction('recordDragLineCounts', (counts: number[]) => { lineCounts = counts; });
    await source.evaluate((paragraph) => {
      document.addEventListener('dragstart', () => {
        const ghost = document.querySelector('.inkio-block-drag-preview p');
        if (!ghost) return;
        const count = (element: Element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(Array.from(range.getClientRects(), (rect) => rect.top)).size;
        };
        void (window as Window & { recordDragLineCounts: (counts: number[]) => Promise<void> })
          .recordDragLineCounts([count(paragraph), count(ghost)]);
      }, { once: true });
    });
    await source.hover();
    await expect(handle).toBeVisible();
    const grip = (await handle.boundingBox())!;
    const drop = (await target.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(drop.x + 8, drop.y + 2, { steps: 12 });
    // A second move delivers dragover after the browser starts native dragging.
    await page.mouse.move(drop.x + 9, drop.y + 2);
    await expect(editor).toHaveClass(/inkio-block-pickup/);
    await expect(source).toHaveCSS('opacity', '0.3');
    await expect(marker).toBeVisible();
    await expect.poll(() => lineCounts).toEqual([1, 1]);
    await page.mouse.up();

    await expect(editor.locator(':scope > p').first()).toHaveText(text);
    await expect(marker).toHaveCount(0);
    await expect(editor).not.toHaveClass(/inkio-block-pickup/);
  });

  test('touch lifts a padded block preview, cancels, and then moves the block once', async ({ browser }) => {
    const context = await touchContext(browser);
    try {
      const page = await context.newPage();
      await page.goto('http://localhost:4174/block-e2e');
      const editor = page.locator('.ProseMirror[contenteditable="true"]');
      const source = editor.getByText('끝 문단', { exact: true });
      const target = editor.getByText('앞 문단', { exact: true });
      const first = editor.locator(':scope > p').first();
      const handle = page.getByRole('button', { name: '블록 핸들' });
      const preview = page.locator('.inkio-block-drag-preview');
      const marker = page.locator('.inkio-block-drop-marker');
      const touch = await touchDriver(page);
      const lift = async () => {
        await source.tap();
        await expect(handle).toBeVisible();
        const grip = (await handle.boundingBox())!;
        const drop = (await target.boundingBox())!;
        const finger = await touch({ x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 });
        await finger.move(drop.x + 24, drop.y + 2);
        await expect(preview).toBeVisible();
        await expect(preview).toContainText('끝 문단');
        const sourceWidth = (await source.boundingBox())!.width;
        const contentWidth = (await preview.locator('p').boundingBox())!.width;
        expect(contentWidth).toBeCloseTo(sourceWidth, 0);
        const inset = await preview.evaluate((element) => {
          const style = getComputedStyle(element);
          return Math.min(parseFloat(style.paddingTop), parseFloat(style.paddingLeft));
        });
        expect(inset).toBeGreaterThanOrEqual(8);
        await expect(marker).toBeVisible();
        return finger;
      };

      const canceled = await lift();
      await canceled.cancel();
      await expect(first).toHaveText('앞 문단');
      await expect(preview).toHaveCount(0);
      await expect(marker).toHaveCount(0);

      const dropped = await lift();
      await dropped.end();
      await expect(first).toHaveText('끝 문단');
      await expect(source).toHaveCount(1);
      await expect(preview).toHaveCount(0);
      await expect(marker).toHaveCount(0);
      await editor.press('ControlOrMeta+z');
      await expect(first).toHaveText('앞 문단');
    } finally {
      await context.close();
    }
  });

  for (const fill of [true, false]) {
    test(`touch edge-scrolls and drops a long block in ${fill ? 'a fixed-height editor' : 'the page'}`, async ({ browser }) => {
      const context = await touchContext(browser, { width: 393, height: 590 });
      try {
        const page = await context.newPage();
        await page.goto('http://localhost:4174/block-e2e');
        if (fill) await page.getByLabel('Custom menu layout').check();
        const editor = blockEditor(page);
        const body = page.locator('.inkio-editor-body').filter({ has: editor });
        const source = editor.getByText(/^끝 문단 길게/);
        const grip = page.getByRole('button', { name: '블록 핸들' });
        const preview = page.locator('.inkio-block-drag-preview');
        const marker = page.locator('.inkio-block-drop-marker');
        await editor.getByText('끝 문단', { exact: true }).click();
        await page.keyboard.press('End');
        await page.keyboard.insertText(' 길게 잡히는 블록을 만들기 위한 문장입니다.'.repeat(8));
        // A single paste lays out every drop target before the gesture. On
        // iOS, ProseMirror can defer Enter until after the next touch begins.
        const below = Array.from({ length: 36 }, (_, i) => `아래 문단 ${i}`);
        await pasteClipboard(page, `\n${below.join('\n')}`);
        await expect(source.locator('xpath=following-sibling::p')).toHaveText(below);

        const touch = await touchDriver(page);
        const readScroll = () => fill ? body.evaluate((el) => el.scrollTop) : page.evaluate(() => scrollY);
        const lift = async () => {
          await source.scrollIntoViewIfNeeded();
          await source.tap({ position: { x: 60, y: 8 } });
          await expect(grip).toBeVisible();
          const handle = (await grip.boundingBox())!;
          const box = (await body.boundingBox())!;
          const viewportHeight = page.viewportSize()!.height;
          const top = fill ? Math.max(box.y, 0) : 0;
          const bottom = fill ? Math.min(box.y + box.height, viewportHeight) : viewportHeight;
          const finger = await touch({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 });
          const move = (y: number) => finger.move(box.x + 72, y);
          return { finger, move, up: top + 3, down: bottom - 3 };
        };

        let drag = await lift();
        const start = await readScroll();
        await drag.move(drag.down);
        await expect(preview).toBeVisible();
        await expect.poll(readScroll).toBeGreaterThan(start + 220);
        await expect(grip).toHaveCSS('opacity', '0');
        const lower = await readScroll();
        await drag.move(drag.up);
        await expect.poll(readScroll).toBeLessThan(lower - 100);
        await drag.finger.cancel();
        await expect(preview).toHaveCount(0);
        await expect(marker).toHaveCount(0);
        await expect(source.locator('xpath=following-sibling::p[1]')).toHaveText('아래 문단 0');
        const stopped = await readScroll();
        await page.evaluate(async () => {
          for (let i = 0; i < 4; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
        });
        expect(await readScroll()).toBe(stopped);

        if (fill) {
          await source.scrollIntoViewIfNeeded();
          await source.tap({ position: { x: 60, y: 8 } });
          await grip.tap();
          const menu = page.getByRole('menu');
          await expect(menu).toBeVisible();
          await expect(source).toHaveJSProperty('tagName', 'P');
          await page.touchscreen.tap(4, 4);
          await expect(menu).toHaveCount(0);
        }

        drag = await lift();
        const before = await readScroll();
        await drag.move(drag.down);
        await expect.poll(readScroll).toBeGreaterThan(before + 530);
        await expect(marker).toBeVisible();
        // The page keeps scrolling between Playwright calls. Read the visible
        // marker in the capture phase of the actual release, before it is removed.
        const release = await editor.evaluateHandle((root) => ({
          gap: new Promise<{ before: string; after: string }>((resolve, reject) => {
            window.addEventListener('pointerup', (event) => {
              const marker = document.querySelector('.inkio-block-drop-marker')?.getBoundingClientRect();
              if (marker) {
                const y = marker.top + marker.height / 2;
                for (const p of root.querySelectorAll(':scope > p')) {
                  const next = p.nextElementSibling;
                  if (!p.textContent?.startsWith('아래 문단 ') || next?.tagName !== 'P') continue;
                  const a = p.getBoundingClientRect();
                  const b = next.getBoundingClientRect();
                  if (Math.abs(y - (a.bottom + b.top) / 2) <= 1 &&
                      event.clientY >= a.top && event.clientY <= b.bottom) {
                    resolve({ before: p.textContent, after: next.textContent! });
                    return;
                  }
                }
              }
              reject(new Error('No drop marker between the paragraphs under the released finger'));
            }, { capture: true, once: true });
          }),
        }));
        await drag.finger.end();
        const target = await release.evaluate(({ gap }) => gap);
        await release.dispose();
        await expect(source.locator('xpath=preceding-sibling::*[1]')).toHaveText(target.before);
        await expect(source.locator('xpath=following-sibling::*[1]')).toHaveText(target.after);
        await expect(marker).toHaveCount(0);
        await expect(preview).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }

  test('touch block menu moves one sibling without dragging or leaving its list', async ({ browser }) => {
    const context = await touchContext(browser, { width: 320, height: 440 });
    try {
      const page = await context.newPage();
      await page.goto('http://localhost:4174/block-e2e');
      const editor = blockEditor(page);
      const menu = page.getByRole('menu');
      const up = menu.getByRole('menuitem', { name: '위로 한 칸' });
      const down = menu.getByRole('menuitem', { name: '아래로 한 칸' });
      const tapHandle = async () => {
        await page.getByRole('button', { name: '블록 핸들' }).tap();
        await expect(menu).toBeVisible();
      };
      const open = async (text: string) => {
        await editor.getByText(text, { exact: true }).tap();
        await tapHandle();
      };

      await open('앞 문단');
      await expect(up).toHaveCount(0);
      await down.tap();
      await expect(editor.locator(':scope > ul + p').first()).toHaveText('앞 문단');
      await expect(menu).toHaveCount(0);
      await tapHandle();
      await down.tap();
      await expect(editor.locator(':scope > ul + p + p').first()).toHaveText('앞 문단');
      for (let i = 0; i < 2; i++) {
        await expect(menu).toHaveCount(0);
        await tapHandle();
        await up.tap();
      }
      await expect(editor.locator(':scope > p').first()).toHaveText('앞 문단');

      await open('둘');
      await expect(down).toHaveCount(0);
      await up.tap();
      await expect(editor.locator(':scope > ul > li')).toHaveText(['둘', '하나']);
      await editor.press('ControlOrMeta+z');
      await expect(editor.locator(':scope > ul > li')).toHaveText(['하나', '둘']);
    } finally {
      await context.close();
    }
  });

  test('scoped themes keep the two editor palettes and the detached slash menu independent', async ({ page }) => {
    await page.getByLabel('Compare themes').check();
    const light = page.getByTestId('theme-probe-light');
    const dark = page.getByTestId('theme-probe-dark');
    await expect(light.locator('.hljs-keyword')).toHaveCSS('color', 'rgb(215, 58, 73)');
    await expect(dark.locator('.hljs-keyword')).toHaveCSS('color', 'rgb(255, 123, 114)');
    await dark.locator('.inkio-content > p').click();
    await page.keyboard.insertText('/');
    await expect(page.getByRole('listbox')).toHaveCSS('color-scheme', 'dark');
    await expect(light.locator('.hljs-keyword')).toHaveCSS('color', 'rgb(215, 58, 73)');
  });

  test('a new toggle opens, and Enter in its summary goes inside', async ({ page }) => {
    await replaceWith(page, '가');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/토글');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(blockEditor(page).locator('[data-type="detailsContent"]')).toBeVisible();
    await page.keyboard.type('요약');
    await page.keyboard.press('Enter');
    await page.keyboard.type('내용');
    await expect(blockEditor(page).locator('[data-type="detailsContent"]')).toHaveText('내용');
    await expect(blockEditor(page).locator('[data-type="detailsContent"]')).toBeVisible();
  });

  test('@ opens nothing when the app gave no mentions', async ({ page }) => {
    await replaceWith(page, '가');
    await page.keyboard.type(' @가');
    await page.waitForTimeout(300);
    await expect(page.locator('.inkio-suggestion-container')).toHaveCount(0);
  });

  test('a divider alone pastes as a divider', async ({ page }) => {
    await replaceWith(page, '가\n\n---\n\n나');
    await expect(blockEditor(page).locator('hr')).toHaveCount(1);
  });

  test('the keyboard block menu highlights its source and Enter keeps the block', async ({ page }) => {
    const block = blockEditor(page).getByText('앞 문단', { exact: true });
    await block.click();
    await page.keyboard.press('Shift+F10');
    const menu = page.locator('.inkio-block-handle-action-menu');
    await expect(menu).toBeFocused();
    await expect(block).toHaveClass(/inkio-block-selected/);
    await page.keyboard.press('Enter');
    await expect(block).toBeVisible();
    await expect(block).not.toHaveClass(/inkio-block-selected/);

    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
  });

  test('an empty editor asks in its locale', async ({ page }) => {
    await blockEditor(page).evaluate((root) => {
      (root as unknown as { editor: { commands: { clearContent: () => void } } }).editor.commands.clearContent();
    });
    await expect(blockEditor(page).locator('p').first()).toHaveAttribute('data-placeholder', '내용을 입력하세요');
  });
});

// Set directly, not pasted: Firefox ignores clipboardData on a synthetic paste.
const TABLE = '<table><tbody><tr><th><p>가</p></th><th><p>뒤</p></th></tr><tr><td><p>다</p></td><td><p>라</p></td></tr></tbody></table>';
const NESTED = '<ul><li><p>앞</p><ul><li><p>뒤</p></li></ul></li></ul>';

test.describe('Tab', () => {
  async function fill(page: import('@playwright/test').Page, html: string, caretAfter: string) {
    await page.goto('http://localhost:4174/block-e2e');
    await expect(blockEditor(page)).toContainText('끝 문단');
    await blockEditor(page).evaluate(async (root, [text, after]) => {
      const { editor } = root as unknown as { editor: any };
      editor.commands.setContent(text);
      editor.commands.focus();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let at = -1;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (at < 0 && node.isText && node.text.includes(after)) at = pos + node.text.indexOf(after) + after.length;
      });
      editor.chain().focus().setTextSelection(at).run();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, [html, caretAfter] as const);
  }
  const focused = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.activeElement?.classList.contains('ProseMirror'));

  test('types a tab in a paragraph and Shift+Tab takes it back', async ({ page }) => {
    await fill(page, '<p>가나</p>', '가');
    await page.keyboard.press('Tab');
    await page.keyboard.type('다');
    await expect(blockEditor(page).locator('p').first()).toHaveText('가\t다나');
    expect(await focused(page)).toBe(true);

    await page.keyboard.press('Backspace');
    await page.keyboard.press('Shift+Tab');
    await expect(blockEditor(page).locator('p').first()).toHaveText('가나');
  });

  test('indents code by two spaces and stays in the block', async ({ page }) => {
    await fill(page, '<pre><code>가</code></pre>', '가');
    await page.keyboard.press('Tab');
    await page.keyboard.type('나');
    await expect(blockEditor(page).locator('pre')).toContainText('가  나');
    expect(await focused(page)).toBe(true);
  });

  test('still nests a list item and moves between table cells', async ({ page }) => {
    await fill(page, '<ul><li><p>가</p></li><li><p>나</p></li></ul>', '나');
    await page.keyboard.press('Tab');
    await expect(blockEditor(page).locator('li li')).toHaveText('나');

    await fill(page, TABLE.replace('뒤', '나'), '가');
    await page.keyboard.press('Tab');
    await page.keyboard.type('X');
    await expect(blockEditor(page).locator('th').nth(1)).toContainText('X');
  });

  test('Escape leaves the editor, and closes an open menu first', async ({ page }) => {
    await fill(page, '<p>가</p>', '가');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await focused(page)).toBe(true);

    await page.keyboard.press('Escape');
    await expect.poll(() => focused(page)).toBe(false);
  });
});

test.describe('slash menu inside other blocks', () => {
  async function slashIn(page: import('@playwright/test').Page, html: string) {
    await page.goto('http://localhost:4174/block-e2e');
    await expect(blockEditor(page)).toContainText('끝 문단');
    await blockEditor(page).evaluate(async (root, text) => {
      const { editor } = root as unknown as { editor: any };
      editor.commands.setContent(text);
      editor.commands.focus();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let at = -1;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (at < 0 && node.isText && node.text.includes('뒤')) at = pos;
      });
      editor.chain().focus().setTextSelection({ from: at, to: at + 1 }).deleteSelection().run();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, html);
    await page.keyboard.type('/');
  }
  const pick = async (page: import('@playwright/test').Page, label: string) => {
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  const outline = (page: import('@playwright/test').Page) =>
    blockEditor(page).evaluate((root) => {
      const { editor } = root as unknown as { editor: { getJSON: () => { content: { type: string }[] } } };
      return editor.getJSON().content.map((node) => node.type);
    });

  for (const [place, markdown] of [
    ['a bullet', '<ul><li><p>앞</p></li><li><p>뒤</p></li></ul>'],
    ['a numbered item', '<ol><li><p>앞</p></li><li><p>뒤</p></li></ol>'],
    ['a task', '<ul data-type="taskList"><li data-type="taskItem"><p>앞</p></li><li data-type="taskItem"><p>뒤</p></li></ul>'],
    ['a nested item', NESTED],
  ] as const) {
    test(`opens in ${place} and a block takes the item's place`, async ({ page }) => {
      await slashIn(page, markdown);
      await expect(page.getByRole('option', { name: '콜아웃', exact: true })).toBeVisible();
      await pick(page, '콜아웃');
      const blocks = await outline(page);
      expect(blocks.slice(1)).toEqual(['callout']);
    });
  }

  test('a table leaves the list with no empty line behind', async ({ page }) => {
    await slashIn(page, '<ul><li><p>앞</p></li><li><p>뒤</p></li></ul>');
    await pick(page, '표');
    expect(await outline(page)).toEqual(['bulletList', 'table']);
    await expect(blockEditor(page).locator('li')).toHaveCount(1);
  });

  test('a command for the list it is in only removes the slash', async ({ page }) => {
    await slashIn(page, NESTED);
    await pick(page, '글머리 목록');
    await expect(blockEditor(page).locator('li li')).toHaveCount(1);
    await expect(blockEditor(page).locator('li li')).toHaveText('');
  });

  test('a cell offers no table, and shows no descriptions', async ({ page }) => {
    await slashIn(page, TABLE);
    await expect(page.getByRole('option', { name: '코드 블록', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: '표', exact: true })).toHaveCount(0);
    await expect(page.locator('.inkio-suggestion-description')).toHaveCount(0);
  });
});

test('an app can replace every icon the editor draws', async ({ page }) => {
  await page.goto('http://localhost:4174/icons-e2e');
  const editor = blockEditor(page);
  await expect(editor).toContainText('끝 문단');
  const foreign = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('svg:not([data-app-icon])')).map((svg) => svg.parentElement?.className || svg.parentElement?.tagName));
  const allAppIcons = async () => expect(await foreign()).toEqual([]);

  await editor.getByText('앞 문단', { exact: true }).hover();
  const handle = page.locator('[aria-label="블록 핸들"]');
  await expect(handle.locator('svg[data-app-icon]')).toHaveCount(1);
  await allAppIcons();

  await handle.click();
  await expect(page.locator('.inkio-block-handle-action-menu svg[data-app-icon]').first()).toBeVisible();
  await allAppIcons();
  await page.keyboard.press('Escape');

  await page.locator('.ProseMirror td').first().hover();
  await expect(page.locator('.inkio-table-insert svg[data-app-icon]').first()).toBeAttached();
  await allAppIcons();

  await editor.getByText('코드', { exact: true }).hover();
  await allAppIcons();

  await editor.evaluate((root) => {
    const { editor: tiptap } = root as unknown as { editor: { chain: () => any; state: { doc: { content: { size: number } } } } };
    const end = tiptap.state.doc.content.size - 1;
    tiptap.chain().focus().setTextSelection({ from: end - 2, to: end }).run();
  });
  await expect(page.locator('.inkio-floating-overlay.is-visible svg[data-app-icon]').first()).toBeVisible();
  await allAppIcons();

  await editor.evaluate((root) => {
    (root as unknown as { editor: { commands: { focus: (at: string) => void } } }).editor.commands.focus('end');
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Enter');
  await allAppIcons();
  await page.keyboard.type('/');
  // Scoped: the code block's language picker has options too.
  const popup = page.getByRole('listbox', { name: '추천 항목' });
  await expect(popup.getByRole('option').first().locator('svg[data-app-icon]')).toBeVisible();
  await allAppIcons();
});

test.describe('writing a document', () => {
  type Root = { editor: { commands: { setContent: (doc: unknown) => void; focus: (position?: string) => void }; getJSON: () => { content: { type: string }[] } } };

  async function load(page: import('@playwright/test').Page, content: unknown[]) {
    await page.goto('http://localhost:4174/slash-e2e');
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
    await editor.evaluate((root, doc) => {
      (root as unknown as Root).editor.commands.setContent({ type: 'doc', content: doc });
      (root as unknown as Root).editor.commands.focus('end');
    }, content);
    await expect(editor).toBeFocused();
    return editor;
  }
  const types = (editor: import('@playwright/test').Locator) =>
    editor.evaluate((root) => (root as unknown as Root).editor.getJSON().content.map((node) => node.type));
  const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  test('a table of contents stays when writing goes on after it', async ({ page }) => {
    const editor = await load(page, [paragraph('앞'), { type: 'paragraph' }]);
    await page.keyboard.type('/toc');
    await expect(page.getByRole('option', { name: '목차', exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('다음 글');
    await expect.poll(() => types(editor)).toEqual(['paragraph', 'tocBlock', 'paragraph']);
    await expect(editor.locator('p').last()).toHaveText('다음 글');
  });

  for (const [name, block] of [
    ['an image', { type: 'imageBlock', attrs: { src: '/favicon.ico' } }],
    ['a table of contents', { type: 'tocBlock' }],
  ] as const) {
    const select = (editor: import('@playwright/test').Locator, pos: number) =>
      editor.evaluate((root, at) => {
        (root as unknown as Root).editor.commands.setNodeSelection(at);
        (root as unknown as Root).editor.commands.focus();
      }, pos);

    test(`typing with ${name} selected writes below and keeps it`, async ({ page }) => {
      const editor = await load(page, [paragraph('앞'), block]);
      await select(editor, 3);
      await page.keyboard.type('below');
      expect(await types(editor)).toEqual(['paragraph', block.type, 'paragraph']);
      await expect(editor.locator(':scope > p').last()).toHaveText('below');
    });

    compositionTest(`composing Korean with ${name} selected writes below and keeps it`, async ({ page, ime }) => {
      const editor = await load(page, [paragraph('앞'), block]);
      await select(editor, 3);
      await ime.compose('ㅎ', '하', '한');
      expect(await types(editor)).toEqual(['paragraph', block.type, 'paragraph']);
      await expect(editor.locator(':scope > p').last()).toHaveText('한');
    });
  }

  test('typing with a block selected uses an empty line already below it', async ({ page }) => {
    const editor = await load(page, [{ type: 'tocBlock' }, { type: 'paragraph' }]);
    await editor.evaluate((root) => {
      (root as unknown as Root).editor.commands.setNodeSelection(0);
      (root as unknown as Root).editor.commands.focus();
    });
    await page.keyboard.type('x');
    expect(await types(editor)).toEqual(['tocBlock', 'paragraph']);
    await expect(editor.locator(':scope > p')).toHaveText('x');
  });

  test('Backspace still removes a selected block', async ({ page }) => {
    const editor = await load(page, [paragraph('앞'), { type: 'tocBlock' }, paragraph('뒤')]);
    await editor.evaluate((root) => {
      (root as unknown as Root).editor.commands.setNodeSelection(3);
      (root as unknown as Root).editor.commands.focus();
    });
    await page.keyboard.press('Backspace');
    expect(await types(editor)).toEqual(['paragraph', 'paragraph']);
  });

  const cell = { type: 'tableCell', content: [paragraph('셀')] };
  for (const [name, block, inside] of [
    ['an image', { type: 'imageBlock', attrs: { src: `data:image/png;base64,${onePixelPng}` } }, 'img'],
    ['a callout', { type: 'callout', content: [paragraph('콜아웃')] }, 'p'],
    ['a quote', { type: 'blockquote', content: [paragraph('인용')] }, 'p'],
    ['a table', { type: 'table', content: [{ type: 'tableRow', content: [cell, cell] }] }, 'td'],
  ] as const) {
    const lastBlockTypes = [paragraph('앞').type, block.type];
    test(`a click under ${name} at the end makes a line below it`, async ({ page }) => {
      const editor = await load(page, [paragraph('앞'), block]);
      expect(await types(editor)).toEqual(lastBlockTypes);
      if (block.type === 'imageBlock') await editor.locator('img').evaluate((img) => img.decode());
      const position = await editor.evaluate((root) => {
        const editorRect = root.getBoundingClientRect();
        const blockRect = root.lastElementChild!.getBoundingClientRect();
        return { x: blockRect.left + blockRect.width / 2 - editorRect.left, y: blockRect.bottom + 4 - editorRect.top };
      });
      // Locator coordinates stay relative to the editor as Playwright scrolls the point into view.
      await editor.click({ position });
      await expect.poll(() => types(editor)).toEqual([...lastBlockTypes, 'paragraph']);
      await page.keyboard.type('아래 글');
      await expect(editor.locator(':scope > p').last()).toHaveText('아래 글');
    });

    test(`clicking inside ${name} adds nothing, and ArrowDown makes the line`, async ({ page }) => {
      const editor = await load(page, [paragraph('앞'), block]);
      await editor.locator(`:scope > :last-child ${inside}`).first().click();
      await page.waitForTimeout(100);
      expect(await types(editor)).toEqual(lastBlockTypes);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.type('아래 글');
      await expect(editor.locator(':scope > p').last()).toHaveText('아래 글');
    });
  }

  test('Backspace at the start of a list item does not hide a paragraph inside the item above', async ({ page }) => {
    const editor = await load(page, [{ type: 'paragraph' }]);
    await page.keyboard.type('- 하나');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await expect(editor.locator('li p')).toHaveCount(1);
  });

  test('a command is found with the space in its name, and a sentence closes the menu', async ({ page }) => {
    await load(page, [{ type: 'paragraph' }]);
    await page.keyboard.type('/코드 블록');
    await expect(page.getByRole('option')).toHaveText(['코드 블록']);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('/없는 명령 입니다');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('the block menu turns a list into a heading, and offers a table only what it can do', async ({ page }) => {
    const editor = await load(page, [
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('항목')] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('셀')] }] }] },
      paragraph('끝'),
    ]);
    const openMenuOn = async (selector: string) => {
      const line = editor.locator(`${selector} p`).first();
      const handle = page.getByRole('button', { name: '블록 핸들', exact: true });
      await line.hover();
      // The previous block's handle remains visible until the hover frame
      // repositions it. Don't move the pointer back to that stale location.
      await expect.poll(async () => {
        const [grip, target] = await Promise.all([handle.boundingBox(), line.boundingBox()]);
        if (!grip || !target) return false;
        const center = grip.y + grip.height / 2;
        return center >= target.y && center <= target.y + target.height;
      }).toBe(true);
      await handle.click();
    };

    await openMenuOn('td');
    await expect(page.getByRole('menuitem')).toHaveText(['삭제', '복제', '위로 한 칸', '아래로 한 칸']);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await openMenuOn('li');
    await page.getByRole('menuitem', { name: '제목 1' }).click();
    await expect(editor.locator('h1')).toHaveText('항목');
    await expect(editor.locator('li')).toHaveCount(0);
  });

  test('a table too wide for the screen scrolls instead of squeezing its cells', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    const cells = Array.from({ length: 6 }, () => ({ type: 'tableCell', content: [paragraph('내용')] }));
    const editor = await load(page, [{ type: 'table', content: [{ type: 'tableRow', content: cells }] }, paragraph('끝')]);
    const width = (await editor.locator('td').first().boundingBox())!.width;
    expect(width).toBeGreaterThanOrEqual(90);
    const wrapper = editor.locator('.tableWrapper');
    expect(await wrapper.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
