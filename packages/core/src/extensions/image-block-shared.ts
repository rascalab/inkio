import type React from 'react';
import type { InkioLocaleInput } from '../i18n/messages';

export const IMAGE_BLOCK_MIN_WIDTH_PERCENT = 10;
export const IMAGE_BLOCK_MAX_WIDTH_PERCENT = 100;

/**
 * Prefix marking a transient upload-placeholder `src`. This is a sentinel
 * string, not a real URL — the view layer must render it as a loading state
 * instead of an `<img src>` (which would trigger a relative-path fetch).
 */
export const UPLOAD_PLACEHOLDER_PREFIX = '__inkio_upload_';

export interface ImageEditorComponentProps {
  isOpen: boolean;
  imageSrc: string;
  onSave: (editedImageData: string) => void;
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
