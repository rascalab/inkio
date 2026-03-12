import { useRef, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { TextAnnotationData, Annotation } from '../types';
import { handleCursorPointer, handleCursorDefault } from '../theme';
import { useImageEditor } from '../hooks/useImageEditor';

interface Props {
  annotation: TextAnnotationData;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

const MIN_TEXT_WIDTH = 80;

export function TextAnnotationShape({
  annotation,
  onSelect,
  onChange,
  scale,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
  const { state, dispatch } = useImageEditor();

  const isEditing = state.editingTextId === annotation.id;

  const scaledX = annotation.x * scale;
  const scaledY = annotation.y * scale;
  const scaledWidth = Math.max(MIN_TEXT_WIDTH, annotation.width ?? MIN_TEXT_WIDTH) * scale;
  const scaledFontSize = annotation.fontSize * scale;

  // Single handler: text tool active → edit, otherwise → select
  const handleClick = useCallback(() => {
    onSelect(annotation.id);
    if (state.activeTool === 'text') {
      dispatch({ type: 'SET_EDITING_TEXT', id: annotation.id });
    }
  }, [annotation.id, onSelect, dispatch, state.activeTool]);

  const handleDblClick = useCallback(() => {
    onSelect(annotation.id);
    dispatch({ type: 'SET_EDITING_TEXT', id: annotation.id });
  }, [annotation.id, onSelect, dispatch]);

  // Hide group when editing — the TextEditOverlay handles display
  if (isEditing) {
    return null;
  }

  // Compute text height for hit region
  const textNode = textRef.current;
  const textHeight = textNode ? textNode.height() : scaledFontSize * 1.4 + 4;

  return (
    <Group
      ref={groupRef}
      id={annotation.id}
      x={scaledX}
      y={scaledY}
      rotation={annotation.rotation}
      draggable
      onMouseEnter={handleCursorPointer}
      onMouseLeave={handleCursorDefault}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragEnd={(e) => {
        onChange(annotation.id, {
          x: e.target.x() / scale,
          y: e.target.y() / scale,
        });
      }}
      onTransformEnd={() => {
        const group = groupRef.current;
        if (!group) return;
        onChange(annotation.id, {
          x: group.x() / scale,
          y: group.y() / scale,
          rotation: group.rotation(),
          width: (scaledWidth * group.scaleX()) / scale,
          fontSize: annotation.fontSize * group.scaleY(),
        });
        group.scaleX(1);
        group.scaleY(1);
      }}
    >
      {/* Invisible hit region so clicks are caught by the Group */}
      <Rect
        width={scaledWidth}
        height={textHeight}
        fill="transparent"
      />
      <Text
        ref={textRef}
        text={annotation.text || 'Text'}
        fontSize={scaledFontSize}
        fill={annotation.text ? annotation.fill : `${annotation.fill}44`}
        fontStyle={annotation.fontStyle}
        width={scaledWidth}
        padding={2}
        listening={false}
      />
    </Group>
  );
}
