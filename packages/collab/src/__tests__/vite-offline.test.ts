// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build, resolveConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inkioOffline } from '../vite';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'inkio-offline-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><html><head></head><body><script type="module" src="/main.js"></script></body></html>');
  writeFileSync(join(root, 'main.js'), 'import "./style.css"; document.body.textContent = "Hello";');
  writeFileSync(join(root, 'style.css'), 'body { color: blue; }');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('inkioOffline', () => {
  it('registers externally and versions only the emitted static shell artifacts', async () => {
    const config = { root, configFile: false as const, base: '/preview', plugins: [inkioOffline({ routes: ['/', '/collab/'] })] };
    await build(config);

    const dist = join(root, 'dist');
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const workerPath = join(dist, 'inkio-offline-sw.js');
    const worker = readFileSync(workerPath, 'utf8');
    expect(html).toMatch(/<script\b[^>]*src="\/preview\/inkio-offline-register\.js"[^>]*><\/script>/);
    expect(worker).toContain('const routes = new Set(["/preview/","/preview/collab/"])');

    const assets = readdirSync(join(dist, 'assets')).map((file) => `assets/${file}`);
    expect(assets).toEqual(expect.arrayContaining([expect.stringMatching(/\.js$/), expect.stringMatching(/\.css$/)]));
    for (const file of ['index.html', 'inkio-offline-register.js', ...assets]) {
      const hash = createHash('sha256').update(readFileSync(join(dist, file))).digest('base64');
      expect(worker).toContain(JSON.stringify([`/preview/${file}`, `sha256-${hash}`]));
    }

    writeFileSync(join(root, 'style.css'), 'body { color: red; }');
    await build(config);
    const version = (source: string) => source.match(/const cacheName = cachePrefix \+ "([a-f\d]+)"/)?.[1];
    expect(version(worker)).toBeDefined();
    expect(version(readFileSync(workerPath, 'utf8'))).not.toBe(version(worker));
  });

  it('only serves the offline shell for allowlisted navigations with a network failure', async () => {
    await build({ root, configFile: false, base: '/preview/', plugins: [inkioOffline({ routes: ['/collab'] })] });
    const origin = 'https://app.example';
    const shell = new Response('static shell');
    const denied = new Response(null, { status: 401 });
    const fetch = vi.fn().mockResolvedValueOnce(denied).mockRejectedValue(new TypeError('offline'));
    const match = vi.fn().mockResolvedValue(shell);
    type Event = { request: object; respondWith: (result: Promise<Response>) => void };
    const handlers = new Map<string, (event: Event) => void>();
    runInNewContext(readFileSync(join(root, 'dist/inkio-offline-sw.js'), 'utf8'), {
      URL, fetch, caches: { match },
      self: { location: { origin }, addEventListener: handlers.set.bind(handlers) },
    });
    function dispatch(path: string, mode: string, headers = new Headers()) {
      let response: Promise<Response> | undefined;
      handlers.get('fetch')!({
        request: { method: 'GET', url: origin + path, mode, destination: mode === 'navigate' ? 'document' : '', headers },
        respondWith: (result) => { response = result; },
      });
      return response;
    }
    expect(dispatch('/api/collab-auth/session', 'same-origin')).toBeUndefined();
    expect(dispatch('/preview/collab', 'same-origin')).toBeUndefined();
    expect(dispatch('/preview/other', 'navigate')).toBeUndefined();
    expect(dispatch('/preview/collab', 'navigate', new Headers({ Authorization: 'test' }))).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(await dispatch('/preview/collab', 'navigate')).toBe(denied);
    expect(match).not.toHaveBeenCalled();
    expect(await dispatch('/preview/collab', 'navigate')).toBe(shell);
    expect(match).toHaveBeenCalledWith('/preview/index.html', { cacheName: expect.any(String) });
  });

  it('is inactive in serve mode', async () => {
    const config = await resolveConfig({ root, configFile: false, plugins: [inkioOffline({ routes: ['/'] })] }, 'serve');
    expect(config.plugins.map((plugin) => plugin.name)).not.toContain('inkio-offline');
  });

  it.each(['//other.example/path', 'relative', '/one/../two', '/room?x=1', '/room#x', '/room%2fother', '/room/*'])(
    'rejects noncanonical route %s',
    (route) => expect(() => inkioOffline({ routes: [route] })).toThrow('exact, slash-prefixed URL pathname'),
  );

  it.each(['./', '//other.example/path', 'https://other.example/', '/path/../app'])(
    'rejects unsupported base %s before Vite normalizes it',
    async (base) => {
      await expect(resolveConfig({ root, configFile: false, base, plugins: [inkioOffline({ routes: ['/'] })] }, 'build'))
        .rejects.toThrow('Vite base must be an exact, slash-prefixed URL pathname');
    },
  );

  it('rejects a JavaScript entry without a static index', async () => {
    await expect(build({ root, configFile: false, input: join(root, 'main.js'), plugins: [inkioOffline({ routes: ['/'] })] }))
      .rejects.toThrow('Vite SPA builds with a static root index.html');
  });
});
