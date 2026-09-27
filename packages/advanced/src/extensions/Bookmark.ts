import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { sanitizeUrlOrEmpty } from '@inkio/core';
import { BookmarkView } from './BookmarkView';

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
  /** Loading placeholder text while the preview resolves. */
  loadingPreviewText?: string;
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
          sanitizeUrlOrEmpty(element.getAttribute('data-bookmark-url') || element.getAttribute('href')),
        renderHTML: (attributes) => ({
          'data-bookmark-url': sanitizeUrlOrEmpty(attributes.url),
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
        parseHTML: (element) => sanitizeUrlOrEmpty(element.getAttribute('data-bookmark-image')) || null,
        renderHTML: (attributes) =>
          attributes.image ? { 'data-bookmark-image': sanitizeUrlOrEmpty(attributes.image) } : {},
      },
      favicon: {
        default: null,
        parseHTML: (element) => sanitizeUrlOrEmpty(element.getAttribute('data-bookmark-favicon')) || null,
        renderHTML: (attributes) =>
          attributes.favicon ? { 'data-bookmark-favicon': sanitizeUrlOrEmpty(attributes.favicon) } : {},
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

          const safeHref = sanitizeUrlOrEmpty(href);
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
      const fallbackAttrs = mergeAttributes(
        {
          'data-bookmark-fallback': '',
          href: sanitizeUrlOrEmpty(HTMLAttributes['data-bookmark-url']),
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      );
      // Links point at user-supplied URLs: pin the security attributes
      // last so neither extension config nor node attrs can downgrade
      // rel/target (tabnabbing via window.opener).
      fallbackAttrs.rel = 'noopener noreferrer nofollow';
      fallbackAttrs.target = '_blank';
      return ['a', fallbackAttrs, HTMLAttributes['data-bookmark-url']];
    }

    return [
      'div',
      mergeAttributes({ 'data-bookmark': '' }, this.options.HTMLAttributes, HTMLAttributes),
      // Same-tab navigation needs no target, but user-supplied URLs still
      // get rel hygiene (no opener reference, no SEO juice).
      ['a', { href: sanitizeUrlOrEmpty(HTMLAttributes['data-bookmark-url']), rel: 'noopener noreferrer nofollow' }, HTMLAttributes['data-bookmark-title'] || HTMLAttributes['data-bookmark-url']],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ commands }) => {
          const url = sanitizeUrlOrEmpty(attributes?.url);
          if (!url) {
            return false;
          }
          return commands.insertContent({
            type: this.name,
            attrs: {
              url,
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});
