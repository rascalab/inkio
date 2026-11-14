import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { isSafeUrl } from '../utils/url-safety';
import {
  reportImageUploadError,
  uploadImageFile,
  getImageValidationError,
  type ImageUploadOptions,
} from './image-block-upload';
import { createImageCleanupPlugin, queueImageCleanup, type ImageCleanupOptions } from './image-block-cleanup';
import {
  IMAGE_BLOCK_MAX_WIDTH_PERCENT,
  IMAGE_BLOCK_MIN_WIDTH_PERCENT,
  UPLOAD_PLACEHOLDER_PREFIX,
  type ImageEditorComponent,
} from './image-block-shared';
import { ImageBlockView } from './ImageBlockView';

export {
  IMAGE_BLOCK_MAX_WIDTH_PERCENT,
  IMAGE_BLOCK_MIN_WIDTH_PERCENT,
  UPLOAD_PLACEHOLDER_PREFIX,
} from './image-block-shared';
export type { ImageEditorComponent, ImageEditorComponentProps } from './image-block-shared';
export type { ImageUploadContext } from './image-block-upload';


/**
 * Single width boundary for the resize handle and the setImageBlockWidth
 * command: finite percents clamp into range, non-finite input is rejected
 * (null) so NaN/Infinity can never persist into attrs.
 */
export function clampImageBlockWidthPercent(width: number): number | null {
  if (!Number.isFinite(width)) return null;
  return Math.min(
    IMAGE_BLOCK_MAX_WIDTH_PERCENT,
    Math.max(IMAGE_BLOCK_MIN_WIDTH_PERCENT, width),
  );
}

export interface ImageBlockOptions extends ImageUploadOptions, ImageCleanupOptions {
  HTMLAttributes: Record<string, any>;
  /** Optional image editor component. When provided, an edit button appears on the image toolbar. */
  imageEditor?: ImageEditorComponent;
}

/**
 * Inserts a block image at `pos`. An empty paragraph is replaced rather than
 * left behind, and a caret in it moves below the image so writing continues
 * there, on a new line when the image would otherwise end its parent.
 */
function insertImageNode(view: EditorView, pos: number, node: ProseMirrorNode) {
  const { doc, schema, selection, tr } = view.state;
  const $pos = doc.resolve(pos);
  const caretInEmptyBlock = selection.empty && selection.from === pos && $pos.parent.content.size === 0;

  tr.replaceRangeWith(pos, pos, node);
  if (caretInEmptyBlock) {
    const after = tr.mapping.map(pos);
    if (!tr.doc.resolve(after).nodeAfter && schema.nodes.paragraph) {
      tr.insert(after, schema.nodes.paragraph.create());
    }
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  }
  view.dispatch(tr);
}

/** Shared upload helpers — used by both addCommands and addProseMirrorPlugins. */
function createImageUploadHelpers(options: ImageBlockOptions, editor: Editor) {

  /**
   * Single-walk placeholder lookup. Upload completion and upload failure both
   * need the transient placeholder's position; the walk early-exits at the
   * first match so at most one pass ever runs per call site.
   */
  const findPlaceholderPos = (state: { doc: { descendants: (fn: (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => void | false) => void } }, placeholderSrc: string): number => {
    let placeholderPos = -1;
    state.doc.descendants((node, nodePos) => {
      if (
        placeholderPos === -1 &&
        node.type.name === 'imageBlock' &&
        node.attrs.src === placeholderSrc
      ) {
        placeholderPos = nodePos;
        return false;
      }
    });
    return placeholderPos;
  };
  /** Resolves to the position right after the image, or null when none was inserted. */
  const processImageFile = async (file: File, view: EditorView, pos: number): Promise<number | null> => {
    const validationError = await getImageValidationError(file, options);
    if (validationError) {
      reportImageUploadError(options, validationError, 'imageBlock.validation');
      return null;
    }
    if (editor.isDestroyed) return null;

    const placeholderSrc = `${UPLOAD_PLACEHOLDER_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const { schema } = view.state;
      const placeholderNode = schema.nodes.imageBlock.create({
        src: placeholderSrc,
        alt: file.name,
      });
      const clampedPos = Math.max(0, Math.min(pos, view.state.doc.content.size));
      insertImageNode(view, clampedPos, placeholderNode);

      const attrs = await uploadImageFile(file, options, { blockId: placeholderSrc }, file.name);

      if (editor.isDestroyed) {
        if (attrs.src) queueImageCleanup(editor, attrs.src);
        return null;
      }
      const placeholderPos = findPlaceholderPos(view.state, placeholderSrc);

      if (placeholderPos === -1) {
        if (attrs.src) queueImageCleanup(editor, attrs.src);
        return null;
      }

      const finalNode = schema.nodes.imageBlock.create(attrs);
      const tr = view.state.tr.replaceWith(placeholderPos, placeholderPos + 1, finalNode);
      view.dispatch(tr);
      return placeholderPos + finalNode.nodeSize;
    } catch (error) {
      const placeholderPos = findPlaceholderPos(view.state, placeholderSrc);
      if (placeholderPos !== -1) {
        view.dispatch(view.state.tr.delete(placeholderPos, placeholderPos + 1));
      }
      reportImageUploadError(options, error, 'imageBlock.upload');
      return null;
    }
  };

  const processImageFiles = async (files: File[], view: EditorView, startPos: number) => {
    let pos = startPos;
    for (const file of files) {
      const next = await processImageFile(file, view, pos);
      if (next !== null) {
        pos = next;
      }
    }
  };

  return { processImageFile, processImageFiles };
}

const imageBlockPluginKey = new PluginKey('imageBlockUpload');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: { src: string; alt?: string; title?: string }) => ReturnType;
      setImageBlockAlign: (align: 'left' | 'center' | 'right') => ReturnType;
      setImageBlockWidth: (width: number) => ReturnType;
      uploadImageBlock: (files: File[], pos?: number) => ReturnType;
    };
  }
}

export const ImageBlock = Node.create<ImageBlockOptions>({
  name: 'imageBlock',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onUpload: undefined,
      resolveFileUrl: undefined,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      onUploadError: undefined,
      onError: undefined,
      imageEditor: undefined,
      cleanup: 'immediate',
      onDelete: undefined,
    };
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

  renderHTML({ HTMLAttributes }) {
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
      ['figcaption', {}, caption || ''],
    ];
  },

  addCommands() {
    return {
      setImageBlock:
        (attributes) =>
          ({ commands }) => {
            // Never let a javascript:/data:text/html src bypass parseHTML checks
            // via direct command insertion.
            if (typeof attributes?.src === 'string' && !isSafeUrl(attributes.src)) {
              return false;
            }
            return commands.insertContent({
              type: 'imageBlock',
              attrs: attributes,
            });
          },
      setImageBlockAlign:
        (align) =>
          ({ commands }) => {
            return commands.updateAttributes('imageBlock', { align });
          },
      setImageBlockWidth:
        (width) =>
          ({ commands }) => {
            const clamped = clampImageBlockWidthPercent(width);
            if (clamped === null) return false;
            return commands.updateAttributes('imageBlock', { width: `${clamped}%` });
          },
      uploadImageBlock:
        (files, pos) =>
          ({ editor }) => {
            const { processImageFiles } = createImageUploadHelpers(this.options, this.editor);
            const startPos = pos ?? editor.state.selection.from;
            // Defer placeholder insertion until after Tiptap finishes the command transaction.
            queueMicrotask(() => {
              if (editor.isDestroyed) {
                return;
              }

              void processImageFiles(files, editor.view, startPos);
            });
            return true;
          },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addProseMirrorPlugins() {
    const { processImageFiles } = createImageUploadHelpers(this.options, this.editor);
    const cleanupPlugin = createImageCleanupPlugin(this.editor, this.options);

    // Helper to extract image files from data transfer
    const getImageFilesFromDataTransfer = (dataTransfer: DataTransfer): File[] => {
      const files: File[] = [];

      if (dataTransfer.files) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
          const file = dataTransfer.files[i];
          if (file.type.startsWith('image/')) {
            files.push(file);
          }
        }
      }

      return files;
    };

    return [
      ...(cleanupPlugin ? [cleanupPlugin] : []),
      new Plugin({
        key: imageBlockPluginKey,
        props: {
          handleDrop: (view, event, _slice, moved) => {
            // Don't handle if this is just moving existing content
            if (moved) {
              return false;
            }

            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) {
              return false;
            }

            const imageFiles = getImageFilesFromDataTransfer(dataTransfer);
            if (imageFiles.length === 0) {
              return false;
            }

            event.preventDefault();

            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!coordinates) {
              return false;
            }

            processImageFiles(imageFiles, view, coordinates.pos);
            return true;
          },

          handlePaste: (view, event, _slice) => {
            const dataTransfer = event.clipboardData;
            if (!dataTransfer) {
              return false;
            }

            const imageFiles = getImageFilesFromDataTransfer(dataTransfer);
            if (imageFiles.length === 0) {
              return false;
            }

            event.preventDefault();

            // Get current selection position
            const { from } = view.state.selection;

            // Process image files sequentially
            processImageFiles(imageFiles, view, from);

            return true;
          },
        },
      }),
    ];
  },
});
