import { mergeAttributes, Node } from '@tiptap/core';
import { isSafeUrl } from '../utils/url-safety';
import { UPLOAD_PLACEHOLDER_PREFIX } from './image-block-shared';

export interface ImageBlockSchemaOptions {
  HTMLAttributes: Record<string, any>;
}

export const ImageBlockSchema = Node.create<ImageBlockSchemaOptions>({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('src');
          if (!raw) return null;
          if (!isSafeUrl(raw)) return null;
          return raw;
        },
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: '100%',
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      align: {
        default: 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.align,
        }),
      },
      caption: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="imageBlock"]',
        getAttrs: (dom: HTMLElement) => {
          const img = dom.querySelector('img');
          if (!img) return false;
          const rawSrc = img.getAttribute('src');
          if (rawSrc && !isSafeUrl(rawSrc)) return false;
          const figcaption = dom.querySelector('figcaption');
          return {
            src: rawSrc,
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: img.getAttribute('width') || dom.getAttribute('data-width'),
            align: dom.getAttribute('data-align'),
            caption: figcaption?.textContent || null,
          };
        },
      },
      {
        tag: 'figure',
        getAttrs: (dom: HTMLElement) => {
          const img = dom.querySelector('img');
          if (!img) return false;
          const rawSrc = img.getAttribute('src');
          if (rawSrc && !isSafeUrl(rawSrc)) return false;
          const figcaption = dom.querySelector('figcaption');
          return {
            src: rawSrc,
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            caption: figcaption?.textContent || null,
          };
        },
      },
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, title, width, caption, 'data-align': align, ...rest } = mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
    );
    // A placeholder `src` is a transient sentinel, not a real URL. Emitting it
    // as an `<img src>` makes the browser fetch a bogus relative path (e.g. via
    // `generateHTML` static rendering). Render a loading box instead.
    if (typeof src === 'string' && src.startsWith(UPLOAD_PLACEHOLDER_PREFIX)) {
      return [
        'figure',
        { 'data-type': 'imageBlock', 'data-align': align, ...rest },
        ['div', { class: 'inkio-image-block-placeholder', role: 'img', 'aria-label': alt || 'Uploading image' }],
      ];
    }
    const safeSrc = typeof src === 'string' && isSafeUrl(src) ? src : null;
    if (!safeSrc) {
      return [
        'figure',
        { 'data-type': 'imageBlock', 'data-align': align, ...rest },
        ['div', { class: 'inkio-image-block-placeholder', role: 'img', 'aria-label': alt || 'Blocked image' }],
      ];
    }
    return [
      'figure',
      { 'data-type': 'imageBlock', 'data-align': align, ...rest },
      ['img', { src: safeSrc, alt, title, width }],
      ['figcaption', {}, typeof node.attrs.caption === 'string' ? node.attrs.caption : caption || ''],
    ];
  },
});
