import { Ellipse, Rect } from 'react-konva';
import type Konva from 'konva';
import type { EllipseAnnotation, RectAnnotation } from '../types';
import { useAnnotationShapeHandlers, type AnnotationShapeProps } from './use-annotation-shape-handlers';

// Box annotations bake Transformer scale into their size on commit (the
// node scale is reset to 1). Stroke widths are image-space units, matching
// export (strokeWidth * annScale).

export function RectAnnotationShape(props: AnnotationShapeProps<RectAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Rect>(props, (node) => {
    const scaleXNode = node.scaleX();
    const scaleYNode = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    return {
      x: node.x() / scale,
      y: node.y() / scale,
      width: (node.width() * scaleXNode) / scale,
      height: (node.height() * scaleYNode) / scale,
      rotation: node.rotation(),
    };
  });

  return (
    <Rect
      {...handlers}
      x={annotation.x * scale}
      y={annotation.y * scale}
      width={annotation.width * scale}
      height={annotation.height * scale}
      fill={annotation.fill}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth * scale}
      rotation={annotation.rotation}
    />
  );
}

export function EllipseAnnotationShape(props: AnnotationShapeProps<EllipseAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Ellipse>(props, (node) => {
    const scaleXNode = node.scaleX();
    const scaleYNode = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    return {
      x: node.x() / scale,
      y: node.y() / scale,
      radiusX: (node.radiusX() * scaleXNode) / scale,
      radiusY: (node.radiusY() * scaleYNode) / scale,
      rotation: node.rotation(),
    };
  });

  return (
    <Ellipse
      {...handlers}
      x={annotation.x * scale}
      y={annotation.y * scale}
      radiusX={annotation.radiusX * scale}
      radiusY={annotation.radiusY * scale}
      fill={annotation.fill}
      stroke={annotation.stroke}
      strokeWidth={annotation.strokeWidth * scale}
      rotation={annotation.rotation}
    />
  );
}
