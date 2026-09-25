import type { Extensions } from '@tiptap/core';
import { getExtensions } from './get-extensions';

export function resolveInkioExtensions(
  extensions: Extensions | undefined,
  placeholder?: string,
): Extensions {
  // undefined means "defaults"; an explicit empty array means a bare
  // document. The Editor's default prop is undefined so the two never
  // conflate here.
  if (extensions !== undefined) return extensions;
  return getExtensions({ placeholder }) as Extensions;
}
