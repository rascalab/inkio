let fallbackIdCounter = 0;

/**
 * Collision-resistant random id: `crypto.randomUUID()` when available,
 * otherwise `${prefix}-<time36>-<counter36>`. The monotonic counter suffix
 * keeps rapid successive calls unique where Date.now() alone would collide
 * (and Math.random() gives no uniqueness guarantee).
 */
export function createId(prefix = 'id'): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}
