import type { DeepPartial, InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { ReactNode } from 'react';

export type ToolType = 'crop' | 'rotate' | 'resize' | 'draw' | 'shape' | 'text' | 'filter' | 'redact' | 'sticker';
export type EnabledToolType = Exclude<ToolType, 'crop'>;
export type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'line';
export type RedactMode = 'pixelate' | 'blur';

export type FilterPresetId =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'warm'
  | 'cool'
  | 'dramatic'
  | 'soft'
  | 'vintage';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  crop: CropRect | null;
}

export interface OutputSize {
  width: number;
  height: number;
}

export interface DrawOptions {
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface ShapeOptions {
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface TextOptions {
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
}

export interface FinetuneOptions {
  brightness: number;
  contrast: number;
  saturation: number;
  clarity: number;
}

export interface CropOptionsState {
  aspectRatio: number | null;
}

export interface RedactOptions {
  mode: RedactMode;
  strength: number;
}

export interface StickerOptions {
  emoji: string;
}

export interface ResizeOptionsState {
  width: number;
  height: number;
  lockAspectRatio: boolean;
}

export interface BaseAnnotation {
  id: string;
  type: string;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface TextAnnotationData extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  width?: number;
  height?: number;
  rotation: number;
}

export interface FreeDrawAnnotation extends BaseAnnotation {
  type: 'freedraw';
  points: number[];
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface RedactAnnotation extends BaseAnnotation {
  type: 'redact';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  mode: RedactMode;
  strength: number;
}

export interface StickerAnnotation extends BaseAnnotation {
  type: 'sticker';
  x: number;
  y: number;
  size: number;
  emoji: string;
  rotation: number;
}

export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | LineAnnotation
  | TextAnnotationData
  | FreeDrawAnnotation
  | RedactAnnotation
  | StickerAnnotation;

export interface ImageEditorState {
  originalImage: HTMLImageElement | null;
  originalWidth: number;
  originalHeight: number;
  transform: Transform;
  outputSize: OutputSize | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  activeTool: ToolType | null;
  filter: FilterPresetId;
  finetune: FinetuneOptions;
  drawOptions: DrawOptions;
  shapeOptions: ShapeOptions;
  textOptions: TextOptions;
  cropOptions: CropOptionsState;
  resizeOptions: ResizeOptionsState;
  redactOptions: RedactOptions;
  stickerOptions: StickerOptions;
  pendingCrop: CropRect | null;
  isLoading: boolean;
  error: string | null;
}

export interface InkioImageEditorMessages {
  imageEditor: ImageEditorLocale;
}

export type InkioImageEditorMessageOverrides = DeepPartial<InkioImageEditorMessages>;

export interface ImageEditorLocale {
  crop: string;
  rotate: string;
  resize: string;
  draw: string;
  drawDefaults: string;
  selectedDraw: string;
  shapes: string;
  shapeDefaults: string;
  selectedShape: string;
  text: string;
  textContent: string;
  textBoxWidth: string;
  textDefaults: string;
  selectedText: string;
  layerOrder: string;
  bringToFront: string;
  bringForward: string;
  sendBackward: string;
  sendToBack: string;
  save: string;
  cancel: string;
  apply: string;
  reset: string;
  cropArea: string;
  cropPendingNotice: string;
  undo: string;
  redo: string;
  flip: string;
  flipH: string;
  flipV: string;
  rotateCW: string;
  rotateCCW: string;
  freeform: string;
  square: string;
  landscape: string;
  portrait: string;
  brushSize: string;
  strokeWidth: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontSizePercent: string;
  colorHex: string;
  colorAlpha: string;
  colorPalette: string;
  bold: string;
  italic: string;
  width: string;
  height: string;
  lockAspectRatio: string;
  rectangle: string;
  ellipse: string;
  arrow: string;
  line: string;
  fill: string;
  stroke: string;
  transparent: string;
  opacity: string;
  zoom: string;
  scaleLabel?: string;
  fit: string;
  filter: string;
  filterNone: string;
  filterGrayscale: string;
  filterSepia: string;
  filterInvert: string;
  filterWarm: string;
  filterCool: string;
  filterDramatic: string;
  filterSoft: string;
  filterVintage: string;
  finetune: string;
  brightness: string;
  contrast: string;
  saturation: string;
  clarity: string;
  resetFinetune: string;
  redact: string;
  sticker: string;
  pixelate: string;
  blur: string;
  strength: string;
  emoji: string;
  closeConfirm: string;
  /** Label for the discard button in the non-blocking close confirmation. */
  discardChanges?: string;
  /** The dialog's name for screen readers. */
  dialogTitle?: string;
  loading: string;
  error: string;
  deleteLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  toolsLabel?: string;
  canvasLabel?: string;
  canvasKeyboardHelp?: string;
  cropKeyboardHelp?: string;
  sourceSizeError?: string;
  outputSizeError?: string;
}

export interface ImageEditorToolActions {
  setFilter: (filter: FilterPresetId) => void;
  /** Brightness, saturation and clarity are clamped to −1…1; contrast to −100…100. Non-finite values are ignored. */
  setAdjustments: (adjustments: Partial<FinetuneOptions>) => void;
  resetAdjustments: () => void;
  rotate: (direction: 'clockwise' | 'counterclockwise') => void;
  flip: (axis: 'horizontal' | 'vertical') => void;
  /** Set an in-bounds crop in unrotated source pixels, or clear it with null. */
  setCrop: (crop: CropRect | null) => void;
  /** Set final displayed dimensions in pixels, or use the natural cropped size with null. */
  setOutputSize: (size: OutputSize | null) => void;
}

export interface ImageEditorToolContext {
  readonly viewport: 'desktop' | 'mobile';
  /** True while loading, saving, or when the source image is unavailable. */
  readonly disabled: boolean;
  readonly originalSize: Readonly<OutputSize>;
  /** Effective displayed dimensions, including the current rotation. */
  readonly outputSize: Readonly<OutputSize>;
  readonly transform: Readonly<Omit<Transform, 'crop'>> & { readonly crop: Readonly<CropRect> | null };
  readonly adjustments: Readonly<FinetuneOptions>;
  readonly filter: FilterPresetId;
  /** Edits use editor history and export. Calls are ignored while the controls are disabled or inactive. */
  readonly actions: Readonly<ImageEditorToolActions>;
}

export interface ImageEditorCustomTool {
  /** A unique, non-empty ID. Built-in tool IDs, including the 'crop' alias, are reserved. */
  readonly id: string;
  readonly label: string;
  /** An optional decorative icon; the label is used as the accessible name. */
  readonly icon?: ReactNode;
  /** Render controls in the same surface as the built-in controls. */
  readonly renderControls: (context: ImageEditorToolContext) => ReactNode;
}

export type ImageEditorTool = ToolType | ImageEditorCustomTool;

export interface ImageEditorToolPlacement {
  /** Defaults to 'left'. */
  desktop?: 'left' | 'right';
  /** Defaults to 'bottom'. */
  mobile?: 'top' | 'bottom';
}

export interface ImageEditorProps {
  src: string;
  /** Awaited before saving completes; reject to preserve edits for retry. The signal aborts when this save is superseded or the editor closes. */
  onSave: (dataUrl: string, signal: AbortSignal) => void | Promise<void>;
  /** Preferred over onSave; receives the full-size encoded image, optional preview, and the same save-scoped cancellation signal. */
  onSaveBlob?: (blob: Blob, preview: Blob | undefined, signal: AbortSignal) => void | Promise<void>;
  /** Pass a same-format, display-only preview (longest side at most 1200 px) to onSaveBlob. */
  savePreview?: boolean;
  onCancel: () => void;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputQuality?: number;
  /** Tools are shown in the given order. The first entry for an ID is used. */
  tools?: readonly ImageEditorTool[];
  /** Initial tool ID, or the preferred fallback when the active tool is removed. */
  defaultTool?: string;
  toolPlacement?: ImageEditorToolPlacement;
  locale?: Partial<ImageEditorLocale>;
  className?: string;
  maxUndoSteps?: number;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface ImageEditorModalProps {
  isOpen: boolean;
  imageSrc: string;
  /** Called only for changed images; the modal closes after this resolves. */
  onSave: ImageEditorProps['onSave'];
  /** Preferred over onSave when provided; receives the full-size encoded image without base64. */
  onSaveBlob?: ImageEditorProps['onSaveBlob'];
  /** Pass a same-format, display-only preview (longest side at most 1200 px) to onSaveBlob. */
  savePreview?: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  imageQuality?: number;
  imageFormat?: 'png' | 'jpeg' | 'webp';
  tools?: ImageEditorProps['tools'];
  defaultTool?: ImageEditorProps['defaultTool'];
  toolPlacement?: ImageEditorProps['toolPlacement'];
  locale?: InkioLocaleInput | Partial<ImageEditorLocale>;
  messages?: InkioImageEditorMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}
