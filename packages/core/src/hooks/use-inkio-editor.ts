import type { JSONContent } from '@tiptap/react';
import type { ExtensionsInput } from '../utils/extensions-input';
import type { InkioEditor, RegisteredEditor, WithEditorExtensions } from '../editor-document';
import { useMemo } from 'react';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { useResolvedInkioEditor } from './use-resolved-inkio-editor';

export interface UseInkioEditorOptions {
  /**
   * Initial document only (uncontrolled). The editor owns state after
   * mount; push external values imperatively via the `onCreate` instance
   * (`editor.commands.setContent(...)`).
   */
  content?: string | JSONContent;
  extensions?: ExtensionsInput;
  placeholder?: string;
  /** Accessible name of the editing surface. */
  ariaLabel?: string;
  editable?: boolean;
  onChange?: (editor: InkioEditor) => void;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: InkioEditor) => void;
}

export function useInkioEditor<const Input extends UseInkioEditorOptions['extensions']>(options: WithEditorExtensions<UseInkioEditorOptions, Input>): RegisteredEditor<Input> | null;
export function useInkioEditor(options?: UseInkioEditorOptions): InkioEditor | null;
export function useInkioEditor(options: UseInkioEditorOptions = {}) {
  const { extensions, placeholder } = options;
  const resolved = useMemo(() => resolveInkioExtensions(extensions, placeholder), [extensions, placeholder]);
  return useResolvedInkioEditor({ ...options, extensions: resolved });
}
