import { readFile } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
import { expect, test, type BrowserServer, type Page } from '@playwright/test';

type Compose = (...steps: [string, ...string[]]) => Promise<void>;

// Marionette frames are UTF-8 byte-length-prefixed, not newline-delimited.
// https://firefox-source-docs.mozilla.org/remote/marionette/Protocol.html
async function* frames(socket: Socket) {
  let pending = Buffer.alloc(0);
  for await (const chunk of socket) {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      const colon = pending.indexOf(':');
      if (colon < 0) break;
      const end = colon + 1 + Number(pending.toString('ascii', 0, colon));
      if (end > pending.length) break;
      yield JSON.parse(pending.toString('utf8', colon + 1, end));
      pending = pending.subarray(end);
    }
  }
  throw new Error('Firefox closed the Marionette connection.');
}

async function withFirefoxIME(server: BrowserServer, page: Page, use: (compose: Compose) => Promise<void>) {
  const args = server.process().spawnargs;
  const profileFlag = args.indexOf('-profile');
  if (profileFlag < 0) throw new Error('Expected a temporary Firefox profile.');
  const portFile = join(args[profileFlag + 1], 'MarionetteActivePort');
  let port = 0;
  await expect(async () => {
    port = Number(await readFile(portFile, 'utf8'));
    expect(port).toBeGreaterThan(0);
  }).toPass({ timeout: 5_000 });

  const socket = connect(port, '127.0.0.1');
  try {
    const replies = frames(socket);
    const hello = (await replies.next()).value;
    if (hello?.marionetteProtocol !== 3) throw new Error('Expected Marionette protocol 3.');
    let sequence = 0;
    async function command(name: string, params: object) {
      const body = JSON.stringify([0, ++sequence, name, params]);
      socket.write(`${Buffer.byteLength(body)}:${body}`);
      const [type, id, error] = (await replies.next()).value;
      if (type !== 1 || id !== sequence || error) {
        throw new Error(`Marionette ${name}: ${error?.message ?? 'unexpected response'}`);
      }
    }
    await command('WebDriver:NewSession', {});
    await command('Marionette:SetContext', { value: 'chrome' });
    await use(async (...steps) => {
      await page.bringToFront();
      // Run in Firefox's automation context, not the web page. The native text
      // input processor owns the marked range and targets the focused editor.
      await command('WebDriver:ExecuteScript', {
        script: `
          const tip = Cc['@mozilla.org/text-input-processor;1'].createInstance(Ci.nsITextInputProcessor);
          if (!tip.beginInputTransactionForTests(window)) throw new Error('Could not start an input transaction.');
          const key = new window.KeyboardEvent('', { key: 'Process', keyCode: 229 });
          tip.startComposition(key);
          for (const text of arguments[0]) {
            tip.setPendingCompositionString(text);
            tip.appendClauseToPendingComposition(text.length, tip.ATTR_RAW_CLAUSE);
            tip.setCaretInPendingComposition(text.length);
            tip.flushPendingComposition();
          }
          tip.commitComposition();`,
        args: [steps], newSandbox: true,
      });
    });
  } finally {
    socket.destroy();
  }
}

// Playwright WebKit has no marked-text command. Model the composition lifecycle
// and replace each provisional string via browser editing. The composition events
// are synthetic; the edits are real insertText, not native insertCompositionText.
async function composeInWebKit(page: Page, ...steps: Parameters<Compose>) {
  const target = page.locator(':focus');
  const processKey = { key: 'Process', keyCode: 229, bubbles: true, cancelable: true };
  await target.dispatchEvent('keydown', processKey);
  await target.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  let previous = '';
  for (const text of steps) {
    await target.evaluate((el, { previous, text }) => {
      const selection = window.getSelection()!;
      for (const _ of previous) selection.modify('extend', 'backward', 'character');
      if (selection.toString() !== previous) throw new Error(`Lost provisional text: ${previous}`);
      el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: text }));
    }, { previous, text });
    await page.keyboard.insertText(text);
    previous = text;
  }
  await target.evaluate((el, data) => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data })), previous);
  // Safari reports the IME's confirming keydown after compositionend. The
  // editor must not mistake that key for the user's next Enter or Tab.
  await target.dispatchEvent('keydown', processKey);
  await target.dispatchEvent('keyup', processKey);
}

export const compositionTest = test.extend<{ compose: Compose }, { imeServer: BrowserServer | undefined }>({
  imeServer: [async ({ browserName, playwright, headless, launchOptions }, use) => {
    if (browserName !== 'firefox') return use(undefined);
    // Only IME tests opt into browser-chrome automation. Both listeners are
    // ephemeral and loopback-only; Playwright owns and removes the profile.
    const server = await playwright.firefox.launchServer({
      ...launchOptions, headless, host: '127.0.0.1', port: 0,
      args: [...(launchOptions.args ?? []), '-marionette', '-remote-allow-system-access'],
      env: { ...process.env, ...launchOptions.env, MOZ_MARIONETTE_PREF_STATE_ACROSS_RESTARTS: '{"marionette.port":0}' },
    });
    try { await use(server); } finally { await server.close(); }
  }, { scope: 'worker' }],
  connectOptions: async ({ imeServer, connectOptions }, use) => {
    await use(imeServer ? { wsEndpoint: imeServer.wsEndpoint() } : connectOptions);
  },
  compose: async ({ page, browserName, imeServer }, use) => {
    if (imeServer) return withFirefoxIME(imeServer, page, use);
    if (browserName === 'webkit') return use((...steps) => composeInWebKit(page, ...steps));
    const cdp = await page.context().newCDPSession(page);
    try {
      await use(async (...steps) => {
        await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', windowsVirtualKeyCode: 229 });
        for (const text of steps) {
          await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
        }
        await cdp.send('Input.insertText', { text: steps[steps.length - 1] });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Process', windowsVirtualKeyCode: 229 });
      });
    } finally {
      await cdp.detach();
    }
  },
});
