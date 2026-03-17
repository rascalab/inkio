import type { InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { InkioImageEditorMessageOverrides } from './i18n';

export type ToolType = 'crop' | 'rotate' | 'resize' | 'draw' | 'shape' | 'text';
export type EnabledToolType = Exclude<ToolType, 'crop'>;
export type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'line';

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

export interface CropOptionsState {
  aspectRatio: number | null;
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

export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | LineAnnotation
  | TextAnnotationData
  | FreeDrawAnnotation;

export interface ImageEditorState {
  originalImage: HTMLImageElement | null;
  originalWidth: number;
  originalHeight: number;
  transform: Transform;
  outputSize: OutputSize | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  activeTool: ToolType | null;
  drawOptions: DrawOptions;
  shapeOptions: ShapeOptions;
  textOptions: TextOptions;
  cropOptions: CropOptionsState;
  resizeOptions: ResizeOptionsState;
  pendingCrop: CropRect | null;
  isLoading: boolean;
  error: string | null;
}

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
  /** @deprecated Crop editing is now always live inside resize mode. */
  editCrop: string;
  /** @deprecated Crop editing is now always live inside resize mode. */
  doneCropping: string;
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
  color: string;
  /** @deprecated Shared color picker UI no longer renders a dedicated custom-color label. */
  customColor: string;
  fontFamily: string;
  /** @deprecated Font family now uses a curated select field. */
  fontFamilyPlaceholder: string;
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
  fit: string;
  closeConfirm: string;
  /** @deprecated Tiny viewport hard-disable was removed in favor of a scroll shell. */
  smallViewportTitle: string;
  /** @deprecated Tiny viewport hard-disable was removed in favor of a scroll shell. */
  smallViewportBody: string;
  loading: string;
  error: string;
  deleteLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  toolsLabel?: string;
}

export interface ImageEditorProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputQuality?: number;
  tools?: ToolType[];
  defaultTool?: ToolType;
  locale?: Partial<ImageEditorLocale>;
  className?: string;
  maxUndoSteps?: number;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface ImageEditorModalProps {
  isOpen: boolean;
  imageSrc: string;
  onSave: (editedImageData: string) => void;
  onClose: () => void;
  theme?: 'light' | 'dark';
  imageQuality?: number;
  imageFormat?: 'png' | 'jpeg' | 'webp';
  tools?: ToolType[];
  locale?: unknown;
  messages?: InkioImageEditorMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}
