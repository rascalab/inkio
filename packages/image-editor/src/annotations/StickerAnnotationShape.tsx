import { Text } from 'react-konva';
import type Konva from 'konva';
import type { StickerAnnotation } from '../types';
import { useAnnotationShapeHandlers, type AnnotationShapeProps } from './use-annotation-shape-handlers';

export const STICKER_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif';

export function StickerAnnotationShape(props: AnnotationShapeProps<StickerAnnotation>) {
  const { annotation, scale } = props;
  const handlers = useAnnotationShapeHandlers<Konva.Text>(props, (node) => {
    if (!Number.isFinite(scale) || scale <= 0) return null;
    // Emoji stickers keep a uniform size: non-uniform handle stretches
    // normalize to the dominant axis rather than distorting the glyph.
    const nextSize = Math.max(
      8,
      annotation.size * Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())),
    );
    node.scaleX(1);
    node.scaleY(1);
    return {
      x: node.x() / scale,
      y: node.y() / scale,
      size: nextSize,
      rotation: node.rotation(),
    };
  });

  return (
    <Text
      {...handlers}
      x={annotation.x * scale}
      y={annotation.y * scale}
      text={annotation.emoji}
      fontSize={Math.max(1, annotation.size * scale)}
      fontFamily={STICKER_FONT_FAMILY}
      rotation={annotation.rotation}
    />
  );
}
