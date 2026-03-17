import type { ImageEditorLocale, ToolType } from './types';
import { COLOR_PRESETS } from './color-presets';

export const DEFAULT_LOCALE: ImageEditorLocale = {
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
};

export const DEFAULT_TOOLS: ToolType[] = ['resize', 'draw', 'shape', 'text', 'rotate'];

export const ASPECT_RATIO_PRESETS = [
  { labelKey: 'freeform' as const, value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
];

export const MAX_UNDO_STEPS = 30;

export const DEFAULT_DRAW_OPTIONS = {
  color: COLOR_PRESETS[0],
  strokeWidth: 4,
  opacity: 1,
};

export const DEFAULT_SHAPE_OPTIONS = {
  shapeType: 'rect' as const,
  fill: 'transparent',
  stroke: COLOR_PRESETS[0],
  strokeWidth: 2,
};

export const DEFAULT_TEXT_OPTIONS = {
  width: 240,
  height: 96,
  fontSize: 32,
  fontFamily: 'system-ui',
  color: COLOR_PRESETS[0],
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
