import { pickMessageLocale, type DeepPartial, type InkioCoreMessageOverrides, type InkioMessageOverrides } from '@inkio/editor';
import type { ImageEditorLocale } from '../extensions/ImageEditor/editor/types';

export interface InkioExtensionsMessages {
  commentPanel: {
    title: string;
    all: string;
    open: string;
    resolved: string;
    emptyNoComments: string;
    emptyNoMatch: string;
    noMessages: string;
    replyPlaceholder: string;
    resolve: string;
    delete: string;
    quoteHint: string;
    you: string;
    time: {
      justNow: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
    };
  };
  commentComposer: {
    placeholder: string;
    cancel: string;
    submit: string;
  };
  imageEditor: ImageEditorLocale;
}

export type InkioExtensionsMessageOverrides = DeepPartial<InkioExtensionsMessages>;

export const enExtensionsMessages: InkioExtensionsMessages = {
  commentPanel: {
    title: 'Comments',
    all: 'All',
    open: 'Open',
    resolved: 'Resolved',
    emptyNoComments: 'No comments yet. Select text and use the comment action to add one.',
    emptyNoMatch: 'No matching comments.',
    noMessages: 'No messages yet.',
    replyPlaceholder: 'Reply…',
    resolve: 'Resolve',
    delete: 'Delete',
    quoteHint: 'Select a thread to jump to the highlighted text.',
    you: 'You',
    time: {
      justNow: 'just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
    },
  },
  commentComposer: {
    placeholder: 'Add a comment…',
    cancel: 'Cancel',
    submit: 'Comment',
  },
  imageEditor: {
    crop: 'Crop',
    rotate: 'Rotate',
    resize: 'Resize',
    draw: 'Draw',
    shapes: 'Shapes',
    text: 'Text',
    save: 'Save',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    undo: 'Undo',
    redo: 'Redo',
    flip: 'Flip',
    flipH: 'Flip horizontal',
    flipV: 'Flip vertical',
    rotateCW: 'Rotate clockwise',
    rotateCCW: 'Rotate counterclockwise',
    freeform: 'Freeform',
    square: 'Square',
    landscape: 'Landscape',
    portrait: 'Portrait',
    brushSize: 'Brush size',
    color: 'Color',
    fontSize: 'Font size',
    bold: 'Bold',
    italic: 'Italic',
    width: 'Width',
    height: 'Height',
    lockAspectRatio: 'Lock aspect ratio',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    arrow: 'Arrow',
    line: 'Line',
    fill: 'Fill',
    stroke: 'Stroke',
    opacity: 'Opacity',
    loading: 'Loading...',
    error: 'Something went wrong.',
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return base;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    const existing = result[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value as DeepPartial<typeof existing>);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

function fromRootMessageOverrides(input?: InkioMessageOverrides): InkioExtensionsMessageOverrides | undefined {
  if (!input?.extensions || typeof input.extensions !== 'object') {
    return undefined;
  }

  return input.extensions as InkioExtensionsMessageOverrides;
}

export function toExtensionsMessageOverrides(
  input?: InkioExtensionsMessageOverrides | InkioMessageOverrides,
): InkioExtensionsMessageOverrides | undefined {
  if (!input) {
    return undefined;
  }

  if ('core' in input || 'extensions' in input) {
    return fromRootMessageOverrides(input as InkioMessageOverrides);
  }

  return input as InkioExtensionsMessageOverrides;
}

const EXTENSION_MESSAGESETS = {
  en: enExtensionsMessages,
} as const satisfies Record<string, InkioExtensionsMessages>;

/** Locale IDs that ship with @inkio/extension. */
export type InkioExtensionsLocaleId = keyof typeof EXTENSION_MESSAGESETS;

/**
 * Fully typed message overrides combining core and extensions keys.
 */
export interface InkioTypedMessageOverrides {
  core?: InkioCoreMessageOverrides;
  extensions?: InkioExtensionsMessageOverrides;
}

export function resolveExtensionsMessages(
  localeInput: unknown,
  overrides?: InkioExtensionsMessageOverrides,
): InkioExtensionsMessages {
  const locale = pickMessageLocale(localeInput, Object.keys(EXTENSION_MESSAGESETS));
  return deepMerge((EXTENSION_MESSAGESETS as Record<string, InkioExtensionsMessages>)[locale] ?? enExtensionsMessages, overrides);
}

export function mergeExtensionsMessages(
  localeInput: unknown,
  ...overrides: Array<InkioExtensionsMessageOverrides | undefined>
): InkioExtensionsMessages {
  return overrides.reduce<InkioExtensionsMessages>(
    (acc, current) => deepMerge(acc, current),
    resolveExtensionsMessages(localeInput),
  );
}

export function formatRelativeTime(template: string, count: number): string {
  return template.replace('{count}', String(count));
}
