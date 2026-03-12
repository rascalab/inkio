import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BookmarkView } from './BookmarkView';

const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript):/i;

function isSafeUrl(value: string | null | undefined): string {
  if (!value) return '';
  return BLOCKED_PROTOCOLS.test(value.trim()) ? '' : value;
}

export interface BookmarkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface BookmarkAttributes extends BookmarkPreview {
  url: string;
}

export interface BookmarkOptions {
  HTMLAttributes: Record<string, any>;
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attributes: { url: string }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions>({
  name: 'bookmark',

  group: 'block',

  atom: true,

  draggable: true,

  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onResolveBookmark: undefined,
    };
  },

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) =>
          isSafeUrl(element.getAttribute('data-bookmark-url') || element.getAttribute('href')),
        renderHTML: (attributes) => ({
          'data-bookmark-url': isSafeUrl(attributes.url),
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bookmark-title'),
        renderHTML: (attributes) =>
          attributes.title ? { 'data-bookmark-title': attributes.title } : {},
      },
      description: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bookmark-description'),
        renderHTML: (attributes) =>
          attributes.description ? { 'data-bookmark-description': attributes.description } : {},
      },
      image: {
        default: null,
        parseHTML: (element) => isSafeUrl(element.getAttribute('data-bookmark-image')) || null,
        renderHTML: (attributes) =>
          attributes.image ? { 'data-bookmark-image': isSafeUrl(attributes.image) } : {},
      },
      favicon: {
        default: null,
        parseHTML: (element) => isSafeUrl(element.getAttribute('data-bookmark-favicon')) || null,
        renderHTML: (attributes) =>
          attributes.favicon ? { 'data-bookmark-favicon': isSafeUrl(attributes.favicon) } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-bookmark-url]',
      },
      {
        tag: 'a[data-bookmark-url]',
      },
      {
        tag: 'a[data-bookmark-fallback]',
        getAttrs: (element) => {
          if (typeof element === 'string') {
            return false;
          }

          const href = element.getAttribute('href');

          if (!href) {
            return false;
          }

          const safeHref = isSafeUrl(href);
          if (!safeHref) return false;
          return { url: safeHref };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const hasPreviewData = Boolean(
      HTMLAttributes['data-bookmark-title'] ||
        HTMLAttributes['data-bookmark-description'] ||
        HTMLAttributes['data-bookmark-image'] ||
        HTMLAttributes['data-bookmark-favicon']
    );

    if (!hasPreviewData) {
      return [
        'a',
        mergeAttributes(
          {
            'data-bookmark-fallback': '',
            href: isSafeUrl(HTMLAttributes['data-bookmark-url']),
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
          this.options.HTMLAttributes,
          HTMLAttributes
        ),
        HTMLAttributes['data-bookmark-url'],
      ];
    }

    return [
      'div',
      mergeAttributes({ 'data-bookmark': '' }, this.options.HTMLAttributes, HTMLAttributes),
      ['a', { href: isSafeUrl(HTMLAttributes['data-bookmark-url']) }, HTMLAttributes['data-bookmark-title'] || HTMLAttributes['data-bookmark-url']],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url: attributes.url,
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});
