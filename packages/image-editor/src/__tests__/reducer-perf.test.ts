import { describe, expect, it } from 'vitest';
import {
  imageEditorReducer,
  makeInitialUndoableState,
  undoableReducer,
  initialState,
  type UndoableAction,
  type UndoableEditorState,
} from '../reducer';
import type { FreeDrawAnnotation, RectAnnotation } from '../types';

function makeRect(id: string): RectAnnotation {
  return {
    id,
    type: 'rect',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fill: 'transparent',
    stroke: '#111827',
    strokeWidth: 2,
    rotation: 0,
  };
}

function undoable(type: Parameters<typeof imageEditorReducer>[1]): UndoableAction {
  return { ...type, undoable: true } as UndoableAction;
}

describe('undoableReducer memory behavior', () => {
  it('keeps undo semantics: undo/redo round-trips visual state', () => {
    let state = makeInitialUndoableState();
    state = undoableReducer(state, undoable({ type: 'ADD_ANNOTATION', annotation: makeRect('a') }), 30);
    state = undoableReducer(state, undoable({ type: 'SET_FILTER', filter: 'grayscale' }), 30);
    expect(state.present.annotations).toHaveLength(1);
    expect(state.present.filter).toBe('grayscale');

    state = undoableReducer(state, { type: 'UNDO' }, 30);
    expect(state.present.filter).toBe('none');
    expect(state.present.annotations).toHaveLength(1);

    state = undoableReducer(state, { type: 'UNDO' }, 30);
    expect(state.present.annotations).toHaveLength(0);

    state = undoableReducer(state, { type: 'REDO' }, 30);
    expect(state.present.annotations).toHaveLength(1);

    state = undoableReducer(state, { type: 'REDO' }, 30);
    expect(state.present.filter).toBe('grayscale');
  });

  it('shares structure: past entries keep originalImage + untouched annotation refs', () => {
    const img = {} as HTMLImageElement;
    const withImage = imageEditorReducer(initialState, {
      type: 'SET_IMAGE',
      image: img,
      width: 800,
      height: 600,
    });
    const a = makeRect('a');
    const withAnn = imageEditorReducer(withImage, { type: 'ADD_ANNOTATION', annotation: a });

    let state: UndoableEditorState = { present: withAnn, past: [], future: [] };
    state = undoableReducer(state, undoable({ type: 'SET_FILTER', filter: 'sepia' }), 30);

    expect(state.past).toHaveLength(1);
    expect(state.past[0].originalImage).toBe(img);
    expect(state.past[0].annotations[0]).toBe(a);
    // Present reuses the same annotation object (only the shell changed).
    expect(state.present.annotations[0]).toBe(a);
  });

  it('caps past at maxUndoSteps', () => {
    let state = makeInitialUndoableState();
    for (let i = 0; i < 40; i += 1) {
      state = undoableReducer(
        state,
        undoable({ type: 'ADD_ANNOTATION', annotation: makeRect(`r${i}`) }),
        10,
      );
    }
    expect(state.past.length).toBeLessThanOrEqual(10);
    expect(state.present.annotations).toHaveLength(40);
  });

  it('clamps absurd maxUndoSteps so history stays bounded', () => {
    let state = makeInitialUndoableState();
    for (let i = 0; i < 5; i += 1) {
      state = undoableReducer(
        state,
        undoable({ type: 'ADD_ANNOTATION', annotation: makeRect(`r${i}`) }),
        Number.POSITIVE_INFINITY,
      );
    }
    expect(state.past.length).toBeLessThanOrEqual(100);
  });

  it('does not push history for no-op undoable actions', () => {
    let state = makeInitialUndoableState();
    state = undoableReducer(state, undoable({ type: 'ADD_ANNOTATION', annotation: makeRect('a') }), 30);
    const before = state;
    // Already at the back: reducer returns the identical state.
    const after = undoableReducer(state, undoable({ type: 'SEND_ANNOTATION_TO_BACK', id: 'a' }), 30);
    expect(after).toBe(before);
    expect(after.past).toHaveLength(1);
  });

  it('clears redo stack on new undoable action', () => {
    let state = makeInitialUndoableState();
    state = undoableReducer(state, undoable({ type: 'ADD_ANNOTATION', annotation: makeRect('a') }), 30);
    state = undoableReducer(state, { type: 'UNDO' }, 30);
    expect(state.future).toHaveLength(1);
    state = undoableReducer(state, undoable({ type: 'ADD_ANNOTATION', annotation: makeRect('b') }), 30);
    expect(state.future).toHaveLength(0);
    expect(state.present.annotations.map((a) => a.id)).toEqual(['b']);
  });
});

describe('APPEND_ANNOTATION_POINTS', () => {
  it('appends deltas to a freedraw annotation', () => {
    const freedraw: FreeDrawAnnotation = {
      id: 'd1',
      type: 'freedraw',
      points: [0, 0],
      stroke: '#111827',
      strokeWidth: 4,
      opacity: 1,
    };
    const base = {
      ...initialState,
      annotations: [freedraw],
    };
    const next = imageEditorReducer(base, {
      type: 'APPEND_ANNOTATION_POINTS',
      id: 'd1',
      points: [10, 20, 30, 40],
    });
    expect(next.annotations[0]).toMatchObject({ points: [0, 0, 10, 20, 30, 40] });
    // Caller buffer untouched; base state untouched (immutable commit).
    expect(base.annotations[0]).toMatchObject({ points: [0, 0] });
  });

  it('is a no-op for empty chunks and unknown ids', () => {
    const base = { ...initialState, annotations: [makeRect('a')] };
    expect(
      imageEditorReducer(base, { type: 'APPEND_ANNOTATION_POINTS', id: 'a', points: [] }),
    ).toBe(base);
    expect(
      imageEditorReducer(base, { type: 'APPEND_ANNOTATION_POINTS', id: 'missing', points: [1, 2] }),
    ).toBe(base);
  });

  it('ignores non-point annotations', () => {
    const base = { ...initialState, annotations: [makeRect('a')] };
    const next = imageEditorReducer(base, {
      type: 'APPEND_ANNOTATION_POINTS',
      id: 'a',
      points: [1, 2],
    });
    expect(next).toBe(base);
  });
});
