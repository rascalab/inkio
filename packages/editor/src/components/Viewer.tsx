'use client';

import { useCallback, useMemo, useState } from 'react';
import { useReadOnlyContentSync } from '@inkio/core';
import type { InkioJSONContent as JSONContent, InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { CommentConfig, CommentData } from '@inkio/advanced';
import type { TiptapEditor } from '@inkio/core';
import type { ExtensionsInput } from '../types';
import { Editor } from './Editor';

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
  comment?: ViewerCommentOptions;
  extensions?: ExtensionsInput;
  onCreate?: (editor: TiptapEditor) => void;
};

export function Viewer({ content, locale, theme, ui, comment, extensions, onCreate }: ViewerProps) {
  // Memoized: a fresh literal per render would rebuild the comment
  // extensions on each parent re-render (same stabilization as Editor).
  const commentConfig: CommentConfig | undefined = useMemo(
    () =>
      comment
        ? {
            getComments: comment.getComments,
            onReply: comment.onReply,
            onResolve: comment.onResolve,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comment?.getComments, comment?.onReply, comment?.onResolve],
  );

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
        showBubbleMenu: false,
        showFloatingMenu: false,
        showTableMenu: false,
      }}
      comment={commentConfig}
      extensions={extensions}
      onCreate={handleCreate}
    />
  );
}
