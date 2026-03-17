import type { EditorProps as CoreEditorProps } from '@inkio/core';

// Re-use the Extensions type from core without a direct @tiptap/core dep
type Extensions = NonNullable<CoreEditorProps['extensions']>;

export type ExtensionsInput =
  | Extensions
  | { items: Extensions; replace?: boolean };
