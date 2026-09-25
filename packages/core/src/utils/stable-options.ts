import { useMemo, useRef } from 'react';

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
  // Dates compare by time, not by string form or reference.
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    // Element-wise recursion: JSON would conflate NaN/null, drop
    // undefined, and stringify Dates — swallowing real changes.
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => isEqualOptionsValue(item, b[index]));
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

/**
 * Identity-stable wrapper around a callback prop: inline closures from a
 * re-rendering parent keep a single identity while always forwarding to
 * the newest implementation. Structural stabilization cannot do this
 * (functions compare by reference), so without the wrapper every parent
 * render rebuilds the extension set.
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
): T | undefined {
  const latestRef = useRef(fn);
  // Idempotent render-phase write (same value for a given commit): the
  // wrapper below never changes identity while defined-ness is unchanged.
  latestRef.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (fn === undefined) return undefined;
    const stable = (...args: Parameters<T>): ReturnType<T> => {
      const latest = latestRef.current;
      if (latest === undefined) {
        throw new Error('useStableCallback invoked after its callback was removed');
      }
      return (latest as (...callArgs: Parameters<T>) => ReturnType<T>)(...args);
    };
    return stable as T;
  }, [fn === undefined]);
}
