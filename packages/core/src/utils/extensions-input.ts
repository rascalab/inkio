import type { Extensions } from '@tiptap/core';
import type { EditorProps } from '../components/Editor';

export type CoreExtensions = NonNullable<EditorProps['extensions']>;

export type ExtensionsInput =
  | CoreExtensions
  | { items: CoreExtensions; replace?: boolean };

export function mergeExtensions(defaults: CoreExtensions, userExtensions: CoreExtensions): CoreExtensions {
  if (userExtensions.length === 0) return defaults;
  const userNames = new Set(userExtensions.map((ext) => ext.name));
  const filtered = defaults.filter((ext) => !userNames.has(ext.name));
  return [...filtered, ...userExtensions];
}

export function resolveExtensionsInput(
  input: ExtensionsInput | undefined,
  defaults: CoreExtensions,
): CoreExtensions {
  if (!input) return defaults;
  if (Array.isArray(input)) return mergeExtensions(defaults, input as CoreExtensions);
  if ((input as { replace?: boolean }).replace) return (input as { items: CoreExtensions }).items;
  return mergeExtensions(defaults, (input as { items: CoreExtensions }).items);
}

// Re-export the raw Extensions type without forcing consumers to depend on @tiptap/core.
export type { Extensions };
