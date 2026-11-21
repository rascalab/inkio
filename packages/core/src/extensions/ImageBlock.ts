import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { closeHistory } from '@tiptap/pm/history';
import type { Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, Selection, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { editorMessages } from '../i18n/messages';
import { createId } from '../utils/create-id';
import { isSafeUrl } from '../utils/url-safety';
import {
  reportImageUploadError,
  uploadImageFile,
  getImageValidationError,
  type ImageUploadOptions,
} from './image-block-upload';
import { discardAbandonedImageUpload, type ImageCleanupOptions } from './image-block-cleanup';
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

const imageBlockPluginKey = new PluginKey<DecorationSet>('imageBlockUpload');

type UploadMarker = {
  id: string;
  placement?: { pos: number; stepIndex: number; label: string };
};

function setUploadMarker(tr: Transaction, marker: UploadMarker) {
  const markers: UploadMarker[] = tr.getMeta(imageBlockPluginKey) ?? [];
  return tr.setMeta(imageBlockPluginKey, [...markers, marker]);
}

function findUploadMarker(view: EditorView, id: string) {
  return imageBlockPluginKey.getState(view.state)?.find(undefined, undefined, (spec) => spec.key === id)[0];
}

/**
 * Keep the upload preview out of the document and its undo history. The
 * decoration maps through intervening edits until a real image can be inserted.
 * https://prosemirror.net/examples/upload/
 */
function mapUploadMarkers(tr: Transaction, markers: DecorationSet): DecorationSet {
  let next = tr.getMeta('preventUpdate') !== undefined
    ? DecorationSet.empty
    : markers.map(tr.mapping, tr.doc);
  const updates: UploadMarker[] | undefined = tr.getMeta(imageBlockPluginKey);
  if (!updates) return next;
  for (const { id, placement } of updates) {
    next = next.remove(next.find(undefined, undefined, (spec) => spec.key === id));
    if (!placement) continue;
    const mapped = tr.mapping.slice(placement.stepIndex).mapResult(placement.pos, 1);
    if (mapped.deleted) continue;
    next = next.add(tr.doc, [Decoration.widget(mapped.pos, (view) => {
      const placeholder = view.dom.ownerDocument.createElement('span');
      placeholder.className = 'inkio-image-block-placeholder';
      placeholder.setAttribute('role', 'status');
      placeholder.textContent = placement.label;
      return placeholder;
    }, { key: id, side: 1 })]);
  }
  return next;
}

/**
 * Replace an empty paragraph when possible. Only move the caret when it was
 * still in that paragraph, leaving the user's selection elsewhere alone.
 */
function insertImageNode(view: EditorView, pos: number, node: ProseMirrorNode) {
  const { doc, schema, selection, tr } = view.state;
  const $pos = doc.resolve(pos);
  const moveCaret = selection.empty && selection.from === pos && $pos.parent.isTextblock && !$pos.parent.content.size;

  closeHistory(tr).replaceRangeWith(pos, pos, node);
  let after: number | undefined;
  tr.mapping.maps[0]?.forEach((_oldFrom, _oldTo, from, to) => {
    tr.doc.nodesBetween(from, to, (child, childPos) => {
      if (child === node) after = childPos + child.nodeSize;
      if (after !== undefined) return false;
    });
  });
  if (after === undefined) return null;

  if (moveCaret) {
    const $after = tr.doc.resolve(after);
    const paragraph = schema.nodes.paragraph;
    if (!$after.nodeAfter?.isTextblock && paragraph &&
        $after.parent.canReplaceWith($after.index(), $after.index(), paragraph)) {
      tr.insert(after, paragraph.create());
    }
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  }
  return { tr, after, moveCaret };
}

function chooserLeftFocusUnclaimed(view: EditorView): boolean {
  const document = view.dom.ownerDocument;
  return view.dom.isConnected && document.activeElement === document.body;
}

function queueImageFiles(
  editor: Editor,
  options: ImageBlockOptions,
  tr: Transaction,
  files: File[],
  pos: number,
  restoreFocus = false,
) {
  const id = `${UPLOAD_PLACEHOLDER_PREFIX}${createId('image')}`;
  const label = editorMessages(editor).imageBlock.uploading;
  const clamped = Number.isFinite(pos) ? Math.max(0, Math.min(Math.trunc(pos), tr.doc.content.size)) : tr.selection.from;
  setUploadMarker(tr, { id, placement: { pos: clamped, stepIndex: tr.mapping.maps.length, label } });

  // Tiptap has to dispatch the outer command transaction (if any) first.
  queueMicrotask(async () => {
    if (editor.isDestroyed) return;
    const { view } = editor;
    try {
      const initialMarker = findUploadMarker(view, id);
      if (!initialMarker) return;
      // A file chooser can leave Firefox without focus. Reclaim it only if
      // there is still a caret at the upload and no other control took focus.
      if (restoreFocus && chooserLeftFocusUnclaimed(view) &&
          view.state.selection.empty && view.state.selection.from === initialMarker.from) {
        view.focus();
      }

      for (const [index, file] of files.entries()) {
        if (editor.isDestroyed || !editor.isEditable || !findUploadMarker(view, id)) return;
        const validationError = await getImageValidationError(file, options);
        if (validationError) {
          reportImageUploadError(options, validationError, 'imageBlock.validation');
          continue;
        }
        if (editor.isDestroyed || !editor.isEditable || !findUploadMarker(view, id)) return;

        let attrs;
        try {
          attrs = await uploadImageFile(file, options, { blockId: `${id}-${index}` }, file.name);
        } catch (error) {
          reportImageUploadError(options, error, 'imageBlock.upload');
          continue;
        }

        const marker = !editor.isDestroyed && editor.isEditable ? findUploadMarker(view, id) : undefined;
        const insertion = marker
          ? insertImageNode(view, marker.from, view.state.schema.nodes.imageBlock.create(attrs))
          : null;
        if (!insertion) {
          if (options.onUpload && attrs.src) await discardAbandonedImageUpload(editor, options, attrs.src);
          return;
        }

        const { tr: insert, after, moveCaret } = insertion;
        setUploadMarker(insert, index + 1 < files.length
          ? { id, placement: { pos: after, stepIndex: insert.mapping.maps.length, label } }
          : { id });
        const syncCaret = moveCaret && (view.hasFocus() || (restoreFocus && chooserLeftFocusUnclaimed(view)));
        view.dispatch(insert);
        // Synchronize the browser selection in this tick, before the next key.
        if (syncCaret && !editor.isDestroyed && (view.hasFocus() || chooserLeftFocusUnclaimed(view))) view.focus();
      }
    } catch (error) {
      reportImageUploadError(options, error, 'imageBlock.upload');
    } finally {
      if (!editor.isDestroyed && findUploadMarker(view, id)) {
        view.dispatch(setUploadMarker(view.state.tr, { id }));
      }
    }
  });
}

function hasMeaningfulHtml(slice: Slice): boolean {
  let meaningful = false;
  slice.content.descendants((node) => {
    if (meaningful) return false;
    if (node.isText) meaningful = Boolean(node.text?.trim());
    else if (node.type.name === 'imageBlock') {
      const { src, caption } = node.attrs;
      // Clipboard screenshots can have a temporary HTML URL as well as a real file.
      meaningful = (typeof caption === 'string' && Boolean(caption.trim())) ||
        (typeof src === 'string' && !/^(?:data|blob):/i.test(src.trim()) &&
          !src.startsWith(UPLOAD_PLACEHOLDER_PREFIX) && isSafeUrl(src));
    } else {
      meaningful = (node.isAtom && node.type.name !== 'hardBreak') || node.type.spec.tableRole === 'table';
    }
  });
  return meaningful;
}

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
      cleanup: 'manual',
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
          ({ editor, tr, dispatch }) => {
            if (!files.length) return false;
            if (dispatch) queueImageFiles(editor, this.options, tr, files, pos ?? tr.selection.from, true);
            return true;
          },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;

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
      // Some clipboard implementations expose image files in items only.
      if (!files.length && dataTransfer.items) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
          const item = dataTransfer.items[i];
          if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      return files;
    };

    return [
      // Upload previews neither persist nor appear in undo/redo.
      new Plugin({
        key: imageBlockPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: mapUploadMarkers,
        },
        props: {
          decorations: (state) => imageBlockPluginKey.getState(state),
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

            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!coordinates) {
              return false;
            }

            const tr = view.state.tr;
            queueImageFiles(editor, options, tr, imageFiles, coordinates.pos);
            view.dispatch(tr);
            event.preventDefault();
            return true;
          },

          handlePaste: (view, event, slice) => {
            const dataTransfer = event.clipboardData;
            if (!dataTransfer) {
              return false;
            }

            const imageFiles = getImageFilesFromDataTransfer(dataTransfer);
            if (imageFiles.length === 0) {
              return false;
            }

            // Prefer meaningful rich HTML to its attached image representation.
            // Image-only pastes whose HTML could not be parsed still use the file.
            if (dataTransfer.getData('text/html') && hasMeaningfulHtml(slice)) return false;

            const tr = view.state.tr;
            queueImageFiles(editor, options, tr, imageFiles, tr.selection.from);
            view.dispatch(tr);
            event.preventDefault();

            return true;
          },
        },
      }),
    ];
  },
});
