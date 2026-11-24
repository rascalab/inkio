import { useMemo, useRef } from 'react';
import type { CoreExtensions, ExtensionsInput } from '../utils/extensions-input';

function sameExtensions(a?: Readonly<CoreExtensions>, b?: Readonly<CoreExtensions>): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** A new prop container is not a new registration. Extension instances, order and replace mode are. */
export function useStableExtensions(input?: ExtensionsInput): ExtensionsInput | undefined {
  const replace = !!(input && 'items' in input && input.replace);
  const list = input && 'items' in input ? input.items : input;
  const previous = useRef(list);
  if (!sameExtensions(list, previous.current)) {
    previous.current = list;
  }
  const items = previous.current;
  return useMemo(() => items && replace ? { items, replace: true } : items?.length ? items : undefined, [items, replace]);
}
