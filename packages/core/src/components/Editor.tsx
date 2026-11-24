'use client';

import type { JSONContent } from '@tiptap/react';
import type { ExtensionsInput } from '../utils/extensions-input';
import type { InkioEditor, WithEditorExtensions } from '../editor-document';
import { useEffect, useMemo, useState } from 'react';
import { EditorContainer, useEditorSurface } from './editor-surface';
import { BubbleMenu } from './BubbleMenu';
import type { BubbleMenuProps } from './BubbleMenu';
import { FloatingMenu } from './FloatingMenu';
import type { FloatingMenuProps } from './FloatingMenu';
import { TableMenu } from './TableMenu';
import type { TableMenuProps } from './TableMenu';
import { Toolbar } from './Toolbar';
import type { ToolbarProps } from './Toolbar';
import type { InkioCoreMessageOverrides, InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';
import { resolveInkioExtensions } from '../extensions/resolve-extensions';
import { useStableExtensions } from '../hooks/use-stable-extensions';

export interface EditorProps {
  /** Initial document only (uncontrolled). See `useInkioEditor`. */
  content?: string | JSONContent;
  extensions?: ExtensionsInput;
  placeholder?: string;
  /** Accessible name of the editing surface. Defaults to the localized editor label. */
  ariaLabel?: string;
  editable?: boolean;
  onChange?: (editor: InkioEditor) => void;
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: InkioEditor) => void;
  className?: string;
  /** Color theme. Unset follows a `.dark` / `.dark-theme` ancestor; set forces it. */
  theme?: 'light' | 'dark';
  /** 에디터 컨테이너 스타일 */
  style?: React.CSSProperties;
  /** Fill the parent container height instead of sizing to content. */
  fill?: boolean;
  /** Automatically grow editor height to fit content. Mutually exclusive with `fill`. */
  autoresize?: boolean;
  /** Show default container border and padding */
  bordered?: boolean;
  /** Whether to show the bubble menu */
  showBubbleMenu?: boolean;
  /** Whether to show the floating menu */
  showFloatingMenu?: boolean;
  /** Whether to show the persistent top toolbar */
  showToolbar?: boolean;
  /** Whether to show the table action menu when the selection is inside a table. */
  showTableMenu?: boolean;
  /** Toolbar configuration when `showToolbar` is enabled. */
  toolbar?: Omit<ToolbarProps, 'editor'>;
  /** Bubble menu configuration when `showBubbleMenu` is enabled. */
  bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
  /** Floating menu configuration when `showFloatingMenu` is enabled. */
  floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
  /** Table menu configuration when `showTableMenu` is enabled. */
  tableMenu?: Omit<TableMenuProps, 'editor'>;
  /** Locale tag or Accept-Language string. */
  locale?: InkioLocaleInput;
  /** Message overrides for core menu labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides by action id */
  icons?: Partial<InkioIconRegistry>;
};

export function Editor<const Input extends EditorProps['extensions']>(props: WithEditorExtensions<EditorProps, Input>): React.JSX.Element;
export function Editor(props: EditorProps): React.JSX.Element;
export function Editor(props: EditorProps) {
  const {
    extensions, placeholder, fill, autoresize, locale, messages, icons,
    showToolbar = false, showBubbleMenu = false, showFloatingMenu = false, showTableMenu = true,
    toolbar, bubbleMenu, floatingMenu, tableMenu,
  } = props;
  // The first placeholder only: later ones reach the live editor below.
  const [firstPlaceholder] = useState(placeholder);
  const stableExtensions = useStableExtensions(extensions);
  const resolvedExtensions = useMemo(
    () => resolveInkioExtensions(stableExtensions, firstPlaceholder),
    [stableExtensions, firstPlaceholder],
  );

  // Warn in an effect, not during render: parent re-renders (and
  // StrictMode double-render) would spam the console otherwise.
  useEffect(() => {
    if (fill && autoresize) {
      console.warn('Inkio Editor: `fill` and `autoresize` are mutually exclusive. `fill` takes precedence.');
    }
  }, [fill, autoresize]);

  const { editor, body } = useEditorSurface(props, resolvedExtensions);
  const showInteractiveRuntime = !!editor;

  const toolbarPlacement = toolbar?.placement ?? 'top';
  const toolbarElement = showToolbar && (
    showInteractiveRuntime ? (
      <Toolbar
        key="toolbar"
        editor={editor}
        className={toolbar?.className}
        locale={toolbar?.locale ?? locale}
        messages={toolbar?.messages ?? messages}
        icons={toolbar?.icons ?? icons}
        items={toolbar?.items}
        placement={toolbarPlacement}
      >
        {toolbar?.children}
      </Toolbar>
    ) : (
      <div
        key="toolbar"
        className={`inkio-toolbar inkio-toolbar--ssr-placeholder${toolbar?.className ? ` ${toolbar.className}` : ''}`}
        data-placement={toolbarPlacement}
        role="presentation"
        aria-hidden="true"
      >
        <div className="inkio-toolbar-group">
          <span className="inkio-toolbar-skeleton-btn" />
          <span className="inkio-toolbar-skeleton-btn" />
          <span className="inkio-toolbar-skeleton-btn" />
        </div>
        <div className="inkio-toolbar-divider" />
        <div className="inkio-toolbar-group">
          <span className="inkio-toolbar-skeleton-btn inkio-toolbar-skeleton-btn--wide" />
        </div>
      </div>
    )
  );

  return (
    <EditorContainer {...props}>
      {toolbarPlacement === 'top' && toolbarElement}

      {showInteractiveRuntime && showBubbleMenu && (
        <BubbleMenu
          editor={editor}
          className={bubbleMenu?.className}
          locale={bubbleMenu?.locale ?? locale}
          messages={bubbleMenu?.messages ?? messages}
          icons={bubbleMenu?.icons ?? icons}
          items={bubbleMenu?.items}
          position={bubbleMenu?.position}
        >
          {bubbleMenu?.children}
        </BubbleMenu>
      )}

      {showInteractiveRuntime && showFloatingMenu && (
        <FloatingMenu
          editor={editor}
          className={floatingMenu?.className}
          locale={floatingMenu?.locale ?? locale}
          messages={floatingMenu?.messages ?? messages}
          icons={floatingMenu?.icons ?? icons}
          items={floatingMenu?.items}
          position={floatingMenu?.position}
        />
      )}

      {showInteractiveRuntime && showTableMenu && (
        <TableMenu
          editor={editor}
          className={tableMenu?.className}
          locale={tableMenu?.locale ?? locale}
          messages={tableMenu?.messages ?? messages}
          icons={tableMenu?.icons ?? icons}
          position={tableMenu?.position}
        />
      )}

      {body}
      {toolbarPlacement === 'bottom' && toolbarElement}
    </EditorContainer>
  );
}
