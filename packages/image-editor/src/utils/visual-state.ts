import type { ImageEditorState } from '../types';

export interface VisualRefs {
  transform: ImageEditorState['transform'];
  pendingCrop: ImageEditorState['pendingCrop'];
  outputSize: ImageEditorState['outputSize'];
  annotations: ImageEditorState['annotations'];
  filter: ImageEditorState['filter'];
  finetune: ImageEditorState['finetune'];
}

export function getVisualRefs(state: ImageEditorState): VisualRefs {
  return {
    transform: state.transform,
    pendingCrop: state.pendingCrop,
    outputSize: state.outputSize,
    annotations: state.annotations,
    filter: state.filter,
    finetune: state.finetune,
  };
}

export function areVisualRefsEqual(a: VisualRefs, b: VisualRefs): boolean {
  return (
    a.transform === b.transform
    && a.pendingCrop === b.pendingCrop
    && a.outputSize === b.outputSize
    && a.annotations === b.annotations
    && a.filter === b.filter
    && a.finetune === b.finetune
  );
}

/**
 * Incremental dirty version: O(1) per state change via reference comparison
 * (the reducer only creates new visual objects when something actually
 * changed), replacing a full JSON.stringify per stroke frame. Call once per
 * new state object with the previous state/version pair.
 */
/**
 * Immutability contract: versions advance only when the reducer mints fresh
 * visual refs. Any in-place mutation of transform/annotations bypasses the
 * bump and silently freezes thumbnails and dirty tracking — always spread,
 * never mutate.
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
