import type React from 'react';
import type { InkioLocaleInput } from '../i18n/messages';

export const IMAGE_BLOCK_MIN_WIDTH_PERCENT = 10;
export const IMAGE_BLOCK_MAX_WIDTH_PERCENT = 100;

/**
 * Prefix for transient upload IDs. Older documents may contain this marker
 * in an image `src`; render it as a loading state, not a relative URL.
 */
export const UPLOAD_PLACEHOLDER_PREFIX = '__inkio_upload_';

export interface ImageEditorComponentProps {
  isOpen: boolean;
  imageSrc: string;
  /** Reject to keep the image editor open when persistence fails. Editors may cancel their save. */
  onSave: (editedImageData: string, signal?: AbortSignal) => void | Promise<void>;
  /** Editors may pass encoded bytes instead. A preview is optional and is not uploaded. */
  onSaveBlob?: (blob: Blob, preview?: Blob, signal?: AbortSignal) => void | Promise<void>;
  onClose: () => void;
  /** Resolved theme of the editor that opened it (`theme` prop or a `.dark` ancestor). */
  theme?: 'light' | 'dark';
  /** `locale` of the editor that opened it. */
  locale?: InkioLocaleInput;
}

/**
 * A component that can take those props. Not `ComponentType`: its `defaultProps`
 * would also require the component's props to fit these, which turns away one
 * like `ImageEditorModal` whose `locale` accepts more than an editor passes.
 */
export type ImageEditorComponent =
  | ((props: ImageEditorComponentProps) => ReturnType<React.FunctionComponent>)
  | (new (props: ImageEditorComponentProps) => React.Component);
