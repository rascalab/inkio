import { Server } from '@hocuspocus/server';
import { createCollabConfiguration, type InkioCollabOptions } from './config';

export interface InkioCollabServerOptions extends InkioCollabOptions {
  port?: number;
}

/** Standalone Hocuspocus server (owns its HTTP server). */
export function createInkioCollabServer(options: InkioCollabServerOptions): Server {
  const { port = 3123, ...collab } = options;
  return new Server({ port, stopOnSignals: false, ...createCollabConfiguration(collab) });
}
