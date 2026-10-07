'use client';

import { useCallback, useState } from 'react';
import { useReadOnlyContentSync } from '@inkio/core';
import type { InkioJSONContent as JSONContent, InkioLocaleInput, InkioMessageOverrides, TiptapEditor } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ExtensionsInput } from '../types';
import { Editor } from './Editor';

export type ViewerProps = {
  content: string | JSONContent;
  locale?: InkioLocaleInput;
  theme?: 'light' | 'dark';
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    bordered?: boolean;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };
  extensions?: ExtensionsInput;
  onCreate?: (editor: TiptapEditor) => void;
};

export function Viewer({ content, locale, theme, ui, extensions, onCreate }: ViewerProps) {
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const handleCreate = useCallback(
    (instance: TiptapEditor) => {
      setEditor(instance);
      onCreate?.(instance);
    },
    [onCreate],
  );
  useReadOnlyContentSync(editor, content);

  return (
    <Editor
      content={content}
      editable={false}
      locale={locale}
      theme={theme}
      ui={{
        ...ui,
        showToolbar: false,
        showBubbleMenu: false,
        showFloatingMenu: false,
        showTableMenu: false,
      }}
      extensions={extensions}
      onCreate={handleCreate}
    />
  );
}
