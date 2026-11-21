import { useLayoutEffect, useMemo, useRef } from 'react';
import { useImageEditor } from '../hooks/use-image-editor';
import type { ImageEditorAction } from '../reducer';
import type { ImageEditorCustomTool, ImageEditorToolActions, OutputSize } from '../types';
import type { ViewportKind } from '../utils/controls-model';

interface CustomToolOptionsProps {
  tool: ImageEditorCustomTool;
  viewport: ViewportKind;
  disabled: boolean;
  outputSize: OutputSize;
  isSavePending: () => boolean;
}

export function CustomToolOptions({ tool, viewport, disabled, outputSize, isSavePending }: CustomToolOptionsProps) {
  const { state, dispatch } = useImageEditor();
  const canEdit = useRef(false);
  useLayoutEffect(() => {
    canEdit.current = !disabled;
    return () => { canEdit.current = false; };
  }, [disabled]);

  const actions = useMemo<ImageEditorToolActions>(() => {
    const run = (action: ImageEditorAction) => {
      if (canEdit.current && !isSavePending()) dispatch(action);
    };
    return {
      setFilter: (filter) => run({ type: 'SET_FILTER', filter }),
      setAdjustments: (adjustments) => run({ type: 'SET_FINETUNE', finetune: { ...adjustments } }),
      resetAdjustments: () => run({ type: 'RESET_FINETUNE' }),
      rotate: (direction) => run({ type: direction === 'clockwise' ? 'ROTATE_CW' : 'ROTATE_CCW' }),
      flip: (axis) => run({ type: axis === 'horizontal' ? 'FLIP_X' : 'FLIP_Y' }),
      setCrop: (crop) => run({ type: 'APPLY_CROP', crop: crop ? { ...crop } : null }),
      setOutputSize: (size) => run({ type: 'APPLY_RESIZE', size: size ? { ...size } : null }),
    };
  }, [dispatch, isSavePending]);
  const { crop } = state.transform;

  return (
    <fieldset className="inkio-ie-custom-tool-controls" aria-label={tool.label} disabled={disabled} inert={disabled}>
      {tool.renderControls({
        viewport,
        disabled,
        filter: state.filter,
        adjustments: { ...state.finetune },
        transform: { ...state.transform, crop: crop ? { ...crop } : null },
        originalSize: { width: state.originalWidth, height: state.originalHeight },
        outputSize: { ...outputSize },
        actions,
      })}
    </fieldset>
  );
}
