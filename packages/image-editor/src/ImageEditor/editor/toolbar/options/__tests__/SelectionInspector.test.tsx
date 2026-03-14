// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorContext, type ImageEditorContextValue } from '../../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../../constants';
import { DrawOptionsPanel } from '../DrawOptionsPanel';
import { ShapeOptionsPanel } from '../ShapeOptionsPanel';
import { TextOptionsPanel } from '../TextOptionsPanel';
import { getPreferredTextAnnotationWidth } from '../../../utils/textMetrics';

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
      editingTextId: null,
      activeTool: annotation.type === 'text' ? 'text' : annotation.type === 'freedraw' ? 'draw' : 'shape',
      drawOptions: { color: '#e53e3e', strokeWidth: 4, opacity: 1 },
      shapeOptions: { shapeType: 'rect', fill: 'transparent', stroke: '#e53e3e', strokeWidth: 2 },
      textOptions: { fontSize: 24, color: '#111827', fontStyle: 'normal' },
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Color: #ef4444' })[1]);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'shape-1',
      updates: { stroke: '#ef4444' },
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
      fontSize: 20,
      fill: '#111827',
      fontStyle: 'normal',
      rotation: 0,
      width: 160,
    }, dispatch);

    render(
      <ImageEditorContext.Provider value={context}>
        <TextOptionsPanel />
      </ImageEditorContext.Provider>,
    );

    const fontSizeSlider = screen.getAllByLabelText(/Font size/i)[0];
    fireEvent.change(fontSizeSlider, { target: { value: '28' } });
    fireEvent.pointerUp(fontSizeSlider, { target: { value: '28' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION',
      id: 'text-1',
      updates: {
        fontSize: 28,
        width: getPreferredTextAnnotationWidth({
          text: 'Inkio',
          fontSize: 28,
          fontStyle: 'normal',
          width: 160,
        }),
      },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'text-1',
      updates: {
        fontSize: 28,
        width: getPreferredTextAnnotationWidth({
          text: 'Inkio',
          fontSize: 28,
          fontStyle: 'normal',
          width: 160,
        }),
      },
    });
  });
});
