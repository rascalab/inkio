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

  // The image takes the empty line's place, and writing continues below it.
  await page.keyboard.type('below the image');
  const lastBlocks = await editor.evaluate((root) => {
    const { content } = (root as unknown as { editor: { getJSON: () => { content: { type: string; content?: unknown[] }[] } } }).editor.getJSON();
    return content.slice(-2).map((node) => ({ type: node.type, empty: !node.content }));
  });
  expect(lastBlocks).toEqual([
    { type: 'imageBlock', empty: true },
    { type: 'paragraph', empty: false },
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
  await expect(editor.locator('.selectedCell')).toHaveCount(2);
  await menu.getByRole('menuitem', { name: '셀 병합' }).click();
  await expect(editor.locator('td[colspan="2"]')).toHaveCount(1);

  await editor.locator('td[colspan="2"]').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '셀 분할' }).click();
  await expect(editor.locator('td[colspan="2"]')).toHaveCount(0);
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

  await focusEditorEnd(page);
  await page.keyboard.type(' mirrored into the viewer');

  await expect(viewer).toContainText('Viewer harness mirrored into the viewer');
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
  await editor.locator('p').first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Shift+ArrowRight');
  }
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
  await editor.locator('p').first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Shift+ArrowRight');
  }
  await page.keyboard.press('ControlOrMeta+Shift+m');
  const composer = page.locator('.inkio-comment-composer');
  await expect(composer).toBeVisible();
  await composer.locator('.inkio-comment-composer-input').fill('Thread root');
  await composer.locator('.inkio-comment-composer-submit').click();
  await expect(page.locator('.inkio-comment-msg')).toHaveCount(1);

  // Reply to the thread.
  const replyInput = page.locator('.inkio-comment-reply-input').first();
  await replyInput.fill('A threaded reply');
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

// CDP drives the browser's own composition path, which is what an input method
// does: the text changes in place until it is committed, unlike keyboard.type.
async function compose(page: import('@playwright/test').Page, ...steps: string[]) {
  const cdp = await page.context().newCDPSession(page);
  const last = steps[steps.length - 1];
  for (const text of steps) {
    await cdp.send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }
  await cdp.send('Input.insertText', { text: last });
  await cdp.detach();
}

test('slash menu speaks the editor locale and finds a command typed in Korean', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'composition is driven through CDP');
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  await expect(page.locator('.inkio-suggestion-header')).toHaveCount(0);
  await expect(page.getByRole('listbox', { name: '추천 항목' })).toBeVisible();

  await compose(page, 'ㅍ', '표');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveText('표');

  await page.keyboard.press('Enter');
  const editor = page.locator('.ProseMirror').first();
  await expect(editor.locator('table')).toHaveCount(1);
  await expect(editor).not.toContainText('/표');
});

test('slash menu says nothing matched in the editor locale', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'composition is driven through CDP');
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  await compose(page, 'ㅎ', '하', '핳');
  await expect(page.locator('.inkio-suggestion-empty')).toHaveText('검색 결과 없음');
});

test('Korean composition lands where the caret is', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'composition is driven through CDP');
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);

  await compose(page, 'ㅎ', '하', '한');
  await compose(page, 'ㄱ', '그', '글');
  await page.keyboard.press('Enter');
  await compose(page, 'ㄷ', '다', '달');
  await page.keyboard.press('Backspace');

  const paragraphs = page.locator('.ProseMirror').first().locator('p');
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

async function dragBlock(
  page: import('@playwright/test').Page,
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
  test.skip(({ browserName }) => browserName !== 'chromium', 'one drag path is enough');

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

test.describe('markdown paste', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Firefox ignores clipboardData in the ClipboardEvent constructor');

  async function pasteText(page: import('@playwright/test').Page, target: string, text: string, html?: string) {
    await blockEditor(page).getByText(target, { exact: true }).click();
    await page.keyboard.press('End');
    await blockEditor(page).evaluate(async (root, [plain, rich]) => {
      // A real paste comes well after the caret settles; the editor reads the
      // selection change asynchronously and a paste does not flush it.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', plain);
      if (rich) clipboardData.setData('text/html', rich);
      root.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, [text, html] as const);
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

test('a table inserted from the menu takes Korean and Tab moves between cells', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'composition is driven through CDP');
  await page.goto('http://localhost:4174/slash-e2e');
  await focusEditorEnd(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await compose(page, 'ㅍ', '표');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');

  const table = page.locator('.ProseMirror').first().locator('table');
  await compose(page, 'ㅇ', '이', '이름');
  await page.keyboard.press('Tab');
  await compose(page, 'ㄱ', '가', '값');
  await expect(table.locator('th').nth(0)).toHaveText('이름');
  await expect(table.locator('th').nth(1)).toHaveText('값');
  await expect(table.locator('tr')).toHaveCount(3);
});

test.describe('editor surfaces', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'layout and synthetic paste are checked once');

  const long = Array.from({ length: 40 }, (_, i) => `문단 ${i}`).join('\n\n');

  async function replaceWith(page: import('@playwright/test').Page, markdown: string) {
    const editor = blockEditor(page);
    await editor.evaluate((root, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      (root as unknown as { editor: { commands: { clearContent: () => void; focus: () => void } } }).editor.commands.clearContent();
      (root as unknown as { editor: { commands: { focus: () => void } } }).editor.commands.focus();
      root.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, markdown);
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

  test('Enter right after opening the block menu keeps the block', async ({ page }) => {
    await blockEditor(page).getByText('앞 문단', { exact: true }).hover();
    await page.locator('[aria-label="블록 핸들"]').click();
    const menu = page.locator('.inkio-block-handle-action-menu');
    await expect(menu).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(blockEditor(page)).toContainText('앞 문단');

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

test('an app can replace every icon the editor draws', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'checked once');
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
  test.skip(({ browserName }) => browserName !== 'chromium', 'checked once');

  type Root = { editor: { commands: { setContent: (doc: unknown) => void; focus: (position?: string) => void }; getJSON: () => { content: { type: string }[] } } };

  async function load(page: import('@playwright/test').Page, content: unknown[]) {
    await page.goto('http://localhost:4174/slash-e2e');
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
    await editor.evaluate((root, doc) => {
      (root as unknown as Root).editor.commands.setContent({ type: 'doc', content: doc });
      (root as unknown as Root).editor.commands.focus('end');
    }, content);
    await page.waitForTimeout(100);
    return editor;
  }
  const types = (editor: import('@playwright/test').Locator) =>
    editor.evaluate((root) => (root as unknown as Root).editor.getJSON().content.map((node) => node.type));
  const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  test('a table of contents stays when writing goes on after it', async ({ page }) => {
    const editor = await load(page, [paragraph('앞'), { type: 'paragraph' }]);
    await page.keyboard.type('/toc');
    await page.keyboard.press('Enter');
    await page.keyboard.type('다음 글');
    await expect.poll(() => types(editor)).toEqual(['paragraph', 'tocBlock', 'paragraph']);
    await expect(editor.locator('p').last()).toHaveText('다음 글');
  });

  const cell = { type: 'tableCell', content: [paragraph('셀')] };
  for (const [name, block, inside] of [
    ['an image', { type: 'imageBlock', attrs: { src: '/favicon.ico' } }, 'img'],
    ['a callout', { type: 'callout', content: [paragraph('콜아웃')] }, 'p'],
    ['a quote', { type: 'blockquote', content: [paragraph('인용')] }, 'p'],
    ['a table', { type: 'table', content: [{ type: 'tableRow', content: [cell, cell] }] }, 'td'],
  ] as const) {
    const lastBlockTypes = [paragraph('앞').type, block.type];
    test(`a click under ${name} at the end makes a line below it`, async ({ page }) => {
      const editor = await load(page, [paragraph('앞'), block]);
      expect(await types(editor)).toEqual(lastBlockTypes);
      const last = await editor.evaluate((root) => {
        const rect = root.lastElementChild!.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, bottom: rect.bottom };
      });
      await page.mouse.click(last.x, last.bottom + 4);
      await page.waitForTimeout(100);
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
      const box = (await editor.locator(selector).first().boundingBox())!;
      await page.mouse.move(box.x + 30, box.y + 8);
      await page.locator('[aria-label="Block handle"], [aria-label="블록 핸들"]').first().click();
    };

    await openMenuOn('td');
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await page.keyboard.press('Escape');

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
