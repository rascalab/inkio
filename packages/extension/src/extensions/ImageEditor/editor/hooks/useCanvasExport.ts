import { useCallback } from 'react';
import { useImageEditor } from './useImageEditor';
import { exportCanvas } from '../utils/exportCanvas';

export function useCanvasExport() {
  const { state } = useImageEditor();

  const exportToDataURL = useCallback(
    (format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.92): Promise<string> => {
      return exportCanvas(state, format, quality);
    },
    // Intentionally listing only visual/output properties: recreating the callback when
    // tool or selection state changes is unnecessary and would cause extra renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.originalImage, state.originalWidth, state.originalHeight, state.transform, state.outputSize, state.annotations],
  );

  return { exportToDataURL };
}
