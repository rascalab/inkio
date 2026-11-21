export const MAX_FRAME_BYTES = 8 * 1024 * 1024;
export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
export const MAX_TOKEN_BYTES = 4096;
export const MAX_VERIFY_REQUEST_BYTES = 32 * 1024;
export const MAX_VERIFY_RESPONSE_BYTES = 1024;
export const MAX_SOCKETS = 128;
export const MAX_ROOM_CONNECTIONS = 32;
export const MAX_ACTIVE_ROOMS = 128;

const ROOM_ID = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u;

export function isRoomId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && ROOM_ID.test(value) &&
    Buffer.byteLength(value) <= 256 && !Object.hasOwn(Object.prototype, value);
}

export function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_BYTES &&
    Buffer.byteLength(value) <= MAX_TOKEN_BYTES;
}

export function isServiceKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}
