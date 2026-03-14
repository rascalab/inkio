import { useRef, useEffect, useCallback } from 'react';
import { useImageEditor } from '../hooks/useImageEditor';
import { getIEColors } from '../theme';
import type { TextAnnotationData } from '../types';
import {
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
  getScaledTextWidth,
  getTextAnnotationMinHeight,
  getTextFontStyle,
} from '../utils/textMetrics';

interface TextEditOverlayProps {
  annotationScale: number;
}

export function TextEditOverlay({ annotationScale }: TextEditOverlayProps) {
  const { state, dispatch } = useImageEditor();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const annotation = state.editingTextId
    ? (state.annotations.find((a) => a.id === state.editingTextId) as TextAnnotationData | undefined)
    : null;

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Auto-focus and auto-resize on mount
  useEffect(() => {
    if (annotation && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end of existing text
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize();
    }
  }, [annotation?.id, autoResize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = useCallback(() => {
    autoResize();
  }, [autoResize]);

  const handleBlur = useCallback(() => {
    if (isComposingRef.current) return;
    if (!annotation) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const newText = textarea.value.trim();

    if (!newText) {
      dispatch({ type: 'DELETE_ANNOTATION', id: annotation.id });
    } else if (newText !== annotation.text) {
      dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id: annotation.id, updates: { text: newText } });
    }
    dispatch({ type: 'SET_EDITING_TEXT', id: null });
  }, [annotation, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
    }
  }, []);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  if (!annotation) return null;

  const colors = getIEColors();
  const width = getScaledTextWidth(annotation, annotationScale);
  const fontSize = annotation.fontSize * annotationScale;
  const minHeight = getTextAnnotationMinHeight(annotation, annotationScale);
  const { fontStyle, fontWeight } = getTextFontStyle(annotation.fontStyle);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={annotation.text}
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      style={{
        position: 'absolute',
        left: `${annotation.x * annotationScale}px`,
        top: `${annotation.y * annotationScale}px`,
        width: `${width}px`,
        minHeight: `${minHeight}px`,
        fontSize: `${fontSize}px`,
        fontFamily: TEXT_FONT_FAMILY,
        fontStyle,
        fontWeight,
        color: annotation.fill,
        caretColor: annotation.fill,
        background: 'transparent',
        border: 'none',
        outline: `2px solid ${colors.primary}`,
        padding: `${TEXT_PADDING}px`,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        lineHeight: String(TEXT_LINE_HEIGHT),
        zIndex: 10,
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        transform: `rotateZ(${annotation.rotation}deg)`,
        transformOrigin: 'left top',
      }}
    />
  );
}
