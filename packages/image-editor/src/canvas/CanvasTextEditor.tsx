import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/use-image-editor';
import type { TextAnnotationData } from '../types';
import { resolveTextFontSizePx, TEXT_LINE_HEIGHT, TEXT_MIN_HEIGHT } from '../utils/text-metrics';

interface CanvasTextEditorProps {
  readonly annotation: TextAnnotationData;
  readonly stage: Konva.Stage | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly onComplete: () => void;
}

export function CanvasTextEditor({
  annotation, stage, displayWidth, displayHeight, onComplete,
}: CanvasTextEditorProps) {
  const { state, dispatch, locale } = useImageEditor();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scaleRef = useRef(1);
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const group = stage?.findOne<Konva.Group>((node: Konva.Node) => node.id() === annotation.id);
    const node = group?.findOne<Konva.Text>('Text');
    if (!node) return;
    const sync = () => {
      // Keep native input at 16px for mobile while its matrix matches canvas.
      const fontSize = Math.max(16, node.fontSize());
      const inputScale = node.fontSize() / fontSize;
      scaleRef.current = fontSize / resolveTextFontSizePx(annotation.fontSize);
      setStyle({
        width: node.width() / inputScale,
        height: node.height() / inputScale,
        padding: node.padding() / inputScale,
        transform: `matrix(${node.getAbsoluteTransform().getMatrix().map((value, index) => index < 4 ? value * inputScale : value).join(',')})`,
        fontSize,
        fontFamily: node.fontFamily(),
        fontWeight: annotation.fontStyle.includes('bold') ? 700 : 400,
        fontStyle: annotation.fontStyle.includes('italic') ? 'italic' : 'normal',
        lineHeight: TEXT_LINE_HEIGHT,
        color: annotation.fill,
      });
    };
    stage?.findOne<Konva.Transformer>('Transformer')?.forceUpdate();
    sync();
    group?.on('transform.textEditor dragmove.textEditor', sync);
    return () => { group?.off('.textEditor'); };
  }, [annotation, stage, displayWidth, displayHeight, state.transform]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [annotation.id]);

  return (
    <textarea
      ref={inputRef}
      className="inkio-ie-canvas-text-editor"
      style={style}
      data-testid="inkio-ie-text-content-input"
      aria-label={locale.textContent}
      value={annotation.text}
      onChange={(event) => {
        const input = event.target;
        const previousHeight = input.style.height;
        input.style.height = '0px';
        const height = Math.max(annotation.height ?? TEXT_MIN_HEIGHT, Math.ceil(input.scrollHeight / scaleRef.current));
        input.style.height = previousHeight;
        dispatch({
          type: 'UPDATE_ANNOTATION',
          id: annotation.id,
          updates: { text: input.value, height },
        });
      }}
      onBlur={(event) => {
        dispatch(event.target.value.length === 0
          ? { type: 'DELETE_ANNOTATION', id: annotation.id }
          : {
            type: 'UPDATE_ANNOTATION_COMMIT',
            id: annotation.id,
            updates: { text: event.target.value },
          });
        onComplete();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
          event.preventDefault();
          const workspace = event.currentTarget.closest<HTMLElement>('.inkio-ie-canvas-workspace');
          event.currentTarget.blur();
          workspace?.focus({ preventScroll: true });
        }
      }}
    />
  );
}
