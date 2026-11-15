import { useLayoutEffect, useRef } from 'react';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/use-image-editor';
import { clampNumber } from '../utils/math';

interface SelectionActionsOverlayProps {
  readonly stage: Konva.Stage | null;
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export function SelectionActionsOverlay({
  stage,
  containerWidth,
  containerHeight,
  offsetX,
  offsetY,
}: SelectionActionsOverlayProps) {
  const { state, dispatch, locale } = useImageEditor();
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const node = stage?.findOne((candidate: Konva.Node) => candidate.id() === state.selectedAnnotationId);
    if (!overlay || !node) return;
    const sync = () => {
      const bounds = node.getClientRect();
      const width = overlay.offsetWidth;
      const height = overlay.offsetHeight;
      overlay.style.left = `${clampNumber(
        offsetX + bounds.x + bounds.width / 2,
        16 + width / 2,
        Math.max(16 + width / 2, containerWidth - 16 - width / 2),
      )}px`;
      overlay.style.top = `${clampNumber(
        offsetY + Math.max(12, bounds.y - 12),
        Math.max(88, height + 16),
        Math.max(88, containerHeight - 16),
      )}px`;
    };
    sync();
    node.on('dragmove.selectionActions transform.selectionActions', sync);
    return () => { node.off('.selectionActions'); };
  }, [stage, state.selectedAnnotationId, state.annotations, state.transform,
    containerWidth, containerHeight, offsetX, offsetY, locale.deleteLabel]);

  if (!state.selectedAnnotationId) return null;

  return (
    <div
      ref={overlayRef}
      className="inkio-ie-selection-actions"
      data-testid="inkio-ie-selection-actions"
    >
      <button
        type="button"
        className="inkio-ie-selection-action-btn is-danger"
        data-testid="inkio-ie-selection-delete"
        onClick={() => {
          if (state.selectedAnnotationId) {
            dispatch({ type: 'DELETE_ANNOTATION', id: state.selectedAnnotationId });
          }
        }}
      >
        {locale.deleteLabel ?? 'Delete'}
      </button>
    </div>
  );
}
