import { toError } from '../errors';

/** Mutable sequence cell; every call sharing a cell supersedes the previous one. */
export interface LatestWinsCell {
  value: number;
}

/** Handed to `source` so multi-step pipelines can bail out between awaits. */
export interface LatestWinsGuard {
  isCurrent: () => boolean;
}

export type LatestWinsSource<A, T> = (
  args: A,
  guard: LatestWinsGuard,
) => T[] | null | undefined | Promise<T[] | null | undefined>;

export interface LatestWinsItemsOptions<A, T> {
  /** Resolves the items for one request. A nullish result yields `[]`. */
  source: LatestWinsSource<A, T>;
  /**
   * Trailing debounce in ms. Superseded requests resolve `[]` without ever
   * invoking `source`. `0`/omitted invokes `source` synchronously in the call.
   */
  debounceMs?: number;
  /** Receives errors from the current request only (stale errors are dropped). */
  onError?: (error: Error, args: A) => void;
  /**
   * Which sequence cell a request competes in. Defaults to one cell per
   * created function; return a per-key cell (e.g. per editor) for isolation.
   */
  scope?: (args: A) => LatestWinsCell;
}

/**
 * "Latest request wins" async items resolver for suggestion popups: a slow
 * earlier response never overwrites a newer query's list (stale requests
 * resolve `[]`), errors are normalized and routed to `onError` instead of
 * rejecting, and an optional trailing debounce coalesces rapid keystrokes.
 */
export function createLatestWinsItems<A, T>(
  options: LatestWinsItemsOptions<A, T>,
): (args: A) => Promise<T[]> {
  const { source, debounceMs = 0, onError } = options;
  const ownCell: LatestWinsCell = { value: 0 };
  const scope = options.scope ?? (() => ownCell);

  return async (args: A): Promise<T[]> => {
    const cell = scope(args);
    const seq = (cell.value += 1);
    const isCurrent = () => seq === cell.value;

    if (debounceMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, debounceMs));
      if (!isCurrent()) return [];
    }

    try {
      const result = await source(args, { isCurrent });
      if (!isCurrent()) return [];
      return result ?? [];
    } catch (error) {
      if (!isCurrent()) return [];
      onError?.(toError(error), args);
      return [];
    }
  };
}
