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
import type { ToolbarProps } from '@inkio/core';
import type { BubbleMenuProps } from '@inkio/core';
import type { FloatingMenuProps } from '@inkio/core';
import type { TableMenuProps } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ImageBlockOptions } from '@inkio/core';
import type { HashTagItem, MentionItem, SlashCommandItem, SlashCommandTransform, BookmarkPreview, CommentConfig } from '@inkio/advanced';
import { getDefaultExtensions, type DefaultExtensionsOptions } from '@inkio/advanced';
import type { ExtensionsInput } from '../types';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';

type JSONContent = NonNullable<CoreEditorProps['content']> extends string | infer J ? J : never;

interface EditorUiOptions {
  className?: string;
  style?: React.CSSProperties;
  fill?: boolean;
  bordered?: boolean;
  showToolbar?: boolean;
  showBubbleMenu?: boolean;
  showFloatingMenu?: boolean;
  showTableMenu?: boolean;
  toolbar?: Omit<ToolbarProps, 'editor'>;
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
  comment?: false | CommentConfig;
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
  const defaultExtensionsOptions = useMemo<DefaultExtensionsOptions>(() => {
    const opts: DefaultExtensionsOptions = {
      placeholder,
      locale,
      messages: ui?.messages,
      icons: ui?.icons,
      tabBehavior,
      onError,
      mentionItems,
      hashtagItems,
      slashCommands,
      transformSlashCommands,
      onWikiLinkClick,
      blockHandle,
      wikiLink,
      comment,
      callout: callout !== undefined ? callout : undefined,
      toggleList: toggleList !== undefined ? toggleList : undefined,
      table: table !== undefined ? table : undefined,
    };

    // imageBlock: merge onImageUpload into imageBlock options
    if (imageBlock !== undefined || onImageUpload !== undefined) {
      opts.imageBlock = imageBlock
        ? { ...imageBlock, ...(onImageUpload ? { onUpload: onImageUpload } : {}) }
        : onImageUpload
          ? { onUpload: onImageUpload }
          : undefined;
    }

    // bookmark
    if (bookmark === false) {
      opts.bookmark = false;
    } else if (bookmark !== undefined) {
      opts.bookmark = true;
      if (bookmark.onResolveBookmark) {
        opts.onResolveBookmark = bookmark.onResolveBookmark;
      }
    }

    return opts;
  }, [
    placeholder,
    locale,
    ui?.messages,
    ui?.icons,
    tabBehavior,
    onError,
    mentionItems,
    hashtagItems,
    slashCommands,
    transformSlashCommands,
    onWikiLinkClick,
    blockHandle,
    wikiLink,
    comment,
    callout,
    toggleList,
    table,
    imageBlock,
    onImageUpload,
    bookmark,
  ]);

  const resolvedExtensions = useMemo(() => {
    const defaults = getDefaultExtensions(defaultExtensionsOptions);
    return resolveExtensionsInput(extensions, defaults);
  }, [defaultExtensionsOptions, extensions]);

  const coreProps: CoreEditorProps = {
    ...(content !== undefined ? { content } : { initialContent }),
    extensions: resolvedExtensions,
    editable,
    placeholder,
    onUpdate,
    onCreate,
    locale,
    messages: ui?.messages,
    icons: ui?.icons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    bordered: ui?.bordered,
    showToolbar: ui?.showToolbar ?? false,
    showBubbleMenu: ui?.showBubbleMenu ?? true,
    showFloatingMenu: ui?.showFloatingMenu ?? true,
    showTableMenu: ui?.showTableMenu ?? true,
    toolbar: ui?.toolbar,
    bubbleMenu: ui?.bubbleMenu,
    floatingMenu: ui?.floatingMenu,
    tableMenu: ui?.tableMenu,
  };

  return <CoreEditor {...coreProps} />;
}
