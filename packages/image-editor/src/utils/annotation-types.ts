import type {
  Annotation,
  ArrowAnnotation,
  EllipseAnnotation,
  FreeDrawAnnotation,
  LineAnnotation,
  RectAnnotation,
  TextAnnotationData,
  ToolType,
} from '../types';

export type ShapeAnnotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | LineAnnotation;

export function getSelectedAnnotation(
  annotations: readonly Annotation[],
  selectedAnnotationId: string | null,
): Annotation | null {
  if (!selectedAnnotationId) {
    return null;
  }

  return annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
}

export function isDrawAnnotation(annotation: Annotation | null): annotation is FreeDrawAnnotation {
  return annotation?.type === 'freedraw';
}

export function isShapeAnnotation(annotation: Annotation | null): annotation is ShapeAnnotation {
  return (
    annotation?.type === 'rect'
    || annotation?.type === 'ellipse'
    || annotation?.type === 'arrow'
    || annotation?.type === 'line'
  );
}

export function isTextAnnotation(annotation: Annotation | null): annotation is TextAnnotationData {
  return annotation?.type === 'text';
}

export function getToolForAnnotation(annotation: Annotation | null): ToolType | null {
  if (!annotation) {
    return null;
  }

  if (isDrawAnnotation(annotation)) {
    return 'draw';
  }

  if (isShapeAnnotation(annotation)) {
    return 'shape';
  }

  if (isTextAnnotation(annotation)) {
    return 'text';
  }

  return null;
}
