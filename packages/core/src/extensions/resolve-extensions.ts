import type { Extensions } from '@tiptap/core';
import { resolveExtensionsInput, type ExtensionsInput } from '../utils/extensions-input';
import { getExtensions } from './get-extensions';

export function resolveInkioExtensions(
  extensions: ExtensionsInput | undefined,
  placeholder?: string,
): Extensions {
  return resolveExtensionsInput(extensions, () => getExtensions({ placeholder }));
}
