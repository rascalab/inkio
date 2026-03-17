import type { ViewerProps as CoreViewerProps, InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import { Viewer as CoreViewer } from '@inkio/core';
import type { HeadingItem, TableOfContentsConfig } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import { getDefaultExtensions } from '@inkio/advanced';
import type { CommentConfig, CommentData, DefaultExtensionsOptions } from '@inkio/advanced';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';

type JSONContent = NonNullable<CoreViewerProps['content']> extends string | infer J ? J : never;

interface ViewerUiOptions {
  className?: string;
  style?: React.CSSProperties;
  bordered?: boolean;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

interface ViewerCommentOptions {
  getComments: (commentId: string) => CommentData | null;
  onReply?: (commentId: string, text: string) => void;
  onResolve?: (commentId: string) => void;
}

export type ViewerProps = {
  content: string | JSONContent;
  locale?: InkioLocaleInput;
  ui?: ViewerUiOptions;
  toc?: boolean | {
    position?: 'top' | 'left' | 'right';
    onHeadingsReady?: (headings: HeadingItem[], scrollToIndex: (index: number) => void) => void;
  };
  comment?: ViewerCommentOptions;
  extensions?: ExtensionsInput;
};

export function Viewer({
  content,
  locale,
  ui,
  toc,
  comment,
  extensions,
}: ViewerProps) {
  const commentConfig: CommentConfig | false = comment
    ? {
        getComments: comment.getComments,
        onReply: comment.onReply,
        onResolve: comment.onResolve,
      }
    : false;

  const defaultExtensionsOptions: DefaultExtensionsOptions = {
    locale,
    messages: ui?.messages,
    icons: ui?.icons,
    comment: commentConfig,
  };

  const defaults = getDefaultExtensions(defaultExtensionsOptions);
  const resolvedExtensions = resolveExtensionsInput(extensions, defaults);

  const tocConfig: boolean | TableOfContentsConfig | undefined = (() => {
    if (!toc) return undefined;
    if (toc === true) return true;
    const { position, onHeadingsReady: _onHeadingsReady } = toc;
    return position ? { position } : true;
  })();

  const onHeadingsReady =
    toc && toc !== true ? toc.onHeadingsReady : undefined;

  return (
    <CoreViewer
      content={content}
      extensions={resolvedExtensions}
      className={ui?.className}
      style={ui?.style}
      bordered={ui?.bordered}
      tableOfContents={tocConfig}
      onHeadingsReady={onHeadingsReady}
    />
  );
}
