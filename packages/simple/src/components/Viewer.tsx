'use client';

import type { EditorProps } from './Editor';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ExtensionsInput } from '../types';
import { Editor } from './Editor';

type JSONContent = NonNullable<EditorProps['content']> extends string | infer J ? J : never;

export type ViewerProps = {
  content: string | JSONContent;
  locale?: InkioLocaleInput;
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    bordered?: boolean;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };
  extensions?: ExtensionsInput;
};

export function Viewer({ content, locale, ui, extensions }: ViewerProps) {
  return (
    <Editor
      content={content}
      editable={false}
      locale={locale}
      ui={{
        ...ui,
        showToolbar: false,
        showBubbleMenu: false,
        showFloatingMenu: false,
        showTableMenu: false,
      }}
      extensions={extensions}
    />
  );
}
