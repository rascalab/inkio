import type { InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import type { InkioImageEditorMessageOverrides } from '../../i18n';

export type ToolType = 'crop' | 'rotate' | 'resize' | 'draw' | 'shape' | 'text';
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
  fontSize: number;
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
  fill: string;
  fontStyle: string;
  width?: number;
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
  editingTextId: string | null;
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
  textDefaults: string;
  selectedText: string;
  save: string;
  cancel: string;
  apply: string;
  reset: string;
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
  fontSize: string;
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
  opacity: string;
  zoom: string;
  fit: string;
  closeConfirm: string;
  loading: string;
  error: string;
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
