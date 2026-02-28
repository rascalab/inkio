import type { Extensions } from '@tiptap/core';
import { lazy } from 'react';
import {
  getDefaultCoreExtensions,
  type InkioErrorHandler,
  type InkioLocaleInput,
  type InkioMessageOverrides,
  type InkioIconRegistry,
} from '@inkio/editor';
import {
  isExtensionsAdapter,
  mapExtensionsAdapterToOptions,
  type ExtensionsAdapter,
  type ExtensionsCommentAdapter,
} from '../adapter';

const LazyImageEditorModal = lazy(() =>
  import('./ImageEditor/ImageEditorModal').then(mod => ({ default: mod.ImageEditorModal }))
);
import { Callout } from './Callout';
import { WikiLink } from './WikiLink';
import { Mention, type MentionItem } from './Mention';
import { HashTag, type HashTagItem } from './HashTag';
import { SlashCommand } from './SlashCommand';
import type { SlashCommandItem } from './SlashCommand';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ToggleList } from './ToggleList';
import { SimpleTable } from './SimpleTable';
import { Bookmark, type BookmarkPreview } from './Bookmark';
import { EquationBlock, EquationInline } from './Equation';
import { Comment } from './Comment';
import { BlockHandle } from './BlockHandle';
import type { InkioExtensionsMessageOverrides } from '../i18n';

export interface DefaultInkioExtensionsOptions {
  placeholder?: string;
  onUpload?: (file: File) => Promise<string>;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  onUploadError?: (error: Error) => void;
  mentionItems?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  hashtagItems?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  onWikiLinkClick?: (href: string) => void;
  /** Enable Notion-like block handles with drag & drop. Default: false */
  blockHandle?: boolean;
  /** Set to false to disable callout blocks */
  callout?: false;
  /** Set to false to disable equation blocks */
  equation?: false;
  /** Set to false to disable toggle lists */
  toggleList?: false;
  /** Set to false to disable wiki links */
  wikiLink?: false;
  /** Set to false to disable simple tables */
  simpleTable?: false;
  /** Set to false to disable bookmarks */
  bookmark?: false;
  /** Locale input for extension UIs that render standalone portals. */
  locale?: InkioLocaleInput;
  /** Message overrides for extension UIs that render standalone portals. */
  messages?: InkioExtensionsMessageOverrides | InkioMessageOverrides;
  /** Icon overrides for extension UIs that render standalone portals. */
  icons?: Partial<InkioIconRegistry>;
  /** Comment adapter callbacks */
  comment?: ExtensionsCommentAdapter;
  /** Bookmark preview resolver */
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
  /**
   * Tab key behavior inside the editor.
   * - `'indent'` (default): Tab sinks list items / Shift+Tab lifts them. Prevents browser focus navigation.
   * - `'default'`: Tab follows normal browser behavior (focus next element).
   */
  tabBehavior?: 'indent' | 'default';
}

type ResolvedDefaultInkioExtensionsOptions = DefaultInkioExtensionsOptions & {
  onError?: InkioErrorHandler;
  resolveFileUrl?: (url: string) => Promise<string>;
};

export const getDefaultInkioExtensions = (
  adapterOrOptions: ExtensionsAdapter | DefaultInkioExtensionsOptions = {}
) => {
  const resolved: ResolvedDefaultInkioExtensionsOptions = isExtensionsAdapter(adapterOrOptions)
    ? {
      ...mapExtensionsAdapterToOptions(adapterOrOptions),
      onError: adapterOrOptions.onError,
      blockHandle: true,
      resolveFileUrl: adapterOrOptions.file?.resolveFileUrl,
    }
    : adapterOrOptions;

  const {
    placeholder,
    onUpload,
    allowedMimeTypes,
    maxFileSize,
    onUploadError,
    mentionItems,
    hashtagItems,
    slashCommands,
    onWikiLinkClick,
    onError,
    resolveFileUrl,
    blockHandle,
    callout,
    equation,
    toggleList,
    wikiLink,
    simpleTable,
    bookmark,
    comment,
    locale,
    messages,
    icons,
    onResolveBookmark,
  } = resolved;

  const baseExtensions = getDefaultCoreExtensions({
    placeholder,
    tabBehavior: resolved.tabBehavior,
    imageBlock: {
      onUpload,
      allowedMimeTypes,
      maxFileSize,
      onUploadError,
      onError,
      resolveFileUrl,
      imageEditor: LazyImageEditorModal,
    },
  });

  const extensions = [
    ...baseExtensions,
    Mention.configure({
      items: mentionItems as ((props: { query: string }) => MentionItem[] | Promise<MentionItem[]>) | undefined,
      onError,
    }),
    // HashTag is opt-in: # trigger conflicts with Heading markdown shortcut
    ...(hashtagItems ? [HashTag.configure({ items: hashtagItems as (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>, onError })] : []),
    SlashCommand.configure({
      ...(slashCommands
        ? { items: ({ query }: { query: string }) => slashCommands(query) }
        : {}),
      onError,
    }),
    ...(callout !== false ? [Callout] : []),
    ...(wikiLink !== false ? [WikiLink.configure({ onClick: onWikiLinkClick })] : []),
    KeyboardShortcuts,
    ...(toggleList !== false ? [ToggleList] : []),
    ...(simpleTable !== false ? [SimpleTable] : []),
    ...(bookmark !== false ? [Bookmark.configure({ onResolveBookmark })] : []),
    ...(equation !== false ? [EquationBlock, EquationInline] : []),
  ];

  if (comment) {
    extensions.push(
      Comment.configure({
        onCommentCreate: comment.onCommentCreate,
        onCommentActivate: undefined,
        onCommentSubmit: comment.onCommentSubmit,
        onCommentReply: comment.onCommentReply,
        onCommentResolve: comment.onCommentResolve,
        onCommentDelete: comment.onCommentDelete,
        getThread: comment.getThread,
        generateId: comment.generateId,
        currentUser: comment.currentUser,
        locale,
        messages,
        icons,
      })
    );
  }

  if (blockHandle) {
    extensions.push(
      BlockHandle.configure({
        locale,
        // Safe cast: BlockHandle only reads InkioCoreMessageOverrides keys,
        // which are a subset of both InkioExtensionsMessageOverrides and InkioMessageOverrides
        messages: messages as InkioMessageOverrides | undefined,
        coreIcons: icons,
      })
    );
  }

  return extensions as Extensions;
};
