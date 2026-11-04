import type { Extensions } from '@tiptap/core';
import {
  type InkioLocaleInput,
  type InkioMessageOverrides,
  type InkioErrorHandler,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  getExtensions as getEssentialDefaultExtensions,
  type CoreExtensionOptions as EssentialDefaultExtensionsOptions,
} from '@inkio/core';
import { Mention, type MentionItem } from './extensions/Mention';
import { HashTag, type HashTagItem } from './extensions/HashTag';
import { SlashCommand } from './extensions/SlashCommand';
import type { SlashCommandItem, SlashCommandTransform } from './extensions/SlashCommand';
import { WikiLink, type WikiLinkItem } from './extensions/WikiLink';
import { Bookmark, type BookmarkPreview } from './extensions/Bookmark';
import { BlockHandle } from './extensions/BlockHandle';
import { Comment, CommentDisplay, toCommentOptions, type CommentConfig } from './comment';

export interface DefaultExtensionsOptions extends EssentialDefaultExtensionsOptions {
  mentionItems?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  hashtagItems?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
  wikiLinkItems?: (props: { query: string }) => WikiLinkItem[] | Promise<WikiLinkItem[]>;
  blockHandle?: boolean;
  wikiLink?: boolean;
  bookmark?: boolean;
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
  onError?: InkioErrorHandler;
  comment?: CommentConfig;
}

export function getDefaultExtensions(options: DefaultExtensionsOptions = {}) {
  const {
    mentionItems,
    hashtagItems,
    slashCommands,
    transformSlashCommands,
    onWikiLinkClick,
    wikiLinkItems,
    blockHandle,
    wikiLink,
    bookmark,
    locale,
    messages,
    icons,
    onResolveBookmark,
    onError,
    comment,
    ...essentialOptions
  } = options;

  const extensions: Extensions = [
    ...getEssentialDefaultExtensions({ ...essentialOptions, locale, messages, icons }),
    Mention.configure({
      items: mentionItems as
        | ((props: { query: string }) => MentionItem[] | Promise<MentionItem[]>)
        | undefined,
      onError,
      locale,
      messages,
    }),
    // Always in the schema, like the marks below: Tiptap empties a whole document
    // that holds a node it doesn't know. Without items `#` just opens nothing.
    HashTag.configure({
      items: hashtagItems as
        | ((props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>)
        | undefined,
      onError,
      locale,
      messages,
    }),
    SlashCommand.configure({
      ...(slashCommands
        ? { items: ({ query }: { query: string }) => slashCommands(query) }
        : {}),
      ...(transformSlashCommands ? { transformItems: transformSlashCommands } : {}),
      onError,
      locale,
      messages,
      icons,
    }),
    ...(wikiLink !== false
      ? [WikiLink.configure({ onClick: onWikiLinkClick, items: wikiLinkItems, onError, locale, messages })]
      : []),
    ...(bookmark !== false
      ? [Bookmark.configure({ onResolveBookmark })]
      : []),
    comment
      ? Comment.configure({ ...toCommentOptions(comment), locale, messages, icons })
      : CommentDisplay,
  ];

  if (blockHandle !== false) {
    extensions.push(
      BlockHandle.configure({
        locale,
        messages,
        coreIcons: icons,
      }),
    );
  }

  return extensions;
}
