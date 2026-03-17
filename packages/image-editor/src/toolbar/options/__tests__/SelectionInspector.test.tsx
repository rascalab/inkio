// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorContext, type ImageEditorContextValue } from '../../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../../constants';
import { DrawOptionsPanel } from '../DrawOptionsPanel';
import { ShapeOptionsPanel } from '../ShapeOptionsPanel';
import { TextOptionsPanel } from '../TextOptionsPanel';
import { resolveControlsModel } from '../../ToolOptionsPanel';

afterEach(() => {
  cleanup();
});

function createContextValue(
  annotation: ImageEditorContextValue['state']['annotations'][number],
  dispatch = vi.fn(),
): ImageEditorContextValue {
  return {
    state: {
      originalImage: null,
      originalWidth: 0,
      originalHeight: 0,
      transform: { rotation: 0, flipX: false, flipY: false, crop: null },
      outputSize: null,
      annotations: [annotation],
      selectedAnnotationId: annotation.id,
      activeTool: annotation.type === 'text' ? 'text' : annotation.type === 'freedraw' ? 'draw' : 'shape',
      drawOptions: { color: '#111827', strokeWidth: 4, opacity: 1 },
      shapeOptions: { shapeType: 'rect', fill: 'transparent', stroke: '#111827', strokeWidth: 2 },
      textOptions: { width: 240, height: 96, fontSize: 32, fontFamily: 'system-ui', color: '#111827', fontStyle: 'normal' },
      cropOptions: { aspectRatio: null },
      resizeOptions: { width: 0, height: 0, lockAspectRatio: true },
      pendingCrop: null,
      isLoading: false,
      error: null,
    },
    locale: DEFAULT_LOCALE,
    dispatch,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  };
}

describe('image editor selection-first inspector', () => {
  it('prefers the selected annotation panel over the active tool', () => {
    expect(resolveControlsModel('draw', {
      id: 'text-1',
      type: 'text',
      x: 0,
      y: 0,
      text: 'Inkio',
      fontSize: 32,
      fontFamily: 'system-ui',
      fill: '#111827',
      fontStyle: 'normal',
      rotation: 0,
      width: 160,
      height: 96,
    }, 'desktop')).toEqual({
      kind: 'surface',
      panel: 'text',
      source: 'selection',
      surface: 'dock',
    });
  });

  it('falls back to the active tool when there is no selected annotation', () => {
    expect(resolveControlsModel('shape', null, 'desktop')).toEqual({
      kind: 'surface',
      panel: 'shape',
      source: 'tool',
      surface: 'dock',
    });
    expect(resolveControlsModel('rotate', null, 'mobile')).toEqual({
      kind: 'surface',
      panel: 'rotate',
      source: 'tool',
      surface: 'strip',
    });
    expect(resolveControlsModel(null, null, 'desktop')).toEqual({ kind: 'none' });
  });

  it('updates the selected free-draw annotation instead of only editing defaults', () => {
    const dispatch = vi.fn();
    const context = createContextValue({
      id: 'draw-1',
      type: 'freedraw',
      points: [0, 0, 10, 10],
      stroke: '#111827',
      strokeWidth: 6,
      opacity: 0.5,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <DrawOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    const brushSlider = screen.getAllByLabelText(/Brush size/i)[0];
    fireEvent.change(brushSlider, { target: { value: '12' } });
    fireEvent.pointerUp(brushSlider, { target: { value: '12' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION',
      id: 'draw-1',
      updates: { strokeWidth: 12 },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'draw-1',
      updates: { strokeWidth: 12 },
    });
  });

  it('updates the selected shape annotation instead of only editing defaults', () => {
    const dispatch = vi.fn();
    const context = createContextValue({
      id: 'shape-1',
      type: 'rect',
      x: 8,
      y: 8,
      width: 64,
      height: 40,
      fill: 'transparent',
      stroke: '#111827',
      strokeWidth: 2,
      rotation: 0,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <ShapeOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('inkio-ie-shape-color-picker'));
    fireEvent.click(screen.getByRole('button', { name: 'Color: #ef4444' }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'shape-1',
      updates: { stroke: '#ef4444' },
    });
  });

  it('allows transparent stroke on the selected shape annotation', () => {
    const dispatch = vi.fn();
    const context = createContextValue({
      id: 'shape-1',
      type: 'rect',
      x: 8,
      y: 8,
      width: 64,
      height: 40,
      fill: 'transparent',
      stroke: '#111827',
      strokeWidth: 2,
      rotation: 0,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <ShapeOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('inkio-ie-shape-color-picker'));
    fireEvent.click(screen.getByTestId('inkio-ie-shape-stroke-transparent'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'shape-1',
      updates: { stroke: 'transparent' },
    });
  });

  it('updates the selected text annotation instead of only editing defaults', () => {
    const dispatch = vi.fn();
    const context = createContextValue({
      id: 'text-1',
      type: 'text',
      x: 16,
      y: 24,
      text: 'Inkio',
      fontSize: 32,
      fontFamily: 'system-ui',
      fill: '#111827',
      fontStyle: 'normal',
      rotation: 0,
      width: 160,
      height: 96,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <TextOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    const fontSizeSlider = screen.getAllByLabelText(/Font size/i)[0];
    fireEvent.change(fontSizeSlider, { target: { value: '48' } });
    fireEvent.pointerUp(fontSizeSlider, { target: { value: '48' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION',
      id: 'text-1',
      updates: { fontSize: 48 },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'text-1',
      updates: { fontSize: 48 },
    });
  });

  it('edits selected text content from the bottom panel', () => {
    const dispatch = vi.fn();
    const context = createContextValue({
      id: 'text-1',
      type: 'text',
      x: 16,
      y: 24,
      text: 'Inkio',
      fontSize: 32,
      fontFamily: 'system-ui',
      fill: '#111827',
      fontStyle: 'normal',
      rotation: 0,
      width: 160,
      height: 96,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <TextOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    const textarea = screen.getByTestId('inkio-ie-text-content-input');
    fireEvent.change(textarea, { target: { value: 'Updated heading' } });
    fireEvent.blur(textarea, { target: { value: 'Updated heading' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION',
      id: 'text-1',
      updates: { text: 'Updated heading' },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'text-1',
      updates: { text: 'Updated heading' },
    });
  });

});
