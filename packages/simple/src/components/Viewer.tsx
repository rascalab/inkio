import type { ViewerProps as CoreViewerProps, InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import { Viewer as CoreViewer, getExtensions } from '@inkio/core';
import type { HeadingItem, TableOfContentsConfig } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';

type JSONContent = NonNullable<CoreViewerProps['content']> extends string | infer J ? J : never;

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
  toc?: boolean | {
    position?: 'top' | 'left' | 'right';
    onHeadingsReady?: (headings: HeadingItem[], scrollToIndex: (index: number) => void) => void;
  };
  extensions?: ExtensionsInput;
};

export function Viewer({
  content,
  ui,
  toc,
  extensions,
}: ViewerProps) {
  const defaults = getExtensions();
  const resolvedExtensions = resolveExtensionsInput(extensions, defaults);

  const tocConfig: boolean | TableOfContentsConfig | undefined = (() => {
    if (!toc) return undefined;
    if (toc === true) return true;
    const { position } = toc;
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
