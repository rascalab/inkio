import { describe, expect, it } from 'vitest';
import { imageEditorReducer, initialState } from '../../reducer';
import {
  areVisualRefsEqual,
  getVisualRefs,
  nextVisualVersion,
} from '../visual-state';
import type { ImageEditorState } from '../../types';

describe('visual version counter', () => {
  it('starts at the given version for a null previous state', () => {
    expect(nextVisualVersion(null, 0, initialState)).toBe(0);
  });

  it('does not bump for non-visual actions (tool/selection/loading)', () => {
    const v0 = 7;
    const tooled = imageEditorReducer(initialState, { type: 'SET_TOOL', tool: 'draw' });
    expect(nextVisualVersion(initialState, v0, tooled)).toBe(v0);
    const selected = imageEditorReducer(tooled, { type: 'SELECT_ANNOTATION', id: 'x' });
    expect(nextVisualVersion(tooled, v0, selected)).toBe(v0);
  });

  it('bumps once per visual change (annotations/transform/filter-independent)', () => {
    const withImage: ImageEditorState = {
      ...initialState,
      originalImage: {} as HTMLImageElement,
      annotations: [],
    };
    let version = 0;
    const added = imageEditorReducer(withImage, {
      type: 'ADD_ANNOTATION',
      annotation: {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: 'transparent',
        stroke: '#000',
        strokeWidth: 1,
        rotation: 0,
      },
    });
    version = nextVisualVersion(withImage, version, added);
    expect(version).toBe(1);

    const dragged = imageEditorReducer(added, {
      type: 'UPDATE_ANNOTATION',
      id: 'r1',
      updates: { x: 5 },
    });
    expect(nextVisualVersion(added, version, dragged)).toBe(2);

    const rotated = imageEditorReducer(dragged, { type: 'ROTATE_CW' });
    expect(nextVisualVersion(dragged, 2, rotated)).toBe(3);
  });

  it('treats identical state objects as no change', () => {
    expect(nextVisualVersion(initialState, 4, initialState)).toBe(4);
  });

  it('detects ref equality for the undo-to-baseline fast path', () => {
    const refs = getVisualRefs(initialState);
    expect(areVisualRefsEqual(refs, getVisualRefs(initialState))).toBe(true);
    const changed = imageEditorReducer(initialState, { type: 'ROTATE_CW' });
    expect(areVisualRefsEqual(refs, getVisualRefs(changed))).toBe(false);
  });
});
