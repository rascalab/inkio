import { useMemo, useRef } from 'react';
import type { ExtensionsInput } from '../utils/extensions-input';

/** A new prop container is not a new registration. Extension instances, order and replace mode are. */
export function useStableExtensions(input?: ExtensionsInput): ExtensionsInput | undefined {
  const replace = !!(input && 'items' in input && input.replace);
  const list = input && 'items' in input ? input.items : input;
  const previous = useRef(list);
  const last = previous.current;
  if (list !== last && (!last || !list || last.length !== list.length || list.some((ext, i) => ext !== last[i]))) {
    previous.current = list;
  }
  const items = previous.current;
  return useMemo(() => items && replace ? { items, replace: true } : items?.length ? items : undefined, [items, replace]);
}
