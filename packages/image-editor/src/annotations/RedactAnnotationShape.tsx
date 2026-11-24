import { useEffect, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva/lib/ReactKonvaCore.js';
import 'konva/lib/shapes/Image.js';
import type KonvaTypes from 'konva';
import { Blur } from 'konva/lib/filters/Blur.js';
import { Pixelate } from 'konva/lib/filters/Pixelate.js';
import type { RedactAnnotation } from '../types';
import { useAnnotationShapeHandlers, type AnnotationShapeProps } from './use-annotation-shape-handlers';
import { getRedactionCacheRatio } from '../utils/raster-limits';

interface Props extends AnnotationShapeProps<RedactAnnotation> {
  image: HTMLImageElement | null;
}

function redactFilters(mode: RedactAnnotation['mode']) {
  return mode === 'blur' ? [Blur] : [Pixelate];
}

export function RedactAnnotationShape({ image, ...props }: Props) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<KonvaTypes.Image>(props, (node) => {
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

  // Sample the live node geometry during a gesture, without committing history.
  // Re-rasterizing filters is coalesced to one update per animation frame.
  useEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    const recache = () => {
      if (recacheFrame.current) return;
      recacheFrame.current = requestAnimationFrame(() => {
        recacheFrame.current = 0;
        node.crop({
          x: node.x() / scale,
          y: node.y() / scale,
          width: Math.max(1, node.width() * node.scaleX() / scale),
          height: Math.max(1, node.height() * node.scaleY() / scale),
        });
        const pixelRatio = getRedactionCacheRatio(node.width(), node.height());
        if (annotation.mode === 'blur') {
          node.blurRadius(Math.max(1, annotation.strength * 0.75 * pixelRatio));
        } else {
          node.pixelSize(Math.max(2, Math.round(annotation.strength * pixelRatio)));
        }
        node.filters(redactFilters(annotation.mode));
        node.cache({ pixelRatio });
        node.getLayer()?.batchDraw();
      });
    };
    recache();
    node.on('dragmove.redact transform.redact', recache);
    return () => {
      node.off('.redact');
      cancelAnimationFrame(recacheFrame.current);
      recacheFrame.current = 0;
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
