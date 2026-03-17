import { useCallback } from 'react';
import { exportCanvas } from '../utils/export-canvas';
import type { ImageEditorState } from '../types';

export function useCanvasExport() {

  const exportToDataURL = useCallback(
    (
      format: 'png' | 'jpeg' | 'webp' = 'png',
      quality = 0.92,
      exportState: ImageEditorState,
    ): Promise<string> => {
      return exportCanvas(exportState, format, quality);
    },
    [],
  );

  return { exportToDataURL };
}
