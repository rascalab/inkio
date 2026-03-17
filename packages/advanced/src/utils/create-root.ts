import type { Root } from 'react-dom/client';

type CreateRootFn = (container: Element) => Root;

let _promise: Promise<CreateRootFn> | null = null;

export function getCreateRoot(): Promise<CreateRootFn> {
  if (!_promise) {
    _promise = import('react-dom/client').then(m => m.createRoot);
  }
  return _promise;
}

export type { CreateRootFn };
