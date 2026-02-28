import { useRef, useEffect, useCallback } from 'react';
import { useImageEditor } from '../hooks/useImageEditor';
import { getIEColors } from '../theme';
import type { TextAnnotationData } from '../types';

interface TextEditOverlayProps {
  scaleToFit: number;
}

export function TextEditOverlay({ scaleToFit }: TextEditOverlayProps) {
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
  const width = (annotation.width || 120) * scaleToFit;
  const fontSize = annotation.fontSize * scaleToFit;

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
        left: `${annotation.x * scaleToFit}px`,
        top: `${annotation.y * scaleToFit}px`,
        width: `${width}px`,
        minHeight: `${fontSize * 1.4 + 4}px`,
        fontSize: `${fontSize}px`,
        fontFamily: 'inherit',
        fontStyle: annotation.fontStyle.includes('italic') ? 'italic' : 'normal',
        fontWeight: annotation.fontStyle.includes('bold') ? 'bold' : 'normal',
        color: annotation.fill,
        caretColor: annotation.fill,
        background: 'transparent',
        border: 'none',
        outline: `2px solid ${colors.primary}`,
        padding: '2px',
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        lineHeight: '1.4',
        zIndex: 10,
        boxSizing: 'border-box',
        transform: `rotateZ(${annotation.rotation}deg)`,
        transformOrigin: 'left top',
      }}
    />
  );
}
