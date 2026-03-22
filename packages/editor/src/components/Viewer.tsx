'use client';

import type { EditorProps } from './Editor';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { CommentConfig, CommentData } from '@inkio/advanced';
import type { TiptapEditor } from '@inkio/core';
import type { ExtensionsInput } from '../types';
import { Editor } from './Editor';

type JSONContent = NonNullable<EditorProps['content']> extends string | infer J ? J : never;

interface ViewerCommentOptions {
  getComments: (commentId: string) => CommentData | null;
  onReply?: (commentId: string, text: string) => void;
  onResolve?: (commentId: string) => void;
}

export type ViewerProps = {
  content: string | JSONContent;
  locale?: InkioLocaleInput;
  /** Color theme */
  theme?: 'light' | 'dark';
  ui?: {
    className?: string;
    style?: React.CSSProperties;
    bordered?: boolean;
    messages?: InkioMessageOverrides;
    icons?: Partial<InkioIconRegistry>;
  };
  comment?: false | ViewerCommentOptions;
  extensions?: ExtensionsInput;
  onCreate?: (editor: TiptapEditor) => void;
};

export function Viewer({ content, locale, theme, ui, comment, extensions, onCreate }: ViewerProps) {
  const commentConfig: CommentConfig | false | undefined = comment === false
    ? false
    : comment
      ? {
          getComments: comment.getComments,
          onReply: comment.onReply,
          onResolve: comment.onResolve,
        }
      : undefined;

  return (
    <Editor
      content={content}
      editable={false}
      locale={locale}
      theme={theme}
      ui={{
        ...ui,
        showBubbleMenu: false,
        showFloatingMenu: false,
        showTableMenu: false,
      }}
      comment={commentConfig}
      extensions={extensions}
      onCreate={onCreate}
    />
  );
}
