import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { CollabVerifyFn } from './config';
import { isRoomId, isServiceKey, isToken } from './limits';

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`[collab] ${name} is required`);
  return value;
}

export function listenOptions(defaultPort: number) {
  const raw = process.env.PORT;
  const port = raw === undefined ? defaultPort : (/^\d+$/.test(raw) ? Number(raw) : NaN);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('[collab] invalid PORT');
  const host = process.env.COLLAB_HOST ?? '127.0.0.1';
  if (!isIP(host)) throw new Error('[collab] COLLAB_HOST must be an IP address');
  return { port, host };
}

export function originsFromEnv(): string[] | undefined {
  const raw = process.env.COLLAB_ALLOWED_ORIGINS;
  if (raw === undefined) return undefined;
  const origins = raw.split(',').map((entry) => entry.trim());
  if (origins.some((origin) => !URL.canParse(origin))) throw new Error('[collab] invalid COLLAB_ALLOWED_ORIGINS');
  if (origins.some((origin) => {
    const url = new URL(origin);
    return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
  })) throw new Error('[collab] COLLAB_ALLOWED_ORIGINS must contain exact HTTP(S) origins');
  return origins;
}

export function createLocalVerify(): CollabVerifyFn {
  const room = requiredEnv('COLLAB_ROOM_ID');
  const editor = requiredEnv('COLLAB_EDITOR_TOKEN');
  const viewer = process.env.COLLAB_VIEWER_TOKEN;
  const serviceKey = process.env.COLLAB_VERIFY_KEY;
  if (serviceKey !== undefined && (serviceKey === editor || serviceKey === viewer)) {
    throw new Error('[collab] COLLAB_VERIFY_KEY must differ from room access tokens');
  }
  if (!isRoomId(room)) throw new Error('[collab] invalid COLLAB_ROOM_ID');
  if (!isServiceKey(editor) || (viewer !== undefined && (!isServiceKey(viewer) || viewer === editor))) {
    throw new Error('[collab] configure distinct random editor and viewer tokens (32–128 URL-safe characters)');
  }
  const editorHash = createHash('sha256').update(editor).digest();
  const viewerHash = viewer && createHash('sha256').update(viewer).digest();
  return (token, docId) => {
    if (docId !== room || !isToken(token)) return false;
    const digest = createHash('sha256').update(token).digest();
    if (timingSafeEqual(digest, editorHash)) return 'write';
    if (viewerHash && timingSafeEqual(digest, viewerHash)) return 'read';
    return false;
  };
}
