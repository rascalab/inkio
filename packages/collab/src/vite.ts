import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite' with { 'resolution-mode': 'import' };

export interface InkioOfflineOptions {
  /** Exact SPA pathnames relative to Vite's base. `/` means the base itself. */
  routes: string[];
}

const indexFile = 'index.html';
const registerFile = 'inkio-offline-register.js';
const workerFile = 'inkio-offline-sw.js';

function fail(message: string): never {
  throw new Error(`[inkio-offline] ${message}`);
}

function checkPathname(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || /\/\/|[?#\\\s*]|%(?:2f|5c)|%(?![a-f\d]{2})/i.test(value)
    || new URL(value, 'https://example.invalid').pathname !== value) {
    fail(`${label} must be an exact, slash-prefixed URL pathname: ${JSON.stringify(value)}`);
  }
}

function integrity(source: string | Uint8Array): string {
  return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

function registrationScript(worker: string): string {
  return `"use strict";
(async () => {
  if (!("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  const script = new URL(${JSON.stringify(worker)}, location.origin);
  const scope = new URL("./", script).href;
  for (const registration of await sw.getRegistrations()) {
    if (!scope.startsWith(registration.scope) && !registration.scope.startsWith(scope)) continue;
    // Never replace or shadow a worker owned by a different app.
    const workers = [registration.installing, registration.waiting, registration.active].filter(Boolean);
    if (registration.scope !== scope || !workers.length || workers.some((worker) => worker.scriptURL !== script.href)) return;
  }
  await sw.register(script.href, { updateViaCache: "none" });
})().catch((error) => console.warn("[inkio-offline] Service worker registration failed", error));
`;
}

const workerBody = `
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Only cache the exact build bytes, never responses from a user's navigation.
    await cache.addAll(precache.map(([path, integrity]) => new Request(path, {
      integrity, mode: "same-origin", credentials: "omit", redirect: "error", cache: "no-store",
    })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("authorization") || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    if (routes.has(url.pathname)) event.respondWith(networkFirst(request, shell));
  } else if (!url.search && assets.get(url.pathname) === request.destination) {
    event.respondWith(networkFirst(request, url.href));
  }
});

async function networkFirst(request, path) {
  try {
    return await fetch(request);
  } catch (error) {
    const response = await caches.match(path, { cacheName });
    if (response) return response;
    throw error;
  }
}
`;

/** Reopen a static Vite 8 SPA offline after an online visit and service worker install. */
export function inkioOffline(options: InkioOfflineOptions): Plugin {
  if (!Array.isArray(options?.routes) || options.routes.length === 0) {
    fail('Provide at least one exact SPA pathname in routes.');
  }
  const routes = new Set<string>();
  for (const route of options.routes) {
    checkPathname(route, 'Each route');
    routes.add(route);
  }

  let base: string;
  let registrationInjected = false;
  return {
    name: 'inkio-offline',
    apply: 'build',
    config: {
      order: 'post',
      handler(config) {
        // Vite normalizes unsupported raw bases before configResolved.
        if (config.base !== undefined) checkPathname(config.base, 'Vite base');
      },
    },
    configResolved(config) {
      if (config.appType !== 'spa' || config.build.lib || config.build.ssr) {
        fail('Only client-side Vite SPA builds with a static root index.html are supported.');
      }
      base = config.base;
      checkPathname(base, 'Vite base');
      const build = config.environments.client.build;
      if (Array.isArray(build.rolldownOptions?.output) && build.rolldownOptions.output.length > 1) {
        fail('A single Vite build output is required.');
      }
      if (build.copyPublicDir && config.publicDir) {
        for (const file of [registerFile, workerFile]) {
          if (existsSync(resolve(config.publicDir, file))) fail(`The public directory already contains ${file}.`);
        }
      }
    },
    buildStart() {
      if (!this.meta.viteVersion?.startsWith('8.')) fail('The offline build plugin requires Vite 8.');
      registrationInjected = false;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (context.path !== `/${indexFile}`) return;
        registrationInjected = true;
        return [{ tag: 'script', attrs: { src: base + registerFile, defer: true }, injectTo: 'head' }];
      },
    },
    // Run after Vite emits its transformed HTML and finalizes the chunks.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle[indexFile];
        const files = Object.keys(bundle).sort();
        const { consumer, build } = this.environment.config;
        if (consumer !== 'client' || build.lib || build.ssr || !registrationInjected || index?.type !== 'asset'
          || files.some((file) => file !== indexFile && /\.html?$/i.test(file))) {
          fail('Only client-side Vite SPA builds with a static root index.html are supported.');
        }
        if (bundle[registerFile] || bundle[workerFile]) fail('An offline output filename is already in use.');

        const shell = base + indexFile;
        const worker = base + workerFile;
        const register = base + registerFile;
        const registration = registrationScript(worker);
        const precache = [[shell, integrity(index.source)], [register, integrity(registration)]];
        const assets = [[register, 'script']];
        for (const file of files) {
          const asset = bundle[file];
          if (asset.type !== 'chunk' && !file.endsWith('.css')) continue;
          const path = base + file.split('/').map(encodeURIComponent).join('/');
          precache.push([path, integrity(asset.type === 'chunk' ? asset.code : asset.source)]);
          assets.push([path, asset.type === 'chunk' ? 'script' : 'style']);
        }

        const paths = Array.from(routes, (route) => base + route.slice(1)).sort();
        if (paths.includes(worker) || assets.some(([path]) => paths.includes(path))) {
          fail('An offline route conflicts with a generated asset URL.');
        }
        const prefix = `inkio-offline:${createHash('sha256').update(base).digest('hex')}:`;
        const settings = `const cachePrefix = ${JSON.stringify(prefix)};\nconst shell = ${JSON.stringify(shell)};\n`
          + `const precache = ${JSON.stringify(precache)};\nconst routes = new Set(${JSON.stringify(paths)});\n`
          + `const assets = new Map(${JSON.stringify(assets)});\n`;
        const version = createHash('sha256').update(settings).update(workerBody).digest('hex');
        this.emitFile({ type: 'asset', fileName: registerFile, source: registration });
        this.emitFile({
          type: 'asset', fileName: workerFile,
          source: `"use strict";\n${settings}const cacheName = cachePrefix + "${version}";\n${workerBody}`,
        });
      },
    },
  };
}
