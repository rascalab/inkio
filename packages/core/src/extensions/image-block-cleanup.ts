import type { Editor } from '@tiptap/core';
import { toError, type InkioErrorHandler } from '../errors';
import { isSafeUrl } from '../utils/url-safety';
import { UPLOAD_PLACEHOLDER_PREFIX } from './image-block-shared';

export interface ImageCleanupOptions {
  /** `manual` (default) leaves cleanup to the app; `immediate` discards only abandoned uploads. */
  cleanup?: 'immediate' | 'manual';
  /** Called with the resolved URL of a successful upload that never entered the document.
   * Enable only when each upload returns a new, exclusively owned URL. */
  onDelete?: (src: string) => void | Promise<void>;
  onError?: InkioErrorHandler;
}

/** Only call for a successful upload that was never committed to a node. */
export async function discardAbandonedImageUpload(
  editor: Editor,
  options: ImageCleanupOptions,
  src: string,
): Promise<void> {
  if (options.cleanup !== 'immediate' || !options.onDelete ||
      src.startsWith(UPLOAD_PLACEHOLDER_PREFIX) || /^data:/i.test(src) || !isSafeUrl(src)) return;

  let referenced = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'imageBlock' && node.attrs.src === src) referenced = true;
    if (referenced) return false;
  });
  if (referenced) return;

  try {
    await options.onDelete(src);
  } catch (error) {
    options.onError?.(toError(error), { source: 'imageBlock.cleanup', recoverable: true });
  }
}
