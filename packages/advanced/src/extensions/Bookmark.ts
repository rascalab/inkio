import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { sanitizeUrlOrEmpty } from '@inkio/core';
import { BookmarkView } from './BookmarkView';
import type { BookmarkOptions, BookmarkStorage } from './bookmark-types';

export type { BookmarkAttributes, BookmarkOptions, BookmarkPreview } from './bookmark-types';

declare module '@tiptap/core' {
  interface Storage {
    bookmark: BookmarkStorage;
  }

  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attributes: { url: string }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions, BookmarkStorage>({
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

  addStorage() {
    // Local insertion intent is not serialized or shared with collaborators.
    return { previewRequests: new WeakSet() };
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
        renderHTML: ({ title }) =>
          typeof title === 'string' && title ? { 'data-bookmark-title': title } : {},
      },
      description: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bookmark-description'),
        renderHTML: ({ description }) =>
          typeof description === 'string' && description ? { 'data-bookmark-description': description } : {},
      },
      image: {
        default: null,
        parseHTML: (element) => sanitizeUrlOrEmpty(element.getAttribute('data-bookmark-image')) || null,
        renderHTML: (attributes) => {
          const url = sanitizeUrlOrEmpty(attributes.image);
          return url ? { 'data-bookmark-image': url } : {};
        },
      },
      favicon: {
        default: null,
        parseHTML: (element) => sanitizeUrlOrEmpty(element.getAttribute('data-bookmark-favicon')) || null,
        renderHTML: (attributes) => {
          const url = sanitizeUrlOrEmpty(attributes.favicon);
          return url ? { 'data-bookmark-favicon': url } : {};
        },
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
    const href = sanitizeUrlOrEmpty(HTMLAttributes['data-bookmark-url']);
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
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      );
      // Pin the destination and navigation attributes after HTMLAttributes overrides.
      fallbackAttrs.rel = 'noopener noreferrer nofollow';
      fallbackAttrs.target = '_blank';
      fallbackAttrs.href = href;
      return ['a', fallbackAttrs, href];
    }

    return [
      'div',
      mergeAttributes({ 'data-bookmark': '' }, this.options.HTMLAttributes, HTMLAttributes),
      // Same-tab navigation needs no target, but user-supplied URLs still
      // get rel hygiene (no opener reference, no SEO juice).
      ['a', { href, rel: 'noopener noreferrer nofollow' }, HTMLAttributes['data-bookmark-title'] || href],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ commands, dispatch, tr }) => {
          const url = sanitizeUrlOrEmpty(attributes?.url);
          if (!url) {
            return false;
          }
          const node = this.type.create({ url });
          const inserted = commands.insertContentAt(tr.selection, node);
          if (inserted && dispatch && this.editor.isEditable && this.options.onResolveBookmark) {
            this.storage.previewRequests.add(node);
          }
          return inserted;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});
