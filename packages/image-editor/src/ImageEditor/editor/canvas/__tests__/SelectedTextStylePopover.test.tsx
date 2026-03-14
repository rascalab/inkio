// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type Konva from 'konva';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorContext } from '../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../constants';
import { SelectedTextStylePopover } from '../SelectedTextStylePopover';
import type { ImageEditorContextValue } from '../../ImageEditorContext';
import { getPreferredTextAnnotationWidth } from '../../utils/textMetrics';

afterEach(() => {
  cleanup();
});

function createContextValue(dispatch = vi.fn()): ImageEditorContextValue {
  return {
    state: {
      originalImage: null,
      originalWidth: 0,
      originalHeight: 0,
      transform: { rotation: 0, flipX: false, flipY: false, crop: null },
      outputSize: null,
      annotations: [{
        id: 'text-1',
        type: 'text',
        x: 24,
        y: 32,
        text: 'Hello',
        fontSize: 24,
        fill: '#111827',
        fontStyle: 'normal',
        width: 160,
        rotation: 0,
      }],
      selectedAnnotationId: 'text-1',
      editingTextId: null,
      activeTool: 'text',
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

describe('SelectedTextStylePopover', () => {
  it('renders for the selected text annotation and updates styles', () => {
    const dispatch = vi.fn();
    const stageRef = createRef<Konva.Stage | null>();
    stageRef.current = {
      findOne: vi.fn(() => ({
        getClientRect: vi.fn(() => ({ x: 40, y: 100, width: 120, height: 40 })),
      })),
      width: vi.fn(() => 500),
    } as unknown as Konva.Stage;

    render(
      <ImageEditorContext.Provider value={createContextValue(dispatch)}>
        <SelectedTextStylePopover stageRef={stageRef} />
      </ImageEditorContext.Provider>,
    );

    expect(screen.getByRole('toolbar', { name: DEFAULT_LOCALE.selectedText })).not.toBeNull();

    fireEvent.click(screen.getByTitle(DEFAULT_LOCALE.bold));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ANNOTATION_COMMIT',
      id: 'text-1',
      updates: {
        fontStyle: 'bold',
        width: getPreferredTextAnnotationWidth({
          text: 'Hello',
          fontSize: 24,
          fontStyle: 'bold',
          width: 160,
        }),
      },
    });
  });

  it('does not render while the selected text is being edited', () => {
    const stageRef = createRef<Konva.Stage | null>();
    stageRef.current = {
      findOne: vi.fn(() => ({
        getClientRect: vi.fn(() => ({ x: 40, y: 100, width: 120, height: 40 })),
      })),
      width: vi.fn(() => 500),
    } as unknown as Konva.Stage;

    const context = createContextValue();
    context.state = {
      ...context.state,
      editingTextId: 'text-1',
    };

    render(
      <ImageEditorContext.Provider value={context}>
        <SelectedTextStylePopover stageRef={stageRef} />
      </ImageEditorContext.Provider>,
    );

    expect(screen.queryByRole('toolbar', { name: DEFAULT_LOCALE.selectedText })).toBeNull();
  });
});
