import type { JSONContent } from '@tiptap/core';

/**
 * Cheap equality for static SSR content. String content compares by value
 * (React useMemo already does this, but JSON objects compare by identity —
 * an inline object literal would otherwise re-run generateHTML + sanitize
 * on every parent re-render). Identity wins first (O(1)); JSON.stringify
 * is still far cheaper than generateHTML + sanitize-html.
 */
export function isEqualStaticContent(a: string | JSONContent | undefined, b: string | JSONContent | undefined): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'string') return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
