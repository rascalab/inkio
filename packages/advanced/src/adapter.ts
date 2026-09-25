import type { Extensions } from '@tiptap/core';
import type { InkioAdapter } from '@inkio/core';
import type { SlashCommandItem } from './extensions/SlashCommand';
import type { SlashCommandTransform } from './extensions/SlashCommand';
import type { MentionItem } from './extensions/Mention';
import type { HashTagItem } from './extensions/HashTag';

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

export interface ExtensionsAdapter extends InkioAdapter {
  file?: ExtensionsFileAdapter;
  suggestion?: ExtensionsSuggestionAdapter;
  navigation?: ExtensionsNavigationAdapter;
}

export interface ExtensionsAdapterOptionsLike {
  onUpload?: (file: File, context?: ExtensionsUploadContext) => Promise<string>;
  resolveFileUrl?: (url: string) => Promise<string>;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  onUploadError?: (error: Error) => void;
  mentionItems?: (props: { query: string }) => MentionItem[] | Promise<MentionItem[]>;
  hashtagItems?: (props: { query: string }) => HashTagItem[] | Promise<HashTagItem[]>;
  slashCommands?: (query: string) => SlashCommandItem[] | Promise<SlashCommandItem[]>;
  transformSlashCommands?: SlashCommandTransform;
  onWikiLinkClick?: (href: string) => void;
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

  // Closed key set: an adapter carries section keys plus the shared
  // InkioAdapter base keys and nothing else, so option objects (which always
  // carry item-source keys like mentionItems) can never classify as one.
  const allowedKeys = [
    'file',
    'suggestion',
    'navigation',
    'onUpdate',
    'onCreate',
    'onError',
    'locale',
  ];
  const ownKeys = Object.keys(candidate);
  if (ownKeys.some((key) => !allowedKeys.includes(key))) {
    return false;
  }

  const adapterKeys = ['file', 'suggestion', 'navigation'] as const;
  const hasAdapterKey = adapterKeys.some((key) => key in candidate);
  if (!hasAdapterKey) {
    return false;
  }

  for (const key of adapterKeys) {
    // A null section is not a usable adapter (typeof null === 'object'
    // would otherwise admit it); only real section objects qualify.
    if (key in candidate && candidate[key] !== undefined && (candidate[key] === null || typeof candidate[key] !== 'object')) {
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
      ? async (file: File, context?: ExtensionsUploadContext) => {
        const uploadResult = await fileAdapter.uploadFile(file, context);
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
          onClick: adapter.navigation?.onMentionClick,
        }) as Extensions[number];
      case 'hashTag':
        return extension.configure?.({
          items: mappedOptions.hashtagItems,
          onError,
          onClick: adapter.navigation?.onHashtagClick,
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
      default:
        return extension;
    }
  }) as Extensions;
}
