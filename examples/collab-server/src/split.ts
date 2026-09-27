import type { CollabAccess, CollabVerifyFn } from './config';

export interface HttpVerifyOptions {
  /** POST endpoint answering `{ access: 'write' | 'read' | false }` (see VerifyController). */
  url: string;
  /** Fail closed after this long. Default 2000ms. */
  timeoutMs?: number;
}

/**
 * Build a `verify` that delegates access checks to your API process over
 * HTTP. Used by the split hosting mode: the sync process owns documents,
 * your API owns who may touch them. Any error (network, timeout, non-2xx,
 * malformed body) denies access.
 */
export function createHttpVerify({ url, timeoutMs = 2000 }: HttpVerifyOptions): CollabVerifyFn {
  return async (token, docId): Promise<CollabAccess> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, docId }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { access?: unknown };
      return data.access === 'write' || data.access === 'read' ? data.access : false;
    } catch {
      return false;
    }
  };
}
