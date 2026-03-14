import type { Extensions } from '@tiptap/core';
import {
  type InkioLocaleInput,
  type InkioMessageOverrides,
  type InkioErrorHandler,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  getDefaultExtensions as getEssentialDefaultExtensions,
  type DefaultExtensionsOptions as EssentialDefaultExtensionsOptions,
} from '@inkio/essential';
import { Mention, type MentionItem } from './extensions/Mention';
import { HashTag, type HashTagItem } from './extensions/HashTag';
import { SlashCommand } from './extensions/SlashCommand';
import type { SlashCommandItem, SlashCommandTransform } from './extensions/SlashCommand';
import { WikiLink } from './extensions/WikiLink';
import { Bookmark, type BookmarkPreview } from './extensions/Bookmark';
import { BlockHandle } from './extensions/BlockHandle';
import { Comment, type CommentOptions } from './comment/Comment';

export interface DefaultExtensionsOptions extends EssentialDefaultExtensionsOptions {
  mentionItems?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  hashtagItems?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
  blockHandle?: boolean;
  wikiLink?: boolean;
  bookmark?: boolean;
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
  onError?: InkioErrorHandler;
  comment?: false | Omit<Partial<CommentOptions>, 'HTMLAttributes'>;
}

export function getDefaultExtensions(options: DefaultExtensionsOptions = {}) {
  const {
    mentionItems,
    hashtagItems,
    slashCommands,
    transformSlashCommands,
    onWikiLinkClick,
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
    ...getEssentialDefaultExtensions(essentialOptions),
    Mention.configure({
      items: mentionItems as
        | ((props: { query: string }) => MentionItem[] | Promise<MentionItem[]>)
        | undefined,
      onError,
    }),
    ...(hashtagItems
      ? [
          HashTag.configure({
            items: hashtagItems as
              | ((props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>)
              | undefined,
            onError,
          }),
        ]
      : []),
    SlashCommand.configure({
      ...(slashCommands
        ? { items: ({ query }: { query: string }) => slashCommands(query) }
        : {}),
      ...(transformSlashCommands ? { transformItems: transformSlashCommands } : {}),
      onError,
    }),
    ...(wikiLink !== false ? [WikiLink.configure({ onClick: onWikiLinkClick })] : []),
    ...(bookmark
      ? [Bookmark.configure({ onResolveBookmark })]
      : []),
    ...(comment
      ? [Comment.configure(comment)]
      : []),
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
