'use client';

import { useMemo } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
  type TiptapEditor,
  type InkioLocaleInput,
  type InkioMessageOverrides,
  type InkioErrorHandler,
} from '@inkio/core';
import type { BubbleMenuProps } from '@inkio/core';
import type { FloatingMenuProps } from '@inkio/core';
import type { TableMenuProps } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ImageBlockOptions } from '@inkio/core';
import type { HashTagItem, MentionItem, SlashCommandItem, SlashCommandTransform, BookmarkPreview, CommentConfig } from '@inkio/advanced';
import { getDefaultExtensions, type DefaultExtensionsOptions } from '@inkio/advanced';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';
import { useStableOptions } from '@inkio/core';
import type { InkioJSONContent as JSONContent } from '@inkio/core';

interface EditorUiOptions {
  className?: string;
  style?: React.CSSProperties;
  fill?: boolean;
    autoresize?: boolean;
  bordered?: boolean;
  showBubbleMenu?: boolean;
  showFloatingMenu?: boolean;
  showTableMenu?: boolean;
  bubbleMenu?: Omit<BubbleMenuProps, 'editor'>;
  floatingMenu?: Omit<FloatingMenuProps, 'editor'>;
  tableMenu?: Omit<TableMenuProps, 'editor'>;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

type EditorContentMode =
  | { content: string | JSONContent; initialContent?: never }
  | { content?: never; initialContent?: string | JSONContent };

export type EditorProps = EditorContentMode & {
  editable?: boolean;
  placeholder?: string;
  locale?: InkioLocaleInput;
  /** Color theme */
  theme?: 'light' | 'dark';
  tabBehavior?: 'indent' | 'default';
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: TiptapEditor) => void;

  // UI
  ui?: EditorUiOptions;

  // Feature callbacks
  onImageUpload?: (file: File) => Promise<string | { src: string; [key: string]: unknown }>;
  hashtagItems?: (params: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  mentionItems?: (params: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
  onError?: InkioErrorHandler;

  // Complex features
  comment?: CommentConfig;
  imageBlock?: Omit<Partial<ImageBlockOptions>, 'onUpload' | 'HTMLAttributes'>;
  bookmark?: false | { onResolveBookmark?: (url: string) => Promise<BookmarkPreview> };

  // Feature toggles
  blockHandle?: boolean;
  wikiLink?: boolean;
  table?: boolean;
  callout?: boolean;
  toggleList?: boolean;

  // Extensions
  extensions?: ExtensionsInput;
};

export function Editor({
  content,
  initialContent,
  editable,
  placeholder,
  locale,
  theme,
  tabBehavior,
  onUpdate,
  onCreate,
  ui,
  onImageUpload,
  hashtagItems,
  mentionItems,
  slashCommands,
  transformSlashCommands,
  onWikiLinkClick,
  onError,
  comment,
  imageBlock,
  bookmark,
  blockHandle,
  wikiLink,
  table,
  callout,
  toggleList,
  extensions,
}: EditorProps) {
  // Parent re-renders with inline option literals must not rebuild the
  // extension set (tiptap compares extensions by identity → setOptions storm
  // per keystroke). Stabilize structural inputs; callbacks still compare by
  // reference so updates are never swallowed.
  const stableMessages = useStableOptions(ui?.messages);
  const stableIcons = useStableOptions(ui?.icons);
  const stableBubbleMenu = useStableOptions(ui?.bubbleMenu);
  const stableFloatingMenu = useStableOptions(ui?.floatingMenu);
  const stableTableMenu = useStableOptions(ui?.tableMenu);
  const stableComment = useStableOptions(comment);
  const stableImageBlock = useStableOptions(imageBlock);
  const stableBookmark = useStableOptions(bookmark);

  const defaultExtensionsOptions = useMemo<DefaultExtensionsOptions>(() => {
    const opts: DefaultExtensionsOptions = {
      placeholder,
      locale,
      messages: stableMessages,
      icons: stableIcons,
      tabBehavior,
      onError,
      mentionItems,
      hashtagItems,
      slashCommands,
      transformSlashCommands,
      onWikiLinkClick,
      blockHandle,
      wikiLink,
      comment: stableComment,
      callout: callout === false ? false : undefined,
      toggleList: toggleList === false ? false : undefined,
      table: table === false ? false : undefined,
    };

    // imageBlock: merge onImageUpload into imageBlock options
    if (stableImageBlock !== undefined || onImageUpload !== undefined) {
      opts.imageBlock = stableImageBlock
        ? { ...stableImageBlock, ...(onImageUpload ? { onUpload: onImageUpload } : {}) }
        : onImageUpload
          ? { onUpload: onImageUpload }
          : undefined;
    }

    // bookmark
    if (stableBookmark === false) {
      opts.bookmark = false;
    } else if (stableBookmark !== undefined) {
      opts.bookmark = true;
      if (stableBookmark.onResolveBookmark) {
        opts.onResolveBookmark = stableBookmark.onResolveBookmark;
      }
    }

    return opts;
  }, [
    placeholder,
    locale,
    stableMessages,
    stableIcons,
    tabBehavior,
    onError,
    mentionItems,
    hashtagItems,
    slashCommands,
    transformSlashCommands,
    onWikiLinkClick,
    blockHandle,
    wikiLink,
    stableComment,
    callout,
    toggleList,
    table,
    stableImageBlock,
    onImageUpload,
    stableBookmark,
  ]);

  const resolvedExtensions = useMemo(() => {
    const defaults = getDefaultExtensions(defaultExtensionsOptions);
    return resolveExtensionsInput(extensions, defaults);
  }, [defaultExtensionsOptions, extensions]);

  const coreProps: CoreEditorProps = useMemo(() => ({
    ...(content !== undefined ? { content } : { initialContent }),
    extensions: resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
    messages: stableMessages,
    icons: stableIcons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    autoresize: ui?.autoresize,
    bordered: ui?.bordered,
    showToolbar: false,
    showBubbleMenu: ui?.showBubbleMenu ?? true,
    showFloatingMenu: ui?.showFloatingMenu ?? true,
    showTableMenu: ui?.showTableMenu ?? true,
    bubbleMenu: stableBubbleMenu,
    floatingMenu: stableFloatingMenu,
    tableMenu: stableTableMenu,
  }), [
    content,
    initialContent,
    resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
    stableMessages,
    stableIcons,
    ui?.className,
    ui?.style,
    ui?.fill,
    ui?.autoresize,
    ui?.bordered,
    ui?.showBubbleMenu,
    ui?.showFloatingMenu,
    ui?.showTableMenu,
    stableBubbleMenu,
    stableFloatingMenu,
    stableTableMenu,
  ]);

  return <CoreEditor {...coreProps} />;
}
