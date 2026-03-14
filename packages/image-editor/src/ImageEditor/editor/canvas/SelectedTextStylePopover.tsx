import { useCallback, useId, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/useImageEditor';
import type { TextAnnotationData } from '../types';
import { BoldIcon, ItalicIcon } from '../icons';
import { COLOR_PRESETS } from '../toolbar/options/colorPresets';
import { getPreferredTextAnnotationWidth } from '../utils/textMetrics';

interface SelectedTextStylePopoverProps {
  stageRef: RefObject<Konva.Stage | null>;
}

interface PopoverPosition {
  left: number;
  top: number;
}

function getSelectedTextAnnotation(
  annotations: readonly unknown[],
  selectedAnnotationId: string | null,
): TextAnnotationData | null {
  if (!selectedAnnotationId) {
    return null;
  }

  const selected = annotations.find(
    (annotation): annotation is TextAnnotationData =>
      typeof annotation === 'object'
      && annotation !== null
      && 'id' in annotation
      && 'type' in annotation
      && annotation.id === selectedAnnotationId
      && annotation.type === 'text',
  );

  return selected ?? null;
}

export function SelectedTextStylePopover({ stageRef }: SelectedTextStylePopoverProps) {
  const { state, dispatch, locale } = useImageEditor();
  const fontSizeId = useId();
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const annotation = useMemo(
    () => getSelectedTextAnnotation(state.annotations, state.selectedAnnotationId),
    [state.annotations, state.selectedAnnotationId],
  );

  useLayoutEffect(() => {
    if (!annotation || state.editingTextId === annotation.id) {
      setPosition(null);
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      setPosition(null);
      return;
    }

    const node = stage.findOne(`#${annotation.id}`);
    if (!node || typeof node.getClientRect !== 'function') {
      setPosition(null);
      return;
    }

    const bounds = node.getClientRect({ relativeTo: stage });
    const stageWidth = stage.width();
    const anchorX = bounds.x + bounds.width / 2;
    const clampedX = Math.max(80, Math.min(stageWidth - 80, anchorX));
    const top = Math.max(12, bounds.y - 92);

    setPosition({
      left: clampedX,
      top,
    });
  }, [
    annotation,
    stageRef,
    state.editingTextId,
  ]);

  const updateAnnotation = useCallback((updates: Partial<TextAnnotationData>) => {
    if (!annotation) {
      return;
    }

    const nextAnnotation = { ...annotation, ...updates };
    dispatch({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: annotation.id,
      updates: {
        ...updates,
        width: getPreferredTextAnnotationWidth(nextAnnotation),
      },
    });
  }, [annotation, dispatch]);

  const previewFontSize = useCallback((fontSize: number) => {
    if (!annotation) {
      return;
    }

    dispatch({
      type: 'UPDATE_ANNOTATION',
      id: annotation.id,
      updates: {
        fontSize,
        width: getPreferredTextAnnotationWidth({ ...annotation, fontSize }),
      },
    });
  }, [annotation, dispatch]);

  const commitFontSize = useCallback((fontSize: number) => {
    updateAnnotation({ fontSize });
  }, [updateAnnotation]);

  if (!annotation || !position || state.editingTextId === annotation.id) {
    return null;
  }

  const isBold = annotation.fontStyle.includes('bold');
  const isItalic = annotation.fontStyle.includes('italic');

  const updateFontStyle = (bold: boolean, italic: boolean) => {
    let fontStyle: TextAnnotationData['fontStyle'] = 'normal';
    if (bold && italic) fontStyle = 'bold italic';
    else if (bold) fontStyle = 'bold';
    else if (italic) fontStyle = 'italic';

    updateAnnotation({ fontStyle });
  };

  return (
    <div
      className="inkio-ie-text-popover"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      role="toolbar"
      aria-label={locale.selectedText}
    >
      <div className="inkio-ie-text-popover-title">{locale.selectedText}</div>
      <div className="inkio-ie-text-popover-row">
        <div className="inkio-ie-color-presets">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color: ${color}`}
              className={`inkio-ie-color-swatch${annotation.fill === color ? ' is-active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => updateAnnotation({ fill: color })}
            />
          ))}
          <input
            type="color"
            className="inkio-ie-color-input"
            value={annotation.fill}
            onChange={(event) => updateAnnotation({ fill: event.target.value })}
          />
        </div>
      </div>

      <div className="inkio-ie-text-popover-row">
        <label htmlFor={fontSizeId} className="inkio-ie-field-label">
          {locale.fontSize} <span className="inkio-ie-field-value">{annotation.fontSize}px</span>
        </label>
        <input
          id={fontSizeId}
          type="range"
          className="inkio-ie-range-input"
          min={8}
          max={120}
          value={annotation.fontSize}
          onChange={(event) => previewFontSize(parseInt(event.target.value, 10))}
          onPointerUp={(event) => commitFontSize(parseInt((event.target as HTMLInputElement).value, 10))}
          onKeyUp={(event) => commitFontSize(parseInt((event.target as HTMLInputElement).value, 10))}
        />
      </div>

      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <button
          type="button"
          className={`inkio-ie-icon-btn inkio-ie-font-btn${isBold ? ' is-active' : ''}`}
          title={locale.bold}
          onClick={() => updateFontStyle(!isBold, isItalic)}
        >
          <BoldIcon size={16} />
        </button>
        <button
          type="button"
          className={`inkio-ie-icon-btn inkio-ie-font-btn${isItalic ? ' is-active' : ''}`}
          title={locale.italic}
          onClick={() => updateFontStyle(isBold, !isItalic)}
        >
          <ItalicIcon size={16} />
        </button>
      </div>
    </div>
  );
}
