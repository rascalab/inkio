import { isIP } from 'node:net';
import type { Duplex } from 'node:stream';
import { Server } from '@hocuspocus/server';
import { createCollabConfiguration, type InkioCollabOptions } from './config';
import { parseUpgradeUrl, shutdownHocuspocus, websocketOptions } from './embed';
import { MAX_SOCKETS } from './limits';

export interface InkioCollabServerOptions extends InkioCollabOptions {
  port?: number;
  /** IP address to bind (defaults to 127.0.0.1). */
  host?: string;
}

class LocalServer extends Server {
  private shutdown?: Promise<void>;

  constructor(options: InkioCollabServerOptions, private readonly sockets = new Set<Duplex>()) {
    const { port = 3123, host = '127.0.0.1', ...collab } = options;
    if (!isIP(host)) throw new Error('[collab] host must be an IP address');
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('[collab] invalid port');
    super({
      ...createCollabConfiguration(collab),
      address: host,
      port,
      stopOnSignals: false,
      websocketOptions,
      async onUpgrade({ request, socket }) {
        const url = parseUpgradeUrl(request);
        const host = request.headers.host;
        // The native adapter constructs its Request from Host and the target.
        // Guard both before handing the socket over to it.
        if (!url || url.pathname !== '/' || !host || !/^[\w.:[\]-]+$/.test(host) ||
          !URL.canParse(`http://${host}${request.url}`) || sockets.size >= MAX_SOCKETS) {
          socket.destroy();
          throw undefined;
        }
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
      },
    });
    this.httpServer.headersTimeout = 5000;
    this.httpServer.requestTimeout = 10_000;
  }

  override destroy(): Promise<void> {
    this.shutdown ??= this.closeAndFlush();
    return this.shutdown;
  }

  private async closeAndFlush(): Promise<void> {
    this.httpServer.close();
    for (const socket of this.sockets) socket.destroy();
    await shutdownHocuspocus(this.hocuspocus);
  }
}

/** Standalone Hocuspocus server (owns its HTTP server). */
export function createInkioCollabServer(options: InkioCollabServerOptions): Server {
  return new LocalServer(options);
}
