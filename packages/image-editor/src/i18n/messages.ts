import {
  pickMessageLocale,
  type DeepPartial,
  type InkioMessageOverrides,
} from '@inkio/core';
import type { ImageEditorLocale } from '../types';

export interface InkioImageEditorMessages {
  imageEditor: ImageEditorLocale;
}

export type InkioImageEditorMessageOverrides = DeepPartial<InkioImageEditorMessages>;

export const enImageEditorMessages: InkioImageEditorMessages = {
  imageEditor: {
    crop: 'Crop',
    rotate: 'Rotate',
    resize: 'Resize',
    draw: 'Draw',
    drawDefaults: 'New draw defaults',
    selectedDraw: 'Selected drawing',
    shapes: 'Shapes',
    shapeDefaults: 'New shape defaults',
    selectedShape: 'Selected shape',
    text: 'Text',
    textContent: 'Text content',
    textBoxWidth: 'Text box width',
    textDefaults: 'New text defaults',
    selectedText: 'Selected text',
    layerOrder: 'Layer order',
    bringToFront: 'To front',
    bringForward: 'Forward',
    sendBackward: 'Backward',
    sendToBack: 'To back',
    save: 'Save',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    editCrop: 'Edit crop area',
    doneCropping: 'Done cropping',
    cropArea: 'Crop area',
    cropPendingNotice: 'Save will apply the current crop area.',
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
    customColor: 'Custom color',
    fontFamily: 'Font family',
    fontFamilyPlaceholder: 'Enter a font family',
    fontSize: 'Font size',
    fontSizePercent: 'Font size (%)',
    colorHex: 'Hex color',
    colorAlpha: 'Opacity',
    colorPalette: 'Color palette',
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
    transparent: 'Transparent',
    opacity: 'Opacity',
    zoom: 'Zoom',
    fit: 'Fit',
    closeConfirm: 'Discard your image edits?',
    smallViewportTitle: 'Image editing is unavailable on very small screens.',
    smallViewportBody: 'Use a larger phone, tablet, or desktop window to edit this image.',
    loading: 'Loading...',
    error: 'Something went wrong.',
    deleteLabel: 'Delete',
    zoomInLabel: 'Zoom in',
    zoomOutLabel: 'Zoom out',
    toolsLabel: 'Image editor tools',
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

export function toImageEditorMessageOverrides(
  input?: InkioImageEditorMessageOverrides | InkioMessageOverrides,
): InkioImageEditorMessageOverrides | undefined {
  if (!input) {
    return undefined;
  }

  if ('core' in input || 'extensions' in input) {
    const root = input as InkioMessageOverrides;
    if (!root.extensions || typeof root.extensions !== 'object') {
      return undefined;
    }
    return root.extensions as InkioImageEditorMessageOverrides;
  }

  return input as InkioImageEditorMessageOverrides;
}

const IMAGE_EDITOR_MESSAGESETS = {
  en: enImageEditorMessages,
} as const satisfies Record<string, InkioImageEditorMessages>;

export type InkioImageEditorLocaleId = keyof typeof IMAGE_EDITOR_MESSAGESETS;

export function resolveImageEditorMessages(
  localeInput: unknown,
  overrides?: InkioImageEditorMessageOverrides,
): InkioImageEditorMessages {
  const locale = pickMessageLocale(localeInput, Object.keys(IMAGE_EDITOR_MESSAGESETS));

  return deepMerge(
    (IMAGE_EDITOR_MESSAGESETS as Record<string, InkioImageEditorMessages>)[locale] ?? enImageEditorMessages,
    overrides,
  );
}

export function mergeImageEditorMessages(
  localeInput: unknown,
  ...overrides: Array<InkioImageEditorMessageOverrides | undefined>
): InkioImageEditorMessages {
  return overrides.reduce<InkioImageEditorMessages>(
    (acc, current) => deepMerge(acc, current),
    resolveImageEditorMessages(localeInput),
  );
}
