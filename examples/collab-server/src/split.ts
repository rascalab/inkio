import type { CollabAccess, CollabVerifyFn } from './config';
import { isRoomId, isServiceKey, isToken, MAX_VERIFY_RESPONSE_BYTES } from './limits';

export interface HttpVerifyOptions {
  /** POST endpoint answering `{ access: 'write' | 'read' | false }` (see VerifyController). */
  url: string;
  /** Private service credential, distinct from any document access token. */
  serviceKey: string;
  /** Fail closed after this long. Default 2000ms. */
  timeoutMs?: number;
}

/**
 * Build a `verify` that delegates access checks to your API process over
 * HTTP. Used by the split hosting mode: the sync process owns documents,
 * your API owns who may touch them. Outages throw (the sync server still
 * denies access) so the client can distinguish them from a definite denial.
 */
export function createHttpVerify({ url, serviceKey, timeoutMs = 2000 }: HttpVerifyOptions): CollabVerifyFn {
  const endpoint = new URL(url);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash || !isServiceKey(serviceKey) ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new Error('[collab] configure a valid verifier URL, service key and timeout');
  }
  return async (token, docId): Promise<CollabAccess> => {
    if (!isToken(token) || !isRoomId(docId)) return false;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ token, docId }),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    if (response.status !== 200 || !response.body ||
      response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      void response.body?.cancel().catch(() => {});
      throw new Error('[collab] verifier returned an invalid response');
    }
    const reader = response.body.getReader();
    const bytes = new Uint8Array(MAX_VERIFY_RESPONSE_BYTES);
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.byteLength > bytes.length) throw new Error('[collab] verifier response is too large');
        bytes.set(value, length);
        length += value.byteLength;
      }
      const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
      if (data && typeof data === 'object' && 'access' in data) {
        const { access } = data;
        if (access === 'write' || access === 'read' || access === false) return access;
      }
      throw new Error('[collab] verifier returned an invalid access decision');
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  };
}
