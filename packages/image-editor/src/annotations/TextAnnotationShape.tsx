import { useRef, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { TextAnnotationData, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';
import { parseColor, rgbaToCss } from '../utils/color';
import {
  TEXT_DEFAULT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
  getScaledTextHeight,
  getScaledTextWidth,
  resolveTextFontSizePx,
} from '../utils/text-metrics';

interface Props {
  annotation: TextAnnotationData;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
  isEditing?: boolean;
  onEdit?: (id: string) => void;
}

export function TextAnnotationShape({
  annotation,
  onSelect,
  onChange,
  scale,
  isEditing = false,
  onEdit,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);

  const scaledX = annotation.x * scale;
  const scaledY = annotation.y * scale;
  const scaledWidth = getScaledTextWidth(annotation, scale);
  const scaledHeight = getScaledTextHeight(annotation, scale);
  const scaledFontSize = resolveTextFontSizePx(annotation.fontSize) * scale;
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
  }, [annotation.id, onSelect]);

  // Placeholder ghost: derive translucency through the color pipeline so
  // non-hex fills (named colors, transparent, short hex) stay valid.
  const parsedFill = parseColor(annotation.fill);
  const displayFill = annotation.text
    ? annotation.fill
    : parsedFill
      ? rgbaToCss({ ...parsedFill, a: 0x44 / 255 })
      : annotation.fill;

  return (
    <Group
      ref={groupRef}
      id={annotation.id}
      x={scaledX}
      y={scaledY}
      rotation={annotation.rotation}
      draggable={!isEditing}
      onMouseEnter={handleCursorPointer}
      onMouseLeave={handleCursorDefault}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={() => onEdit?.(annotation.id)}
      onDblTap={() => onEdit?.(annotation.id)}
      onDragEnd={(e) => {
        onChange(annotation.id, {
          x: e.target.x() / scale,
          y: e.target.y() / scale,
        });
      }}
      onTransform={() => {
        const group = groupRef.current;
        if (!group) return;
        const text = group.findOne<Konva.Text>('Text');
        if (!text) return;
        const size = {
          width: Math.max(TEXT_MIN_WIDTH * scale, text.width() * group.scaleX()),
          height: Math.max(TEXT_MIN_HEIGHT * scale, text.height() * group.scaleY()),
        };
        text.setAttrs(size);
        group.findOne<Konva.Rect>('Rect')?.setAttrs(size);
        group.scale({ x: 1, y: 1 });
        group.getStage()?.findOne<Konva.Transformer>('Transformer')?.forceUpdate();
      }}
      onTransformEnd={() => {
        const group = groupRef.current;
        if (!group) return;
        const text = group.findOne<Konva.Text>('Text');
        if (!text) return;
        onChange(annotation.id, {
          x: group.x() / scale,
          y: group.y() / scale,
          rotation: group.rotation(),
          width: text.width() / scale,
          height: text.height() / scale,
        });
      }}
    >
      {/* Invisible hit region so clicks are caught by the Group */}
      <Rect
        width={scaledWidth}
        height={scaledHeight}
        fill="transparent"
      />
      <Text
        visible={!isEditing}
        text={annotation.text || 'Text'}
        fontSize={scaledFontSize}
        fontFamily={annotation.fontFamily || TEXT_DEFAULT_FONT_FAMILY}
        fill={displayFill}
        fontStyle={annotation.fontStyle}
        width={scaledWidth}
        height={scaledHeight}
        lineHeight={TEXT_LINE_HEIGHT}
        padding={2}
        listening={false}
      />
    </Group>
  );
}
