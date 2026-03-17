import type { EditorProps as CoreEditorProps } from '@inkio/core';

type Extensions = NonNullable<CoreEditorProps['extensions']>;

export function mergeExtensions(defaults: Extensions, userExtensions: Extensions): Extensions {
  if (userExtensions.length === 0) return defaults;
  const userNames = new Set(userExtensions.map((ext) => ext.name));
  const filtered = defaults.filter((ext) => !userNames.has(ext.name));
  return [...filtered, ...userExtensions];
}
