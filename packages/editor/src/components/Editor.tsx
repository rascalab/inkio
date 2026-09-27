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
import { mapEditorUiToCoreProps, mergeImageBlockOptions, resolveExtensionsInput, useStableProps } from '@inkio/core';
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

export interface EditorProps {
  /** Initial document only (uncontrolled). */
  content?: string | JSONContent;
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
  // per keystroke). Structural inputs are stabilized; callbacks become
  // stable forwarders to the latest implementation, so one call covers every
  // field (a missed per-field wrapper was a past bug source).
  const stableUi = useStableProps(ui ?? {});
  const extensionInputs = useStableProps({
    placeholder,
    locale,
    messages: stableUi.messages,
    icons: stableUi.icons,
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
  });

  const resolvedExtensions = useMemo(() => {
    const input = extensionInputs;
    const opts: DefaultExtensionsOptions = {
      placeholder: input.placeholder,
      locale: input.locale,
      messages: input.messages,
      icons: input.icons,
      tabBehavior: input.tabBehavior,
      onError: input.onError,
      mentionItems: input.mentionItems,
      hashtagItems: input.hashtagItems,
      slashCommands: input.slashCommands,
      transformSlashCommands: input.transformSlashCommands,
      onWikiLinkClick: input.onWikiLinkClick,
      blockHandle: input.blockHandle,
      wikiLink: input.wikiLink,
      comment: input.comment,
      callout: input.callout === false ? false : undefined,
      toggleList: input.toggleList === false ? false : undefined,
      table: input.table === false ? false : undefined,
    };

    // imageBlock: merge onImageUpload into imageBlock options
    const mergedImageBlock = mergeImageBlockOptions(input.imageBlock, { onUpload: input.onImageUpload });
    if (mergedImageBlock) {
      opts.imageBlock = mergedImageBlock;
    }

    // bookmark
    if (input.bookmark === false) {
      opts.bookmark = false;
    } else if (input.bookmark !== undefined) {
      opts.bookmark = true;
      if (input.bookmark.onResolveBookmark) {
        opts.onResolveBookmark = input.bookmark.onResolveBookmark;
      }
    }

    return resolveExtensionsInput(extensions, getDefaultExtensions(opts));
  }, [extensionInputs, extensions]);

  const coreProps: CoreEditorProps = {
    ...mapEditorUiToCoreProps(stableUi, {
      showToolbar: false,
      showBubbleMenu: true,
      showFloatingMenu: true,
      showTableMenu: true,
    }),
    // This wrapper has no toolbar surface.
    showToolbar: false,
    toolbar: undefined,
    content,
    extensions: resolvedExtensions,
    editable,
    placeholder,
    theme,
    onUpdate,
    onCreate,
    locale,
  };

  return <CoreEditor {...coreProps} />;
}
