import React from 'react';
import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { toError, type InkioErrorHandler } from '../../utils';
import { ImageBlockView } from './ImageBlockView';

type ImageUploadResult = string | Record<string, any>;
type ImageAlign = 'left' | 'center' | 'right';
type ImageNodeAttributes = {
  src: string;
  alt?: string;
  title?: string;
  width?: string | number;
  align?: ImageAlign;
  caption?: string;
};

const KNOWN_IMAGE_ATTR_KEYS = ['src', 'alt', 'title', 'width', 'align', 'caption'] as const;

function toImageNodeAttributes(result: ImageUploadResult, fallbackAlt?: string): Partial<ImageNodeAttributes> {
  if (typeof result === 'string') {
    return {
      src: result,
      alt: fallbackAlt,
    };
  }

  const attrs: Partial<ImageNodeAttributes> = {};
  for (const key of KNOWN_IMAGE_ATTR_KEYS) {
    if (!(key in result)) {
      continue;
    }

    const value = result[key];
    if (key === 'src' && typeof value === 'string') {
      attrs.src = value;
      continue;
    }
    if (key === 'alt' && typeof value === 'string') {
      attrs.alt = value;
      continue;
    }
    if (key === 'title' && typeof value === 'string') {
      attrs.title = value;
      continue;
    }
    if (key === 'width' && (typeof value === 'string' || typeof value === 'number')) {
      attrs.width = value;
      continue;
    }
    if (key === 'align' && (value === 'left' || value === 'center' || value === 'right')) {
      attrs.align = value;
      continue;
    }
    if (key === 'caption' && typeof value === 'string') {
      attrs.caption = value;
    }
  }

  if (!attrs.alt && fallbackAlt) {
    attrs.alt = fallbackAlt;
  }

  return attrs;
}

export interface ImageEditorComponentProps {
  isOpen: boolean;
  imageSrc: string;
  onSave: (editedImageData: string) => void;
  onClose: () => void;
}

export interface ImageBlockOptions {
  HTMLAttributes: Record<string, any>;
  /** Callback to handle file upload, should return the URL of the uploaded image */
  onUpload?: (file: File) => Promise<ImageUploadResult>;
  /** Optional callback to resolve a persisted URL into a public URL */
  resolveFileUrl?: (url: string) => Promise<string>;
  /** Allowed MIME types for image upload */
  allowedMimeTypes?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Callback for upload errors */
  onUploadError?: (error: Error) => void;
  /** Generic extension-level error callback */
  onError?: InkioErrorHandler;
  /** Optional image editor component. When provided, an edit button appears on the image toolbar. */
  imageEditor?: React.ComponentType<ImageEditorComponentProps>;
}

/** Shared upload helpers — used by both addCommands and addProseMirrorPlugins. */
function createImageUploadHelpers(options: ImageBlockOptions) {
  const { onUpload, resolveFileUrl, allowedMimeTypes, maxFileSize, onUploadError, onError } = options;

  const reportUploadError = (error: unknown, source: string, recoverable = true) => {
    const normalizedError = toError(error);
    if (onUploadError) {
      onUploadError(normalizedError);
      return;
    }
    onError?.(normalizedError, { source, recoverable });
  };

  const processImageFile = async (file: File, view: EditorView, pos: number) => {
    if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
      reportUploadError(new Error(`File type ${file.type} is not allowed.`), 'imageBlock.validation');
      return false;
    }
    if (maxFileSize && file.size > maxFileSize) {
      reportUploadError(new Error(`File size exceeds maximum allowed size.`), 'imageBlock.validation');
      return false;
    }

    const placeholderSrc = `__inkio_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const { schema } = view.state;
      const placeholderNode = schema.nodes.imageBlock.create({
        src: placeholderSrc,
        alt: file.name,
      });
      const clampedPos = Math.min(pos, view.state.doc.content.size);
      view.dispatch(view.state.tr.insert(clampedPos, placeholderNode));

      let attrs: Partial<ImageNodeAttributes>;
      if (onUpload) {
        const uploadResult = await onUpload(file);
        attrs = toImageNodeAttributes(uploadResult, file.name);
      } else {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        attrs = { src, alt: file.name };
      }
      if (!attrs.src || typeof attrs.src !== 'string') throw new Error('Invalid upload result.');
      if (resolveFileUrl) attrs.src = await resolveFileUrl(attrs.src);

      let placeholderPos = -1;
      view.state.doc.descendants((node, nodePos) => {
        if (
          placeholderPos === -1 &&
          node.type.name === 'imageBlock' &&
          node.attrs.src === placeholderSrc
        ) {
          placeholderPos = nodePos;
          return false;
        }
      });

      if (placeholderPos === -1) {
        return false;
      }

      const finalNode = schema.nodes.imageBlock.create(attrs);
      const tr = view.state.tr.replaceWith(placeholderPos, placeholderPos + 1, finalNode);
      view.dispatch(tr);
      return true;
    } catch (error) {
      let placeholderPos = -1;
      view.state.doc.descendants((node, nodePos) => {
        if (
          placeholderPos === -1 &&
          node.type.name === 'imageBlock' &&
          node.attrs.src === placeholderSrc
        ) {
          placeholderPos = nodePos;
          return false;
        }
      });
      if (placeholderPos !== -1) {
        view.dispatch(view.state.tr.delete(placeholderPos, placeholderPos + 1));
      }
      reportUploadError(error, 'imageBlock.upload');
      return false;
    }
  };

  const processImageFiles = async (files: File[], view: EditorView, startPos: number) => {
    let offset = 0;
    for (const file of files) {
      const sizeBefore = view.state.doc.content.size;
      const result = await processImageFile(file, view, startPos + offset);
      if (result) {
        const sizeAfter = view.state.doc.content.size;
        offset += sizeAfter - sizeBefore;
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
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('src');
          if (!raw) return null;
          if (/^(javascript|vbscript):/i.test(raw.trim())) return null;
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
          const figcaption = dom.querySelector('figcaption');
          return {
            src: img.getAttribute('src'),
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
          const figcaption = dom.querySelector('figcaption');
          return {
            src: img.getAttribute('src'),
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
    return [
      'figure',
      { 'data-type': 'imageBlock', 'data-align': align, ...rest },
      ['img', { src, alt, title, width }],
      ['figcaption', {}, caption || ''],
    ];
  },

  addCommands() {
    return {
      setImageBlock:
        (attributes) =>
          ({ commands }) => {
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
            return commands.updateAttributes('imageBlock', { width: `${width}%` });
          },
      uploadImageBlock:
        (files, pos) =>
          ({ editor }) => {
            const { processImageFiles } = createImageUploadHelpers(this.options);
            const startPos = pos ?? editor.state.selection.from;
            processImageFiles(files, editor.view, startPos);
            return true;
          },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addProseMirrorPlugins() {
    const { processImageFiles } = createImageUploadHelpers(this.options);

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
