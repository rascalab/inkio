import { Arrow, Line } from 'react-konva';
import type Konva from 'konva';
import type { ArrowAnnotation, FreeDrawAnnotation, LineAnnotation } from '../types';
import {
  readPointsTransform,
  useAnnotationShapeHandlers,
  type AnnotationShapeProps,
} from './use-annotation-shape-handlers';

// Point-based annotations keep the Konva node at the origin: drags and
// transforms are baked into `points` (image space) on commit. Stroke widths
// are image-space units, matching export (strokeWidth * annScale).

export function ArrowAnnotationShape(props: AnnotationShapeProps<ArrowAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Arrow>(
    props,
    readPointsTransform(annotation.points, scale),
  );

  return (
    <Arrow
      {...handlers}
      points={annotation.points.map((p) => p * scale)}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth * scale}
      fill={annotation.stroke}
      pointerLength={10 * scale}
      pointerWidth={10 * scale}
    />
  );
}

export function LineAnnotationShape(props: AnnotationShapeProps<LineAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Line>(
    props,
    readPointsTransform(annotation.points, scale),
  );

  return (
    <Line
      {...handlers}
      points={annotation.points.map((p) => p * scale)}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth * scale}
      lineCap="round"
      lineJoin="round"
    />
  );
}

export function FreeDrawAnnotationShape(props: AnnotationShapeProps<FreeDrawAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Line>(
    props,
    readPointsTransform(annotation.points, scale),
  );

  return (
    <Line
      {...handlers}
      points={annotation.points.map((p) => p * scale)}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth * scale}
      opacity={annotation.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation="source-over"
    />
  );
}
