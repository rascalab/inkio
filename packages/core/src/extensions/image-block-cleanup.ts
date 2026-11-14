import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { toError, type InkioErrorHandler } from '../errors';
import { isSafeUrl } from '../utils/url-safety';
import { UPLOAD_PLACEHOLDER_PREFIX } from './image-block-shared';

export interface ImageCleanupOptions {
  /** `immediate` (default) cleans unused files; `manual` leaves cleanup to the app. */
  cleanup?: 'immediate' | 'manual';
  /** Storage adapter called with an unused image URL. */
  onDelete?: (src: string) => void | Promise<void>;
  onError?: InkioErrorHandler;
}

const cleanupQueues = new WeakMap<Editor, (src: string) => void>();
const imageCleanupPluginKey = new PluginKey('imageBlockCleanup');

function canDelete(src: string): boolean {
  return !src.startsWith(UPLOAD_PLACEHOLDER_PREFIX) && !/^data:/i.test(src) && isSafeUrl(src);
}

function imageSources(doc: ProseMirrorNode, from = 0, to = doc.content.size): Set<string> {
  const sources = new Set<string>();
  doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'imageBlock' && typeof node.attrs.src === 'string' && canDelete(node.attrs.src)) {
      sources.add(node.attrs.src);
    }
  });
  return sources;
}

/** Also handles successful uploads whose target disappeared before completion. */
export function queueImageCleanup(editor: Editor, src: string): void {
  cleanupQueues.get(editor)?.(src);
}

export function createImageCleanupPlugin(editor: Editor, options: ImageCleanupOptions): Plugin | null {
  const deleteImage = options.onDelete;
  if (!deleteImage || options.cleanup === 'manual') return null;
  const pending = new Set<string>();

  return new Plugin({
    key: imageCleanupPluginKey,
    view(view) {
      let doc = view.state.doc;
      const queue = (src: string) => {
        if (!canDelete(src) || pending.has(src)) return;
        pending.add(src);
        void Promise.resolve().then(async () => {
          try {
            // Read the latest committed document, not the snapshot that removed it.
            if (imageSources(view.state.doc).has(src)) return;
            await deleteImage(src);
          } catch (error) {
            options.onError?.(toError(error), { source: 'imageBlock.cleanup', recoverable: true });
          } finally {
            pending.delete(src);
          }
        });
      };
      cleanupQueues.set(editor, queue);

      const onTransaction = ({ transaction }: { transaction: Transaction }) => {
        const previousDoc = doc;
        doc = view.state.doc;
        // setContent/clearContent replace a loaded document; they are not image deletions.
        if (!editor.isEditable || transaction.getMeta('preventUpdate') !== undefined) return;
        const from = previousDoc.content.findDiffStart(doc.content);
        if (from === null || from >= previousDoc.content.size) return;
        const end = previousDoc.content.findDiffEnd(doc.content);
        const to = Math.min(previousDoc.content.size, Math.max(from + 1, end?.a ?? from + 1));
        const candidates = imageSources(previousDoc, from, to);
        if (!candidates.size) return;
        const referenced = imageSources(doc);
        for (const src of candidates) {
          if (!referenced.has(src)) queue(src);
        }
      };
      editor.on('transaction', onTransaction);
      return {
        destroy() {
          editor.off('transaction', onTransaction);
          // Keep the weakly held queue for uploads that finish after editor destruction.
        },
      };
    },
  });
}
