import { useRef } from 'react';

/**
 * Structural equality for editor option objects. Plain data compares by
 * JSON; functions compare by reference (serializing them would conflate
 * distinct callbacks and keep stale closures). Falls back to reference
 * equality for unserializable values.
 */
export function isEqualOptionsValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'function') return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bRecord, key)) return false;
    const va = aRecord[key];
    const vb = bRecord[key];
    if (typeof va === 'function' || typeof vb === 'function') {
      if (!Object.is(va, vb)) return false;
    } else if (!isEqualOptionsValue(va, vb)) {
      return false;
    }
  }
  return true;
}

/**
 * Return a referentially stable snapshot of an option object: as long as the
 * incoming value is structurally equal (functions by reference), the
 * previously returned identity is kept. Inline option literals from a
 * re-rendering parent therefore never rebuild extensions or fire tiptap
 * setOptions storms — only real changes propagate.
 */
export function useStableOptions<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!isEqualOptionsValue(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}
