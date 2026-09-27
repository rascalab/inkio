import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';

/** `'write'` / `'read'` grants access (read = server-enforced read-only); false rejects. */
export type CollabAccess = 'write' | 'read' | false;

export type CollabVerifyFn = (token: string, docId: string) => CollabAccess | Promise<CollabAccess>;

export interface InkioCollabServerOptions {
  port?: number;
  /** Directory for one `<docId>.ydoc` snapshot per document. */
  dataDir: string;
  /** Access check run on every connection. Omit only for local development. */
  verify?: CollabVerifyFn;
  /** Coalesce writes to disk (ms). */
  debounce?: number;
}

/** Room ids become file names: encode so `../` or `/` cannot escape dataDir. */
function snapshotPath(dataDir: string, docId: string): string {
  return join(dataDir, `${encodeURIComponent(docId)}.ydoc`);
}

export function createInkioCollabServer(options: InkioCollabServerOptions): Server {
  const { port = 3123, dataDir, verify, debounce = 2000 } = options;
  return new Server({
    port,
    quiet: true,
    debounce,
    async onAuthenticate({ token, documentName, connectionConfig }) {
      if (!verify) return;
      const access = await verify(token, documentName);
      if (!access) throw new Error('unauthorized');
      connectionConfig.readOnly = access === 'read';
    },
    extensions: [
      new Database({
        async fetch({ documentName }) {
          try {
            return new Uint8Array(await readFile(snapshotPath(dataDir, documentName)));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
          }
        },
        async store({ documentName, state }) {
          await mkdir(dataDir, { recursive: true });
          const target = snapshotPath(dataDir, documentName);
          // Write-then-rename: a crash mid-write never truncates the snapshot.
          await writeFile(`${target}.tmp`, state);
          await rename(`${target}.tmp`, target);
        },
      }),
    ],
  });
}
