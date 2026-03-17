import { describe, expect, it } from 'vitest';
import { imageEditorReducer, initialState } from '../reducer';
import type { RectAnnotation, TextAnnotationData, ToolType } from '../types';
import { COLOR_PRESETS } from '../color-presets';
import { getDefaultCropRect } from '../utils/crop';

function makeRect(id: string): RectAnnotation {
  return {
    id,
    type: 'rect',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fill: 'transparent',
    stroke: COLOR_PRESETS[0],
    strokeWidth: 2,
    rotation: 0,
  };
}

function makeText(id: string): TextAnnotationData {
  return {
    id,
    type: 'text',
    x: 24,
    y: 32,
    text: 'Hello',
    fontSize: 32,
    fontFamily: 'system-ui',
    fill: '#111827',
    fontStyle: 'normal',
    width: 160,
    rotation: 0,
  };
}

describe('imageEditorReducer', () => {
  describe('SET_IMAGE', () => {
    it('sets image data and resets transform', () => {
      const img = {} as HTMLImageElement;
      const next = imageEditorReducer(initialState, {
        type: 'SET_IMAGE',
        image: img,
        width: 800,
        height: 600,
      });

      expect(next.originalImage).toBe(img);
      expect(next.originalWidth).toBe(800);
      expect(next.originalHeight).toBe(600);
      expect(next.transform.rotation).toBe(0);
      expect(next.transform.flipX).toBe(false);
      expect(next.transform.flipY).toBe(false);
      expect(next.transform.crop).toBeNull();
    });

    it('resets annotations and selection on SET_IMAGE', () => {
      const withAnnotations = {
        ...initialState,
        annotations: [makeRect('a1')],
        selectedAnnotationId: 'a1',
      };

      const next = imageEditorReducer(withAnnotations, {
        type: 'SET_IMAGE',
        image: {} as HTMLImageElement,
        width: 400,
        height: 300,
      });

      expect(next.annotations).toHaveLength(0);
      expect(next.selectedAnnotationId).toBeNull();
    });

    it('updates resizeOptions dimensions', () => {
      const next = imageEditorReducer(initialState, {
        type: 'SET_IMAGE',
        image: {} as HTMLImageElement,
        width: 1920,
        height: 1080,
      });

      expect(next.resizeOptions.width).toBe(1920);
      expect(next.resizeOptions.height).toBe(1080);
    });
  });

  describe('ROTATE_CW / ROTATE_CCW', () => {
    it('ROTATE_CW increments rotation by 90', () => {
      const r0 = imageEditorReducer(initialState, { type: 'ROTATE_CW' });
      expect(r0.transform.rotation).toBe(90);

      const r1 = imageEditorReducer(r0, { type: 'ROTATE_CW' });
      expect(r1.transform.rotation).toBe(180);

      const r2 = imageEditorReducer(r1, { type: 'ROTATE_CW' });
      expect(r2.transform.rotation).toBe(270);

      const r3 = imageEditorReducer(r2, { type: 'ROTATE_CW' });
      expect(r3.transform.rotation).toBe(0); // wraps around
    });

    it('ROTATE_CCW decrements rotation by 90', () => {
      const r0 = imageEditorReducer(initialState, { type: 'ROTATE_CCW' });
      expect(r0.transform.rotation).toBe(270);

      const r1 = imageEditorReducer(r0, { type: 'ROTATE_CCW' });
      expect(r1.transform.rotation).toBe(180);
    });

    it('ROTATE_CW then ROTATE_CCW returns to original rotation', () => {
      const after = imageEditorReducer(
        imageEditorReducer(initialState, { type: 'ROTATE_CW' }),
        { type: 'ROTATE_CCW' },
      );
      expect(after.transform.rotation).toBe(0);
    });
  });

  describe('FLIP_X / FLIP_Y', () => {
    it('FLIP_X toggles flipX', () => {
      const flipped = imageEditorReducer(initialState, { type: 'FLIP_X' });
      expect(flipped.transform.flipX).toBe(true);

      const unflipped = imageEditorReducer(flipped, { type: 'FLIP_X' });
      expect(unflipped.transform.flipX).toBe(false);
    });

    it('FLIP_Y toggles flipY', () => {
      const flipped = imageEditorReducer(initialState, { type: 'FLIP_Y' });
      expect(flipped.transform.flipY).toBe(true);

      const unflipped = imageEditorReducer(flipped, { type: 'FLIP_Y' });
      expect(unflipped.transform.flipY).toBe(false);
    });

    it('FLIP_X does not affect flipY', () => {
      const state = { ...initialState, transform: { ...initialState.transform, flipY: true } };
      const result = imageEditorReducer(state, { type: 'FLIP_X' });
      expect(result.transform.flipY).toBe(true);
    });
  });

  describe('SET_PENDING_CROP / APPLY_CROP', () => {
    const cropRect = { x: 10, y: 20, width: 200, height: 150 };

    it('SET_PENDING_CROP stores the crop rect', () => {
      const next = imageEditorReducer(initialState, { type: 'SET_PENDING_CROP', crop: cropRect });
      expect(next.pendingCrop).toEqual(cropRect);
    });

    it('SET_PENDING_CROP with null clears pendingCrop', () => {
      const withCrop = { ...initialState, pendingCrop: cropRect };
      const next = imageEditorReducer(withCrop, { type: 'SET_PENDING_CROP', crop: null });
      expect(next.pendingCrop).toBeNull();
    });

    it('APPLY_CROP applies pendingCrop to transform and clears it', () => {
      const withPending = { ...initialState, pendingCrop: cropRect };
      const next = imageEditorReducer(withPending, { type: 'APPLY_CROP' });
      expect(next.transform.crop).toEqual(cropRect);
      expect(next.pendingCrop).toBeNull();
    });
  });

  describe('resize session actions', () => {
    it('START_RESIZE_SESSION seeds a full-bounds crop draft immediately', () => {
      const state = imageEditorReducer(initialState, {
        type: 'SET_IMAGE',
        image: {} as HTMLImageElement,
        width: 560,
        height: 360,
      });

      const next = imageEditorReducer(state, { type: 'START_RESIZE_SESSION' });
      expect(next.pendingCrop).toEqual({ x: 0, y: 0, width: 560, height: 360 });
      expect(next.resizeOptions.width).toBe(560);
      expect(next.resizeOptions.height).toBe(360);
    });

    it('COMMIT_RESIZE_SESSION applies crop and resize in one step', () => {
      const state = {
        ...initialState,
        originalWidth: 560,
        originalHeight: 360,
        pendingCrop: { x: 100, y: 0, width: 360, height: 360 },
        resizeOptions: { width: 420, height: 420, lockAspectRatio: false },
      };

      const next = imageEditorReducer(state, { type: 'COMMIT_RESIZE_SESSION' });
      expect(next.transform.crop).toEqual({ x: 100, y: 0, width: 360, height: 360 });
      expect(next.outputSize).toEqual({ width: 420, height: 420 });
      expect(next.pendingCrop).toBeNull();
    });

    it('RESET_RESIZE_SESSION clears crop, clears output size, and reseeds full bounds', () => {
      const state = {
        ...initialState,
        originalWidth: 560,
        originalHeight: 360,
        cropOptions: { aspectRatio: 1 },
        transform: {
          rotation: 0,
          flipX: false,
          flipY: false,
          crop: { x: 100, y: 0, width: 360, height: 360 },
        },
        outputSize: { width: 420, height: 420 },
        pendingCrop: { x: 100, y: 0, width: 360, height: 360 },
      };

      const next = imageEditorReducer(state, { type: 'RESET_RESIZE_SESSION' });
      expect(next.transform.crop).toBeNull();
      expect(next.outputSize).toBeNull();
      expect(next.cropOptions.aspectRatio).toBeNull();
      expect(next.pendingCrop).toEqual({ x: 0, y: 0, width: 560, height: 360 });
    });
  });

  describe('ADD_ANNOTATION', () => {
    it('appends annotation to the array', () => {
      const ann = makeRect('r1');
      const next = imageEditorReducer(initialState, { type: 'ADD_ANNOTATION', annotation: ann });
      expect(next.annotations).toHaveLength(1);
      expect(next.annotations[0]).toBe(ann);
    });

    it('keeps existing annotations when adding new one', () => {
      const a1 = makeRect('r1');
      const a2 = makeRect('r2');
      const s1 = imageEditorReducer(initialState, { type: 'ADD_ANNOTATION', annotation: a1 });
      const s2 = imageEditorReducer(s1, { type: 'ADD_ANNOTATION', annotation: a2 });
      expect(s2.annotations).toHaveLength(2);
      expect(s2.annotations[0]).toBe(a1);
      expect(s2.annotations[1]).toBe(a2);
    });
  });

  describe('UPDATE_ANNOTATION', () => {
    it('updates specific annotation by id', () => {
      const ann = makeRect('r1');
      const withAnn = { ...initialState, annotations: [ann] };

      const next = imageEditorReducer(withAnn, {
        type: 'UPDATE_ANNOTATION',
        id: 'r1',
        updates: { x: 99 },
      });

      expect((next.annotations[0] as RectAnnotation).x).toBe(99);
      expect((next.annotations[0] as RectAnnotation).y).toBe(10); // unchanged
    });

    it('does not modify other annotations', () => {
      const a1 = makeRect('r1');
      const a2 = makeRect('r2');
      const withAnns = { ...initialState, annotations: [a1, a2] };

      const next = imageEditorReducer(withAnns, {
        type: 'UPDATE_ANNOTATION',
        id: 'r1',
        updates: { x: 50 },
      });

      expect((next.annotations[1] as RectAnnotation).x).toBe(10); // a2 unchanged
    });

    it('UPDATE_ANNOTATION_COMMIT behaves same as UPDATE_ANNOTATION', () => {
      const ann = makeRect('r1');
      const withAnn = { ...initialState, annotations: [ann] };

      const next = imageEditorReducer(withAnn, {
        type: 'UPDATE_ANNOTATION_COMMIT',
        id: 'r1',
        updates: { x: 77 },
      });

      expect((next.annotations[0] as RectAnnotation).x).toBe(77);
    });
  });

  describe('DELETE_ANNOTATION', () => {
    it('removes specific annotation by id', () => {
      const a1 = makeRect('r1');
      const a2 = makeRect('r2');
      const withAnns = { ...initialState, annotations: [a1, a2] };

      const next = imageEditorReducer(withAnns, { type: 'DELETE_ANNOTATION', id: 'r1' });
      expect(next.annotations).toHaveLength(1);
      expect(next.annotations[0].id).toBe('r2');
    });

    it('clears selectedAnnotationId if the deleted annotation was selected', () => {
      const ann = makeRect('r1');
      const state = { ...initialState, annotations: [ann], selectedAnnotationId: 'r1' };

      const next = imageEditorReducer(state, { type: 'DELETE_ANNOTATION', id: 'r1' });
      expect(next.selectedAnnotationId).toBeNull();
    });

    it('preserves selectedAnnotationId if a different annotation is deleted', () => {
      const a1 = makeRect('r1');
      const a2 = makeRect('r2');
      const state = { ...initialState, annotations: [a1, a2], selectedAnnotationId: 'r2' };

      const next = imageEditorReducer(state, { type: 'DELETE_ANNOTATION', id: 'r1' });
      expect(next.selectedAnnotationId).toBe('r2');
    });
  });

  describe('SELECT_ANNOTATION', () => {
    it('sets selectedAnnotationId', () => {
      const ann = makeRect('r1');
      const withAnn = { ...initialState, annotations: [ann] };

      const next = imageEditorReducer(withAnn, { type: 'SELECT_ANNOTATION', id: 'r1' });
      expect(next.selectedAnnotationId).toBe('r1');
    });

    it('accepts null to deselect', () => {
      const state = { ...initialState, selectedAnnotationId: 'r1' };
      const next = imageEditorReducer(state, { type: 'SELECT_ANNOTATION', id: null });
      expect(next.selectedAnnotationId).toBeNull();
    });
  });

  describe('SET_TOOL', () => {
    it('changes activeTool', () => {
      const next = imageEditorReducer(initialState, { type: 'SET_TOOL', tool: 'draw' });
      expect(next.activeTool).toBe('draw');
    });

    it('clears selectedAnnotationId when switching tools from the toolbar', () => {
      const state = { ...initialState, selectedAnnotationId: 'r1' };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: 'text' });
      expect(next.selectedAnnotationId).toBeNull();
    });

    it('clears selectedAnnotationId when switching to crop tool', () => {
      const state = { ...initialState, selectedAnnotationId: 'r1' };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: 'crop' });
      expect(next.selectedAnnotationId).toBeNull();
    });

    it('can clear the active tool while preserving selection for object editing', () => {
      const state = { ...initialState, selectedAnnotationId: 'r1', activeTool: 'shape' as const };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: null, preserveSelection: true });
      expect(next.activeTool).toBeNull();
      expect(next.selectedAnnotationId).toBe('r1');
    });

    it('preserves pendingCrop when switching to crop tool', () => {
      const cropRect = { x: 0, y: 0, width: 100, height: 100 };
      const state = { ...initialState, pendingCrop: cropRect };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: 'crop' });
      expect(next.pendingCrop).toEqual(cropRect);
    });

    it('preserves pendingCrop when switching away from crop tool', () => {
      const cropRect = { x: 0, y: 0, width: 100, height: 100 };
      const state = { ...initialState, activeTool: 'crop' as ToolType, pendingCrop: cropRect };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: 'draw' });
      expect(next.pendingCrop).toEqual(cropRect);
    });

    it('clears selected text when switching tools from the toolbar', () => {
      const state = {
        ...initialState,
        annotations: [makeText('t1')],
        selectedAnnotationId: 't1',
        activeTool: 'text' as const,
      };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: 'draw' });
      expect(next.selectedAnnotationId).toBeNull();
    });

    it('accepts null tool', () => {
      const state = { ...initialState, activeTool: 'draw' as const };
      const next = imageEditorReducer(state, { type: 'SET_TOOL', tool: null });
      expect(next.activeTool).toBeNull();
    });
  });

  describe('RESET', () => {
    it('returns to initial state', () => {
      const modified = {
        ...initialState,
        activeTool: 'draw' as const,
        annotations: [makeRect('r1')],
        transform: { rotation: 90, flipX: true, flipY: false, crop: null },
      };

      const next = imageEditorReducer(modified, { type: 'RESET' });
      expect(next).toEqual(initialState);
    });
  });

  describe('getDefaultCropRect', () => {
    it('returns the full image bounds for freeform crop', () => {
      expect(getDefaultCropRect(560, 360, null)).toEqual({ x: 0, y: 0, width: 560, height: 360 });
    });

    it('returns the largest centered crop for fixed ratios', () => {
      expect(getDefaultCropRect(560, 360, 1)).toEqual({ x: 100, y: 0, width: 360, height: 360 });
      expect(getDefaultCropRect(560, 360, 16 / 9)).toEqual({ x: 0, y: 22.5, width: 560, height: 315 });
    });
  });

  describe('layer ordering', () => {
    it('brings an annotation to the front', () => {
      const state = {
        ...initialState,
        annotations: [makeRect('a'), makeRect('b'), makeRect('c')],
      };

      const next = imageEditorReducer(state, { type: 'BRING_ANNOTATION_TO_FRONT', id: 'a' });
      expect(next.annotations.map((annotation) => annotation.id)).toEqual(['b', 'c', 'a']);
    });

    it('moves an annotation forward by one step', () => {
      const state = {
        ...initialState,
        annotations: [makeRect('a'), makeRect('b'), makeRect('c')],
      };

      const next = imageEditorReducer(state, { type: 'BRING_ANNOTATION_FORWARD', id: 'a' });
      expect(next.annotations.map((annotation) => annotation.id)).toEqual(['b', 'a', 'c']);
    });

    it('moves an annotation backward by one step', () => {
      const state = {
        ...initialState,
        annotations: [makeRect('a'), makeRect('b'), makeRect('c')],
      };

      const next = imageEditorReducer(state, { type: 'SEND_ANNOTATION_BACKWARD', id: 'c' });
      expect(next.annotations.map((annotation) => annotation.id)).toEqual(['a', 'c', 'b']);
    });

    it('sends an annotation to the back', () => {
      const state = {
        ...initialState,
        annotations: [makeRect('a'), makeRect('b'), makeRect('c')],
      };

      const next = imageEditorReducer(state, { type: 'SEND_ANNOTATION_TO_BACK', id: 'c' });
      expect(next.annotations.map((annotation) => annotation.id)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('SET_LOADING / SET_ERROR', () => {
    it('SET_LOADING sets isLoading', () => {
      const next = imageEditorReducer(initialState, { type: 'SET_LOADING', isLoading: true });
      expect(next.isLoading).toBe(true);

      const back = imageEditorReducer(next, { type: 'SET_LOADING', isLoading: false });
      expect(back.isLoading).toBe(false);
    });

    it('SET_ERROR sets error string', () => {
      const next = imageEditorReducer(initialState, { type: 'SET_ERROR', error: 'failed' });
      expect(next.error).toBe('failed');
    });

    it('SET_ERROR with null clears error', () => {
      const state = { ...initialState, error: 'oops' };
      const next = imageEditorReducer(state, { type: 'SET_ERROR', error: null });
      expect(next.error).toBeNull();
    });
  });
});
