import type { Extensions } from '@tiptap/core';
import type { InkioAdapter } from '@inkio/editor';
import type { SlashCommandItem } from './extensions/SlashCommand/SlashCommand';
import type { MentionItem } from './extensions/Mention/Mention';
import type { HashTagItem } from './extensions/HashTag/HashTag';

export type ExtensionsUploadContext = {
  blockId?: string;
};

export type ExtensionsUploadResult = string | { src: string; [key: string]: unknown };

export interface ExtensionsFileAdapter {
  uploadFile: (file: File, context?: ExtensionsUploadContext) => Promise<ExtensionsUploadResult>;
  resolveFileUrl?: (url: string) => Promise<string>;
  onUploadError?: (error: Error) => void;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

export type ExtensionsSuggestionItems<TItem = unknown> = (
  query: string
) => TItem[] | Promise<TItem[]>;

export interface ExtensionsSuggestionAdapter {
  mentionItems?: ExtensionsSuggestionItems<MentionItem>;
  hashtagItems?: ExtensionsSuggestionItems<HashTagItem>;
  slashCommands?: ExtensionsSuggestionItems<SlashCommandItem>;
}

export interface ExtensionsNavigationAdapter {
  onWikiLinkClick?: (href: string) => void;
  onMentionClick?: (id: string) => void;
  onHashtagClick?: (id: string) => void;
}

export interface ExtensionsImageEditorAdapter {
  /** Custom image loader (e.g. for auth headers, proxy) */
  loadImage?: (src: string) => Promise<HTMLImageElement>;
  /** Default export format */
  outputFormat?: 'png' | 'jpeg' | 'webp';
  /** Default export quality (0-1) */
  outputQuality?: number;
}

export interface ExtensionsCommentAdapter {
  onCommentCreate?: (threadId: string, selection: string) => void;
  onCommentReply?: (threadId: string, content: string) => void;
  onCommentResolve?: (threadId: string) => void;
  onCommentDelete?: (threadId: string) => void;
  loadComments?: (
    threadIds: string[]
  ) => Promise<Array<{ id: string; comments: Array<{ id: string; content: string; author: { id: string; name: string } }> }>>;
  /** Called when user submits a new comment via the auto-managed composer */
  onCommentSubmit?: (threadId: string, text: string, selection: string) => void;
  /** Retrieve thread data for the auto-managed thread popover */
  getThread?: (threadId: string) => import('./extensions/Comment/components/CommentPanel').CommentThreadData | null;
  /** Custom ID generator for new comment threads */
  generateId?: () => string;
  /** Display name for the current user */
  currentUser?: string;
}

export interface ExtensionsAdapter extends InkioAdapter {
  file?: ExtensionsFileAdapter;
  suggestion?: ExtensionsSuggestionAdapter;
  navigation?: ExtensionsNavigationAdapter;
  comment?: ExtensionsCommentAdapter;
  imageEditor?: ExtensionsImageEditorAdapter;
}

export interface ExtensionsAdapterOptionsLike {
  onUpload?: (file: File) => Promise<string>;
  resolveFileUrl?: (url: string) => Promise<string>;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  onUploadError?: (error: Error) => void;
  mentionItems?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  hashtagItems?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  onWikiLinkClick?: (href: string) => void;
  comment?: ExtensionsCommentAdapter;
}

type ConfigurableExtension = {
  name?: string;
  configure?: (options: Record<string, unknown>) => unknown;
};

function isConfigurableExtension(value: unknown): value is ConfigurableExtension {
  return (
    !!value &&
    typeof value === 'object' &&
    'configure' in value &&
    typeof (value as ConfigurableExtension).configure === 'function'
  );
}

function toUploadSrc(result: ExtensionsUploadResult): string {
  if (typeof result === 'string') {
    return result;
  }

  if (typeof result.src === 'string') {
    return result.src;
  }

  throw new Error(
    'ExtensionsAdapter.file.uploadFile must return a URL string or an object containing a string `src`.'
  );
}

export function isExtensionsAdapter(value: unknown): value is ExtensionsAdapter {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  // DefaultInkioExtensionsOptions has these keys that ExtensionsAdapter does NOT have.
  // If any are present, this is an options object, not an adapter.
  const optionsOnlyKeys = ['blockHandle', 'placeholder', 'locale', 'onUpload', 'mentionItems', 'hashtagItems', 'slashCommands', 'onWikiLinkClick'];
  if (optionsOnlyKeys.some((key) => key in candidate)) {
    return false;
  }

  const adapterKeys = ['file', 'suggestion', 'navigation', 'comment', 'imageEditor'] as const;
  const hasAdapterKey = adapterKeys.some((key) => key in candidate);
  if (!hasAdapterKey) {
    return false;
  }

  for (const key of adapterKeys) {
    if (key in candidate && candidate[key] !== undefined && typeof candidate[key] !== 'object') {
      return false;
    }
  }

  return true;
}

export function mapExtensionsAdapterToOptions(
  adapter: ExtensionsAdapter
): ExtensionsAdapterOptionsLike {
  const fileAdapter = adapter.file;
  const suggestionAdapter = adapter.suggestion;

  const mentionItems = suggestionAdapter?.mentionItems;
  const hashtagItems = suggestionAdapter?.hashtagItems;
  const slashCommands = suggestionAdapter?.slashCommands;

  return {
    onUpload: fileAdapter?.uploadFile
      ? async (file: File) => {
        const uploadResult = await fileAdapter.uploadFile(file);
        return toUploadSrc(uploadResult);
      }
      : undefined,
    resolveFileUrl: fileAdapter?.resolveFileUrl,
    allowedMimeTypes: fileAdapter?.allowedMimeTypes,
    maxFileSize: fileAdapter?.maxFileSize,
    onUploadError:
      fileAdapter?.onUploadError ??
      (adapter.onError
        ? (error: Error) =>
          adapter.onError?.(error, {
            source: 'file.upload',
            recoverable: true,
          })
        : undefined),
    mentionItems: mentionItems
      ? ({ query }: { query: string }) => mentionItems(query)
      : undefined,
    hashtagItems: hashtagItems
      ? ({ query }: { query: string }) => hashtagItems(query)
      : undefined,
    slashCommands,
    onWikiLinkClick: adapter.navigation?.onWikiLinkClick,
    comment: adapter.comment,
  };
}

export function applyExtensionsAdapter(
  extensions: Extensions,
  adapter: ExtensionsAdapter
): Extensions {
  const mappedOptions = mapExtensionsAdapterToOptions(adapter);
  const onError = adapter.onError;

  return extensions.map((extension) => {
    if (!isConfigurableExtension(extension) || typeof extension.name !== 'string') {
      return extension;
    }

    switch (extension.name) {
      case 'imageBlock':
        return extension.configure?.({
          onUpload: mappedOptions.onUpload,
          resolveFileUrl: mappedOptions.resolveFileUrl,
          allowedMimeTypes: mappedOptions.allowedMimeTypes,
          maxFileSize: mappedOptions.maxFileSize,
          onUploadError: mappedOptions.onUploadError,
          onError,
        }) as Extensions[number];
      case 'mention':
        return extension.configure?.({
          items: mappedOptions.mentionItems,
          onError,
        }) as Extensions[number];
      case 'hashTag':
        return extension.configure?.({
          items: mappedOptions.hashtagItems,
          onError,
        }) as Extensions[number];
      case 'slashCommand':
        return extension.configure?.({
          items: mappedOptions.slashCommands
            ? ({ query }: { query: string }) => mappedOptions.slashCommands?.(query)
            : undefined,
          onError,
        }) as Extensions[number];
      case 'wikiLink':
        return extension.configure?.({
          onClick: mappedOptions.onWikiLinkClick,
        }) as Extensions[number];
      case 'comment':
        if (!mappedOptions.comment) {
          return extension;
        }
        return extension.configure?.({
          onCommentCreate: mappedOptions.comment.onCommentCreate,
          onCommentActivate: undefined,
          onCommentSubmit: mappedOptions.comment.onCommentSubmit,
          onCommentReply: mappedOptions.comment.onCommentReply,
          onCommentResolve: mappedOptions.comment.onCommentResolve,
          onCommentDelete: mappedOptions.comment.onCommentDelete,
          getThread: mappedOptions.comment.getThread,
          generateId: mappedOptions.comment.generateId,
          currentUser: mappedOptions.comment.currentUser,
        }) as Extensions[number];
      default:
        return extension;
    }
  }) as Extensions;
}
