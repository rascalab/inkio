import type { ImageEditorLocale, ToolType } from './types';

export const DEFAULT_LOCALE: ImageEditorLocale = {
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
};

export const DEFAULT_TOOLS: ToolType[] = ['crop', 'rotate', 'resize', 'draw', 'shape', 'text'];

export const ASPECT_RATIO_PRESETS = [
  { labelKey: 'freeform' as const, value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
];

export const MAX_UNDO_STEPS = 30;

export const DEFAULT_DRAW_OPTIONS = {
  color: '#e53e3e',
  strokeWidth: 4,
  opacity: 1,
};

export const DEFAULT_SHAPE_OPTIONS = {
  shapeType: 'rect' as const,
  fill: 'transparent',
  stroke: '#e53e3e',
  strokeWidth: 2,
};

export const DEFAULT_TEXT_OPTIONS = {
  fontSize: 24,
  color: '#111827',
  fontStyle: 'normal' as const,
};

export const DEFAULT_CROP_OPTIONS = {
  aspectRatio: null,
};

export const DEFAULT_RESIZE_OPTIONS = {
  width: 0,
  height: 0,
  lockAspectRatio: true,
};
