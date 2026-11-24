'use client';

import { useMemo, useState } from 'react';
import {
  Editor as CoreEditor,
  type EditorProps as CoreEditorProps,
  type WithEditorExtensions,
  type InkioLocaleInput,
  type InkioEditorUiOptions,
  type InkioErrorHandler,
} from '@inkio/core';
import type { ImageBlockOptions, ImageUploadContext } from '@inkio/core';
import type { HashTagItem, MentionItem, SlashCommandItem, SlashCommandTransform, BookmarkPreview, CommentConfig, WikiLinkItem } from '@inkio/advanced';
import { getDefaultExtensions, type DefaultExtensionsOptions } from '@inkio/advanced';
import { useCommentThreadUpdates } from './use-comment-thread-updates';
import type { ExtensionsInput } from '../types';
import { mapEditorUiToCoreProps, mergeImageBlockOptions, resolveExtensionsInput, useStableExtensions, useStableProps } from '@inkio/core';
import type { InkioJSONContent as JSONContent } from '@inkio/core';

export interface EditorProps {
  /** Initial document only (uncontrolled). */
  content?: string | JSONContent;
  editable?: boolean;
  placeholder?: string;
  /** Accessible name of the editing surface. */
  ariaLabel?: string;
  locale?: InkioLocaleInput;
  /** Color theme */
  theme?: 'light' | 'dark';
  tabBehavior?: 'indent' | 'default';
  onUpdate?: (content: JSONContent) => void;
  onChange?: CoreEditorProps['onChange'];
  onCreate?: CoreEditorProps['onCreate'];

  // UI
  ui?: InkioEditorUiOptions;

  // Feature callbacks
  onImageUpload?: (file: File, context: ImageUploadContext) => Promise<string | { src: string; [key: string]: unknown }>;
  hashtagItems?: (params: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  mentionItems?: (params: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
  /** Page suggestions after typing `[[`; the chosen item's `id` becomes the link target. */
  wikiLinkItems?: (params: { query: string }) => WikiLinkItem[] | Promise<WikiLinkItem[]>;
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

export function Editor<const Input extends EditorProps['extensions']>(props: WithEditorExtensions<EditorProps, Input>): React.JSX.Element;
export function Editor(props: EditorProps): React.JSX.Element;
export function Editor({
  content,
  editable,
  placeholder,
  ariaLabel,
  locale,
  theme,
  tabBehavior,
  onChange,
  onUpdate,
  onCreate,
  ui,
  onImageUpload,
  hashtagItems,
  mentionItems,
  slashCommands,
  transformSlashCommands,
  onWikiLinkClick,
  wikiLinkItems,
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
  // Only where the extensions start: `CoreEditor` keeps the live editor up to date
  // with later changes, so the document, caret and undo history stay.
  const [firstUi] = useState(() => ({ placeholder, locale, messages: stableUi.messages, icons: stableUi.icons }));
  // React components are not event callbacks: keep their identity (including classes).
  const imageEditor = imageBlock?.imageEditor;
  const extensionInputs = useStableProps({
    tabBehavior,
    onError,
    mentionItems,
    hashtagItems,
    slashCommands,
    transformSlashCommands,
    onWikiLinkClick,
    wikiLinkItems,
    blockHandle,
    wikiLink,
    comment,
    callout,
    toggleList,
    table,
    imageBlock: imageBlock && { ...imageBlock, imageEditor: undefined },
    onImageUpload,
    bookmark,
  });

  useCommentThreadUpdates(comment?.getComments);
  const stableExtensions = useStableExtensions(extensions);

  const resolvedExtensions = useMemo(() => {
    const input = extensionInputs;
    const opts: DefaultExtensionsOptions = {
      ...firstUi,
      tabBehavior: input.tabBehavior,
      onError: input.onError,
      mentionItems: input.mentionItems,
      hashtagItems: input.hashtagItems,
      slashCommands: input.slashCommands,
      transformSlashCommands: input.transformSlashCommands,
      onWikiLinkClick: input.onWikiLinkClick,
      wikiLinkItems: input.wikiLinkItems,
      blockHandle: input.blockHandle,
      wikiLink: input.wikiLink,
      comment: input.comment,
      callout: input.callout === false ? false : undefined,
      toggleList: input.toggleList === false ? false : undefined,
      table: input.table === false ? false : undefined,
    };

    // imageBlock: merge onImageUpload into imageBlock options
    const mergedImageBlock = mergeImageBlockOptions(input.imageBlock, {
      onUpload: input.onImageUpload,
      onError: input.onError,
    });
    if (mergedImageBlock) {
      opts.imageBlock = { ...mergedImageBlock, imageEditor };
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

    return { items: resolveExtensionsInput(stableExtensions, () => getDefaultExtensions(opts)), replace: true };
  }, [extensionInputs, stableExtensions, firstUi, imageEditor]);

  const coreProps: CoreEditorProps = {
    ...mapEditorUiToCoreProps(stableUi, {
      showToolbar: false,
      showBubbleMenu: true,
      showFloatingMenu: true,
      showTableMenu: true,
    }),
    content,
    extensions: resolvedExtensions,
    editable,
    placeholder,
    ariaLabel,
    theme,
    onChange,
    onUpdate,
    onCreate,
    locale,
  };

  return <CoreEditor {...coreProps} />;
}
