import type { ImageEditorState } from '../types';
import { getTransformedDimensions } from './geometry';

/**
 * The resize tool seeds a crop draft as soon as it opens. A draft covering what
 * is already applied changes nothing on save, so it is not an edit.
 */
function getEffectivePendingCrop(state: ImageEditorState): ImageEditorState['pendingCrop'] {
  const { pendingCrop } = state;
  if (!pendingCrop) return null;

  const size = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );
  const applied = state.transform.crop ?? { x: 0, y: 0, width: size.width, height: size.height };
  const isUnchanged = pendingCrop.x === applied.x
    && pendingCrop.y === applied.y
    && pendingCrop.width === applied.width
    && pendingCrop.height === applied.height;
  return isUnchanged ? null : pendingCrop;
}

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
    pendingCrop: getEffectivePendingCrop(state),
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
