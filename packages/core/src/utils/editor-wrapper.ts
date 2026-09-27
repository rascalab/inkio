import type { EditorProps } from '../components/Editor';
import type { ImageBlockOptions } from '../extensions/ImageBlock';
import type { InkioErrorHandler } from '../errors';

/**
 * The `ui` prop shape shared by the `@inkio/simple` and `@inkio/editor`
 * wrappers (each narrows it to the fields it exposes).
 */
export type InkioEditorUiOptions = Pick<
  EditorProps,
  | 'className'
  | 'style'
  | 'fill'
  | 'autoresize'
  | 'bordered'
  | 'showToolbar'
  | 'showBubbleMenu'
  | 'showFloatingMenu'
  | 'showTableMenu'
  | 'toolbar'
  | 'bubbleMenu'
  | 'floatingMenu'
  | 'tableMenu'
  | 'messages'
  | 'icons'
>;

export interface InkioEditorUiDefaults {
  showToolbar: boolean;
  showBubbleMenu: boolean;
  showFloatingMenu: boolean;
  showTableMenu: boolean;
}

/** Map a wrapper's `ui` prop onto core `Editor` props, applying per-wrapper visibility defaults. */
export function mapEditorUiToCoreProps(
  ui: InkioEditorUiOptions | undefined,
  defaults: InkioEditorUiDefaults,
): InkioEditorUiOptions {
  return {
    messages: ui?.messages,
    icons: ui?.icons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    autoresize: ui?.autoresize,
    bordered: ui?.bordered,
    showToolbar: ui?.showToolbar ?? defaults.showToolbar,
    showBubbleMenu: ui?.showBubbleMenu ?? defaults.showBubbleMenu,
    showFloatingMenu: ui?.showFloatingMenu ?? defaults.showFloatingMenu,
    showTableMenu: ui?.showTableMenu ?? defaults.showTableMenu,
    toolbar: ui?.toolbar,
    bubbleMenu: ui?.bubbleMenu,
    floatingMenu: ui?.floatingMenu,
    tableMenu: ui?.tableMenu,
  };
}

export type InkioImageUploadHandler = NonNullable<ImageBlockOptions['onUpload']>;

/**
 * Merge a wrapper's `onImageUpload` (and optional `onError`) into its
 * `imageBlock` options. Returns `undefined` when none are set so the
 * extension keeps its defaults.
 */
export function mergeImageBlockOptions<T extends object>(
  imageBlock: T | undefined,
  handlers: { onUpload?: InkioImageUploadHandler; onError?: InkioErrorHandler },
): (T & Pick<Partial<ImageBlockOptions>, 'onUpload' | 'onError'>) | undefined {
  const { onUpload, onError } = handlers;
  if (imageBlock === undefined && onUpload === undefined && onError === undefined) {
    return undefined;
  }
  return {
    ...(imageBlock as T),
    ...(onUpload ? { onUpload } : {}),
    ...(onError ? { onError } : {}),
  };
}
