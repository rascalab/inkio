import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useImageEditor } from '../hooks/use-image-editor';
import { getSelectedAnnotation } from '../utils/annotation-types';
import { getAnnotationDisplayBounds } from '../utils/annotation-bounds';
import { clampNumber } from '../utils/math';

interface SelectionActionsOverlayProps {
  containerWidth: number;
  containerHeight: number;
  displayWidth: number;
  displayHeight: number;
  annotationScale: number;
  cropX: number;
  cropY: number;
  offsetX: number;
  offsetY: number;
  originalWidth: number;
  originalHeight: number;
}

const SELECTION_ACTIONS_EDGE_GUTTER = 16;
const SELECTION_ACTIONS_MIN_TOP = 88;

export function SelectionActionsOverlay({
  containerWidth,
  containerHeight,
  displayWidth,
  displayHeight,
  annotationScale,
  cropX,
  cropY,
  offsetX,
  offsetY,
  originalWidth,
  originalHeight,
}: SelectionActionsOverlayProps) {
  const { state, dispatch, locale } = useImageEditor();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const annotation = useMemo(
    () => getSelectedAnnotation(state.annotations, state.selectedAnnotationId),
    [state.annotations, state.selectedAnnotationId],
  );

  const bounds = useMemo(() => {
    if (!annotation) {
      return null;
    }

    return getAnnotationDisplayBounds(annotation, {
      annotationScale,
      cropX,
      cropY,
      displayWidth,
      displayHeight,
      originalWidth,
      originalHeight,
      rotation: state.transform.rotation,
      flipX: state.transform.flipX,
      flipY: state.transform.flipY,
    });
  }, [
    annotation,
    annotationScale,
    cropX,
    cropY,
    displayHeight,
    displayWidth,
    originalWidth,
    originalHeight,
    state.transform.flipX,
    state.transform.flipY,
    state.transform.rotation,
  ]);

  useLayoutEffect(() => {
    if (!annotation || !overlayRef.current) {
      return;
    }

    const rect = overlayRef.current.getBoundingClientRect();
    setOverlaySize((current) => (
      Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5
        ? current
        : { width: rect.width, height: rect.height }
    ));
  }, [annotation?.id, locale.deleteLabel]);

  if (!annotation || !bounds) {
    return null;
  }

  const estimatedWidth = overlaySize.width || 92;
  const estimatedHeight = overlaySize.height || 50;
  const rawLeft = offsetX + bounds.x + (bounds.width / 2);
  const rawTop = offsetY + Math.max(12, bounds.y - 12);
  const clampedLeft = clampNumber(
    rawLeft,
    SELECTION_ACTIONS_EDGE_GUTTER + (estimatedWidth / 2),
    Math.max(SELECTION_ACTIONS_EDGE_GUTTER + (estimatedWidth / 2), containerWidth - SELECTION_ACTIONS_EDGE_GUTTER - (estimatedWidth / 2)),
  );
  const clampedTop = clampNumber(
    rawTop,
    Math.max(SELECTION_ACTIONS_MIN_TOP, estimatedHeight + SELECTION_ACTIONS_EDGE_GUTTER),
    Math.max(SELECTION_ACTIONS_MIN_TOP, containerHeight - SELECTION_ACTIONS_EDGE_GUTTER),
  );

  return (
    <div
      ref={overlayRef}
      className="inkio-ie-selection-actions"
      data-testid="inkio-ie-selection-actions"
      style={{
        left: `${clampedLeft}px`,
        top: `${clampedTop}px`,
      }}
    >
      <button
        type="button"
        className="inkio-ie-selection-action-btn is-danger"
        data-testid="inkio-ie-selection-delete"
        onClick={() => dispatch({ type: 'DELETE_ANNOTATION', id: annotation.id })}
      >
        {locale.deleteLabel ?? 'Delete'}
      </button>
    </div>
  );
}

