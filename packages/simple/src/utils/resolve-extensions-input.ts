import type { EditorProps as CoreEditorProps } from '@inkio/core';
import type { ExtensionsInput } from '../types';
import { mergeExtensions } from './merge-extensions';

type Extensions = NonNullable<CoreEditorProps['extensions']>;

export function resolveExtensionsInput(
  input: ExtensionsInput | undefined,
  defaults: Extensions,
): Extensions {
  if (!input) return defaults;
  if (Array.isArray(input)) return mergeExtensions(defaults, input);
  if (input.replace) return input.items;
  return mergeExtensions(defaults, input.items);
}
