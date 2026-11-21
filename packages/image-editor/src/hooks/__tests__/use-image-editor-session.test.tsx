// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorProvider } from '../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../constants';
import { useImageEditor } from '../use-image-editor';
import { useImageEditorSession } from '../use-image-editor-session';

const { exportCanvasMock, loadImageMock } = vi.hoisted(() => ({
  exportCanvasMock: vi.fn(),
  loadImageMock: vi.fn(),
}));

vi.mock('../../utils/image-loader', () => ({
  loadImage: loadImageMock,
}));

vi.mock('../../utils/export-canvas', () => ({
  exportCanvas: exportCanvasMock,
}));

function SessionHarness({
  onDirtyChange,
  onSave,
  onSaveBlob,
  savePreview,
}: {
  onDirtyChange: (dirty: boolean) => void;
  onSave: (dataUrl: string) => void | Promise<void>;
  onSaveBlob?: (blob: Blob, preview?: Blob) => void | Promise<void>;
  savePreview?: boolean;
}) {
  const { state, dispatch } = useImageEditor();
  const session = useImageEditorSession({
    src: 'fixture-image',
    locale: DEFAULT_LOCALE,
    outputFormat: 'png',
    outputQuality: 0.92,
    onSave,
    onSaveBlob,
    savePreview,
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
        data-testid="open-resize"
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'resize' })}
      >
        resize
      </button>
      <button
        type="button"
        data-testid="resize-draft"
        onClick={() => dispatch({ type: 'SET_RESIZE_OPTIONS', options: { width: 320, height: 240 } })}
      >
        change size
      </button>
      <button
        type="button"
        data-testid="crop-draft"
        onClick={() => dispatch({ type: 'SET_PENDING_CROP', crop: { x: 0, y: 0, width: 320, height: 240 } })}
      >
        crop
      </button>
      <span data-testid="has-crop-draft">{state.pendingCrop ? 'true' : 'false'}</span>
      <span data-testid="resize-draft-size">{state.resizeOptions.width}x{state.resizeOptions.height}</span>
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
      <span data-testid="is-saving">{session.isSaving ? 'true' : 'false'}</span>
      <span data-testid="has-save-error">{session.saveError ? 'true' : 'false'}</span>
      <span data-testid="annotation-count">{state.annotations.length}</span>
    </div>
  );
}

describe('useImageEditorSession', () => {
  beforeEach(() => {
    loadImageMock.mockReset();
    exportCanvasMock.mockReset();
    loadImageMock.mockResolvedValue({
      naturalWidth: 640,
      naturalHeight: 480,
    } as HTMLImageElement);
    exportCanvasMock.mockResolvedValue('data:image/png;base64,saved');
  });

  afterEach(() => {
    cleanup();
  });

  it('resets the dirty baseline after a successful save', async () => {
    const onDirtyChange = vi.fn();
    const onSave = vi.fn();

    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={onDirtyChange} onSave={onSave} savePreview />
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
      expect(exportCanvasMock).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('data:image/png;base64,saved');
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
      // onDirtyChange fires from an effect after the commit that updates
      // the DOM, so it is awaited too rather than asserted right after.
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it.each([false, true])('passes the encoded Blob only to the preferred callback (savePreview=%s)', async (savePreview) => {
    const blob = new Blob(['encoded image'], { type: 'image/png' });
    const preview = new Blob(['encoded preview'], { type: 'image/png' });
    exportCanvasMock.mockResolvedValueOnce(savePreview ? { blob, preview } : blob);
    const onSave = vi.fn();
    const onSaveBlob = vi.fn();
    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={vi.fn()} onSave={onSave} onSaveBlob={onSaveBlob} savePreview={savePreview} />
      </ImageEditorProvider>,
    );
    await waitFor(() => { expect(loadImageMock).toHaveBeenCalled(); });
    fireEvent.click(screen.getByTestId('make-dirty'));
    await act(async () => { fireEvent.click(screen.getByTestId('save')); });

    expect(exportCanvasMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ originalWidth: 640, originalHeight: 480 }),
      'png',
      0.92,
      savePreview ? 'blob-with-preview' : 'blob',
    );
    expect(onSaveBlob).toHaveBeenCalledExactlyOnceWith(...(savePreview ? [blob, preview] : [blob]));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('is-dirty').textContent).toBe('false');
  });

  it('is not dirty when the resize tool seeds its crop draft', async () => {
    const onDirtyChange = vi.fn();

    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={onDirtyChange} onSave={vi.fn()} />
      </ImageEditorProvider>,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledWith('fixture-image');
    });
    fireEvent.click(screen.getByTestId('open-resize'));

    await waitFor(() => {
      expect(screen.getByTestId('has-crop-draft').textContent).toBe('true');
    });
    expect(screen.getByTestId('is-dirty').textContent).toBe('false');
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it('keeps the dirty baseline until the async save finishes and ignores duplicate saves', async () => {
    let finishSave: () => void = () => { throw new Error('Save has not started'); };
    let started: () => void = () => { throw new Error('Save signal is missing'); };
    const saveStarted = new Promise<void>((resolve) => { started = resolve; });
    const upload = new Promise<void>((resolve) => { finishSave = resolve; });
    const onSave = vi.fn(() => { started(); return upload; });
    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={vi.fn()} onSave={onSave} />
      </ImageEditorProvider>,
    );
    await waitFor(() => { expect(loadImageMock).toHaveBeenCalled(); });
    fireEvent.click(screen.getByTestId('make-dirty'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('save'));
      await saveStarted;
    });
    fireEvent.click(screen.getByTestId('save'));

    expect(screen.getByTestId('is-saving').textContent).toBe('true');
    expect(screen.getByTestId('is-dirty').textContent).toBe('true');
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('annotation-count').textContent).toBe('1');
    await act(async () => { finishSave(); await upload; });
    expect(screen.getByTestId('is-saving').textContent).toBe('false');
    expect(screen.getByTestId('is-dirty').textContent).toBe('false');
  });

  it('counts uncommitted resize dimensions as edits', async () => {
    render(
      <ImageEditorProvider locale={DEFAULT_LOCALE}>
        <SessionHarness onDirtyChange={vi.fn()} onSave={vi.fn()} />
      </ImageEditorProvider>,
    );
    await waitFor(() => { expect(loadImageMock).toHaveBeenCalled(); });
    fireEvent.click(screen.getByTestId('open-resize'));
    await waitFor(() => { expect(screen.getByTestId('has-crop-draft').textContent).toBe('true'); });

    fireEvent.click(screen.getByTestId('resize-draft'));

    expect(screen.getByTestId('is-dirty').textContent).toBe('true');
  });

  it('preserves annotations and the dirty baseline when saving fails, then allows a retry', async () => {
    const error = new Error('Upload rejected');
    const failure = Promise.reject(error);
    void failure.catch(() => {});
    const onSave = vi.fn().mockReturnValueOnce(failure).mockResolvedValueOnce(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ImageEditorProvider locale={DEFAULT_LOCALE}>
          <SessionHarness onDirtyChange={vi.fn()} onSave={onSave} />
        </ImageEditorProvider>,
      );
      await waitFor(() => { expect(loadImageMock).toHaveBeenCalled(); });
      fireEvent.click(screen.getByTestId('make-dirty'));

      await act(async () => { fireEvent.click(screen.getByTestId('save')); });

      expect(screen.getByTestId('is-saving').textContent).toBe('false');
      expect(screen.getByTestId('is-dirty').textContent).toBe('true');
      expect(screen.getByTestId('annotation-count').textContent).toBe('1');
      expect(screen.getByTestId('has-save-error').textContent).toBe('true');
      await act(async () => { fireEvent.click(screen.getByTestId('save')); });
      expect(screen.getByTestId('has-save-error').textContent).toBe('false');
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
      expect(onSave).toHaveBeenCalledTimes(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('preserves the crop and resize draft when persistence fails', async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(new Error('Upload rejected'))
      .mockResolvedValueOnce(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ImageEditorProvider locale={DEFAULT_LOCALE}>
          <SessionHarness onDirtyChange={vi.fn()} onSave={onSave} />
        </ImageEditorProvider>,
      );
      await waitFor(() => { expect(loadImageMock).toHaveBeenCalled(); });
      fireEvent.click(screen.getByTestId('open-resize'));
      await waitFor(() => { expect(screen.getByTestId('has-crop-draft').textContent).toBe('true'); });
      fireEvent.click(screen.getByTestId('crop-draft'));
      const draftSize = screen.getByTestId('resize-draft-size').textContent;
      expect(draftSize).toBe('320x240');

      await act(async () => { fireEvent.click(screen.getByTestId('save')); });

      expect(screen.getByTestId('resize-draft-size').textContent).toBe(draftSize);
      expect(screen.getByTestId('has-crop-draft').textContent).toBe('true');
      expect(screen.getByTestId('has-save-error').textContent).toBe('true');
      expect(screen.getByTestId('is-dirty').textContent).toBe('true');
      await act(async () => { fireEvent.click(screen.getByTestId('save')); });
      expect(onSave).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
      expect(screen.getByTestId('has-crop-draft').textContent).toBe('false');
    } finally {
      consoleError.mockRestore();
    }
  });
});
