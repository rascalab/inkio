import type { ImageEditorState } from '../types';

export function getVisualStateSnapshot(state: ImageEditorState): string {
  return JSON.stringify({
    transform: state.transform,
    pendingCrop: state.pendingCrop,
    outputSize: state.outputSize,
    annotations: state.annotations,
  });
}
