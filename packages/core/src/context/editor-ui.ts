import { useSyncExternalStore } from 'react';
import type { InkioCoreMessageOverrides, InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';
import { isEqualOptionsValue } from '../utils/stable-options';

export interface EditorUi<Messages = InkioCoreMessageOverrides | InkioMessageOverrides> {
  locale?: InkioLocaleInput;
  messages?: Messages;
  icons?: Partial<InkioIconRegistry>;
  /** Replaces the locale's placeholder. */
  placeholder?: string;
}

interface StoredEditorUi extends EditorUi {
  revision?: number;
}

type EditorWithStorage = { storage?: unknown };

function storedUi(editor: EditorWithStorage | null | undefined): StoredEditorUi | undefined {
  return (editor?.storage as { inkioUi?: StoredEditorUi } | undefined)?.inkioUi;
}

/**
 * What an editor shows right now, read at use time so a later `setEditorUi` is
 * seen. `own` is what an extension was configured with, and wins.
 */
export function editorUi<Messages = InkioCoreMessageOverrides | InkioMessageOverrides>(
  editor: EditorWithStorage | null | undefined,
  own: EditorUi<Messages> = {},
): EditorUi<Messages> {
  const stored = storedUi(editor);
  return {
    locale: own.locale ?? stored?.locale,
    messages: own.messages ?? (stored?.messages as Messages | undefined),
    icons: own.icons ?? stored?.icons,
    placeholder: own.placeholder ?? stored?.placeholder,
  };
}

/**
 * Change the language, messages or icons of a live editor. The document, caret
 * and undo history stay. `Editor` does this for its props; call it yourself when
 * you drive the editor with `useInkioEditor`.
 */
export function setEditorUi(
  editor: EditorWithStorage & {
    isDestroyed: boolean;
    state: { tr: unknown };
    view: { dispatch: (tr: never) => void };
  },
  ui: EditorUi,
): void {
  const stored = storedUi(editor);
  if (!stored || editor.isDestroyed) return;
  const changes = (Object.keys(ui) as Array<keyof EditorUi>).filter(
    (key) => !isEqualOptionsValue(stored[key], ui[key]),
  );
  if (changes.length === 0) return;
  Object.assign(stored, ui, { revision: (stored.revision ?? 0) + 1 });
  // Nothing in the document changes. This only makes plugins and views look again.
  editor.view.dispatch(editor.state.tr as never);
}

/** Changes when `setEditorUi` does, for what caches its words outside React. */
export function editorUiRevision(editor: EditorWithStorage | null | undefined): number {
  return storedUi(editor)?.revision ?? 0;
}

/** Re-renders a node view when `setEditorUi` changes what it shows. */
export function useEditorUiRevision(editor: {
  storage?: unknown;
  on: (event: 'transaction', listener: () => void) => unknown;
  off: (event: 'transaction', listener: () => void) => unknown;
}): number {
  const read = () => editorUiRevision(editor);
  return useSyncExternalStore(
    (listener) => {
      editor.on('transaction', listener);
      return () => {
        editor.off('transaction', listener);
      };
    },
    read,
    read,
  );
}
