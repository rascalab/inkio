import { Server, type Configuration } from '@hocuspocus/server';
import { afterEach } from 'vitest';

const cleanups: Array<() => unknown> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

export function onCleanup(fn: () => unknown): void {
  cleanups.push(fn);
}

export async function startServer(config: Partial<Configuration> = {}) {
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, ...config });
  await server.listen();
  onCleanup(() => server.destroy());
  return { server, url: `ws://127.0.0.1:${server.address.port}` };
}

export async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
