import type { Extensions } from '@tiptap/core';

export type CoreExtensions = Extensions;

/** Lists add to the surface defaults by name. Use `replace: true` for an exact schema. */
export type ExtensionsInput =
  | Readonly<CoreExtensions>
  | { items: Readonly<CoreExtensions>; replace?: boolean };

export function mergeExtensions(defaults: CoreExtensions, userExtensions: Readonly<CoreExtensions>): CoreExtensions {
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
  const filtered = defaults.filter((ext) => !seen.has(ext.name));
  return [...filtered, ...deduped];
}

export function resolveExtensionsInput(
  input: ExtensionsInput | undefined,
  defaults: CoreExtensions | (() => CoreExtensions),
): CoreExtensions {
  if (input && 'items' in input && input.replace && input.items) {
    // Tiptap declares a mutable list, but does not mutate the supplied extensions.
    return input.items as CoreExtensions;
  }
  const base = typeof defaults === 'function' ? defaults() : defaults;
  return input ? mergeExtensions(base, 'items' in input ? input.items : input) : base;
}

// Re-export the raw Extensions type without forcing consumers to depend on @tiptap/core.
export type { Extensions };
