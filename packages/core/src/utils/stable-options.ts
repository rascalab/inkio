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
  if (a instanceof Map || b instanceof Map) {
    // Object.keys() sees no Map entries: without this, any two Maps
    // compare equal and mutations are missed entirely.
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !isEqualOptionsValue(value, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
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

type AnyFunction = (...args: never[]) => unknown;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Stabilize a whole props bag at once, instead of one `useStableOptions` /
 * `useStableCallback` call per field (easy to miss one when a prop is added):
 *
 * - functions — top-level or nested inside plain-object fields such as
 *   `comment.getComments` — become identity-stable forwarders to the newest
 *   implementation at the same path. Tiptap never re-applies extension
 *   options after creation, so a nested callback captured at mount would
 *   otherwise keep reading stale parent state forever;
 * - every other value keeps its previous identity while structurally equal
 *   (like `useStableOptions`). Arrays are compared structurally as-is, since
 *   positional forwarders would misroute reordered items.
 *
 * The returned object itself keeps its identity until some field changes,
 * so it can be used directly as a single memo dependency.
 */
export function useStableProps<T extends object>(props: T): T {
  const latestRef = useRef(props);
  // Idempotent render-phase write, same as useStableCallback.
  latestRef.current = props;
  const forwardersRef = useRef(new Map<string, AnyFunction>());
  const resultRef = useRef<T | null>(null);

  const forwarders = forwardersRef.current;
  const used = new Set<string>();

  const forwarderFor = (path: string[]): AnyFunction => {
    const key = path.join('\u0000');
    used.add(key);
    let forwarder = forwarders.get(key);
    if (!forwarder) {
      forwarder = (...args: never[]) => {
        let latest: unknown = latestRef.current;
        for (const segment of path) {
          latest = isPlainObject(latest) ? latest[segment] : undefined;
        }
        if (typeof latest !== 'function') {
          throw new Error(`useStableProps: "${path.join('.')}" invoked after its callback was removed`);
        }
        return (latest as AnyFunction)(...args);
      };
      forwarders.set(key, forwarder);
    }
    return forwarder;
  };

  const stabilize = (value: unknown, path: string[]): unknown => {
    if (typeof value === 'function') return forwarderFor(path);
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = stabilize(value[key], [...path, key]);
    }
    return out;
  };

  const previous = resultRef.current as Record<string, unknown> | null;
  const next: Record<string, unknown> = {};
  let changed = !previous || Object.keys(previous).length !== Object.keys(props).length;
  for (const key of Object.keys(props)) {
    const value = stabilize((props as Record<string, unknown>)[key], [key]);
    // Forwarders are identity-stable per path, so structural equality holds
    // across renders whenever only callback implementations changed.
    if (previous && Object.prototype.hasOwnProperty.call(previous, key) && isEqualOptionsValue(previous[key], value)) {
      next[key] = previous[key];
    } else {
      next[key] = value;
      changed = true;
    }
  }
  for (const key of forwarders.keys()) {
    if (!used.has(key)) forwarders.delete(key);
  }

  if (!changed) return resultRef.current as T;
  resultRef.current = next as T;
  return next as T;
}
