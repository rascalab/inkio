import type { EditorProps } from './Editor';
import type { ImageBlockOptions } from '../extensions/ImageBlock';
import type { InkioMessageOverrides } from '../i18n/messages';
import type { InkioErrorHandler } from '../errors';

type Menu = 'toolbar' | 'bubbleMenu' | 'floatingMenu' | 'tableMenu';

/** Preset menus inherit their visibility unless explicitly enabled or disabled. */
export type InkioEditorUiOptions = Pick<EditorProps,
  'className' | 'style' | 'fill' | 'autoresize' | 'bordered' | 'icons'
> & { messages?: InkioMessageOverrides } & { [K in Menu]?: boolean | EditorProps[K] };

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
): Pick<EditorProps, keyof InkioEditorUiOptions | keyof InkioEditorUiDefaults> {
  return {
    messages: ui?.messages,
    icons: ui?.icons,
    className: ui?.className,
    style: ui?.style,
    fill: ui?.fill,
    autoresize: ui?.autoresize,
    bordered: ui?.bordered,
    showToolbar: ui?.toolbar === undefined ? defaults.showToolbar : ui.toolbar !== false,
    showBubbleMenu: ui?.bubbleMenu === undefined ? defaults.showBubbleMenu : ui.bubbleMenu !== false,
    showFloatingMenu: ui?.floatingMenu === undefined ? defaults.showFloatingMenu : ui.floatingMenu !== false,
    showTableMenu: ui?.tableMenu === undefined ? defaults.showTableMenu : ui.tableMenu !== false,
    toolbar: typeof ui?.toolbar === 'object' ? ui.toolbar : undefined,
    bubbleMenu: typeof ui?.bubbleMenu === 'object' ? ui.bubbleMenu : undefined,
    floatingMenu: typeof ui?.floatingMenu === 'object' ? ui.floatingMenu : undefined,
    tableMenu: typeof ui?.tableMenu === 'object' ? ui.tableMenu : undefined,
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
