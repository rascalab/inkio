import { useEffect, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import type { RedactAnnotation } from '../types';
import { useAnnotationShapeHandlers, type AnnotationShapeProps } from './use-annotation-shape-handlers';

interface Props extends AnnotationShapeProps<RedactAnnotation> {
  image: HTMLImageElement | null;
}

function redactFilters(mode: RedactAnnotation['mode']) {
  return mode === 'blur' ? [Konva.Filters.Blur] : [Konva.Filters.Pixelate];
}

export function RedactAnnotationShape({ image, ...props }: Props) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Image>(props, (node) => {
    const scaleXNode = node.scaleX();
    const scaleYNode = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    return {
      x: node.x() / scale,
      y: node.y() / scale,
      width: Math.max(1, (node.width() * scaleXNode) / scale),
      height: Math.max(1, (node.height() * scaleYNode) / scale),
      rotation: node.rotation(),
    };
  });
  const shapeRef = handlers.ref;
  const recacheFrame = useRef(0);

  // The cropped source region is re-cached whenever geometry or mode changes.
  // Resize drags fire every mousemove, but cache() re-rasters pixels, so
  // coalesce to at most one recalculation per frame (latest values win).
  useEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    if (recacheFrame.current) {
      cancelAnimationFrame(recacheFrame.current);
    }
    recacheFrame.current = requestAnimationFrame(() => {
      recacheFrame.current = 0;
      const current = shapeRef.current;
      if (!current) return;
      if (annotation.mode === 'blur') {
        current.blurRadius(Math.max(0.5, annotation.strength * 0.75));
      } else {
        current.pixelSize(Math.max(2, Math.round(annotation.strength)));
      }
      current.filters(redactFilters(annotation.mode));
      current.cache();
      current.getLayer()?.batchDraw();
    });
    return () => {
      if (recacheFrame.current) {
        cancelAnimationFrame(recacheFrame.current);
        recacheFrame.current = 0;
      }
    };
  }, [annotation.mode, annotation.strength, annotation.x, annotation.y, annotation.width, annotation.height, image, scale]);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      {...handlers}
      image={image}
      x={annotation.x * scale}
      y={annotation.y * scale}
      width={Math.max(1, annotation.width * scale)}
      height={Math.max(1, annotation.height * scale)}
      rotation={annotation.rotation}
      crop={{
        x: annotation.x,
        y: annotation.y,
        width: Math.max(1, annotation.width),
        height: Math.max(1, annotation.height),
      }}
    />
  );
}
