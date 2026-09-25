import type { Extensions } from '@tiptap/core';
import type { EditorProps } from '../components/Editor';

export type CoreExtensions = NonNullable<EditorProps['extensions']>;

export type ExtensionsInput =
  | CoreExtensions
  | { items: CoreExtensions; replace?: boolean };

export function mergeExtensions(defaults: CoreExtensions, userExtensions: CoreExtensions): CoreExtensions {
  if (!Array.isArray(userExtensions) || userExtensions.length === 0) return defaults;
  // Deduplicate by name (last wins): tiptap errors on duplicate extension
  // names, and sparse/nullish holes must not throw on .name access.
  const seen = new Set<string>();
  const deduped: CoreExtensions = [];
  for (let index = userExtensions.length - 1; index >= 0; index--) {
    const ext = userExtensions[index];
    if (!ext || seen.has(ext.name)) continue;
    seen.add(ext.name);
    deduped.unshift(ext);
  }
  const userNames = new Set(deduped.map((ext) => ext.name));
  const filtered = defaults.filter((ext) => !userNames.has(ext.name));
  return [...filtered, ...deduped];
}

export function resolveExtensionsInput(
  input: ExtensionsInput | undefined,
  defaults: CoreExtensions,
): CoreExtensions {
  if (!input) return defaults;
  if (Array.isArray(input)) return mergeExtensions(defaults, input as CoreExtensions);
  if ((input as { replace?: boolean }).replace) {
    // replace:true with missing items cannot yield undefined extensions
    // (tiptap would crash): fall back to defaults.
    return (input as { items?: CoreExtensions }).items ?? defaults;
  }
  return mergeExtensions(defaults, (input as { items: CoreExtensions }).items);
}

// Re-export the raw Extensions type without forcing consumers to depend on @tiptap/core.
export type { Extensions };
