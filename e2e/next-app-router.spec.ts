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
  await expect(page.locator('.inkio-suggestion-header')).toHaveText('명령어');
  await expect(page.getByRole('listbox', { name: '추천 항목' })).toBeVisible();

  await compose(page, 'ㅍ', '표');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('표 넣기');

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
