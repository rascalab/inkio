import type { Extensions } from '@tiptap/core';
import { getExtensions } from './get-extensions';

export function resolveInkioExtensions(
  extensions: Extensions | undefined,
  placeholder?: string,
): Extensions {
  if (extensions && extensions.length > 0) return extensions;
  return getExtensions({ placeholder }) as Extensions;
}
