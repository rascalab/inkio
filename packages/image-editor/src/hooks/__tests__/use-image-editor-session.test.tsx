// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorProvider } from '../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../constants';
import { useImageEditor } from '../use-image-editor';
import { useImageEditorSession } from '../use-image-editor-session';

const { exportToDataURLMock, loadImageMock } = vi.hoisted(() => ({
  exportToDataURLMock: vi.fn(),
  loadImageMock: vi.fn(),
}));

vi.mock('../../utils/image-loader', () => ({
  loadImage: loadImageMock,
}));

vi.mock('../use-canvas-export', () => ({
  useCanvasExport: () => ({
    exportToDataURL: exportToDataURLMock,
  }),
}));

function SessionHarness({
  onDirtyChange,
  onSave,
}: {
  onDirtyChange: (dirty: boolean) => void;
  onSave: (dataUrl: string) => void;
}) {
  const { dispatch } = useImageEditor();
  const session = useImageEditorSession({
    src: 'fixture-image',
    locale: DEFAULT_LOCALE,
    outputFormat: 'png',
    outputQuality: 0.92,
    onSave,
    onDirtyChange,
    viewportKind: 'desktop',
  });

  return (
    <div>
      <button
        type="button"
        data-testid="make-dirty"
        onClick={() => dispatch({
          type: 'ADD_ANNOTATION',
          annotation: {
            id: 'rect-1',
            type: 'rect',
            x: 16,
            y: 16,
            width: 120,
            height: 80,
            fill: 'transparent',
            stroke: '#111827',
            strokeWidth: 2,
            rotation: 0,
          },
        })}
      >
        dirty
      </button>
      <button
        type="button"
        data-testid="save"
        onClick={() => {
          void session.handleSave();
        }}
      >
        save
      </button>
      <span data-testid="is-dirty">{session.isDirty ? 'true' : 'false'}</span>
    </div>
  );
}

describe('useImageEditorSession', () => {
  beforeEach(() => {
    loadImageMock.mockReset();
    exportToDataURLMock.mockReset();
    loadImageMock.mockResolvedValue({
      naturalWidth: 640,
      naturalHeight: 480,
    } as HTMLImageElement);
    exportToDataURLMock.mockResolvedValue('data:image/png;base64,saved');
  });

  afterEach(() => {
    cleanup();
  });

  it('resets the dirty baseline after a successful save', async () => {
    const onDirtyChange = vi.fn();
    const onSave = vi.fn();

    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={onDirtyChange} onSave={onSave} />
      </ImageEditorProvider>,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledWith('fixture-image');
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
    });

    fireEvent.click(screen.getByTestId('make-dirty'));
    await waitFor(() => {
      expect(screen.getByTestId('is-dirty').textContent).toBe('true');
    });

    fireEvent.click(screen.getByTestId('save'));
    await waitFor(() => {
      expect(exportToDataURLMock).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('data:image/png;base64,saved');
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
    });

    expect(onDirtyChange).toHaveBeenCalledWith(true);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
