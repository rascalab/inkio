import type { ImageEditorState } from '../types';

export function getVisualStateSnapshot(state: ImageEditorState): string {
  return JSON.stringify({
    transform: state.transform,
    outputSize: state.outputSize,
    annotations: state.annotations,
  });
}
