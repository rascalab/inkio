import type { ImageEditorState } from '../types';

export function getVisualStateSnapshot(state: ImageEditorState): string {
  return JSON.stringify({
    transform: state.transform,
    pendingCrop: state.pendingCrop,
    outputSize: state.outputSize,
    annotations: state.annotations,
  });
}

export interface VisualRefs {
  transform: ImageEditorState['transform'];
  pendingCrop: ImageEditorState['pendingCrop'];
  outputSize: ImageEditorState['outputSize'];
  annotations: ImageEditorState['annotations'];
}

export function getVisualRefs(state: ImageEditorState): VisualRefs {
  return {
    transform: state.transform,
    pendingCrop: state.pendingCrop,
    outputSize: state.outputSize,
    annotations: state.annotations,
  };
}

export function areVisualRefsEqual(a: VisualRefs, b: VisualRefs): boolean {
  return (
    a.transform === b.transform
    && a.pendingCrop === b.pendingCrop
    && a.outputSize === b.outputSize
    && a.annotations === b.annotations
  );
}

/**
 * Incremental dirty version: O(1) per state change via reference comparison
 * (the reducer only creates new visual objects when something actually
 * changed), replacing a full JSON.stringify per stroke frame. Call once per
 * new state object with the previous state/version pair.
 */
export function nextVisualVersion(
  prevState: ImageEditorState | null,
  prevVersion: number,
  nextState: ImageEditorState,
): number {
  if (!prevState || prevState === nextState) {
    return prevVersion;
  }
  return areVisualRefsEqual(getVisualRefs(prevState), getVisualRefs(nextState))
    ? prevVersion
    : prevVersion + 1;
}
