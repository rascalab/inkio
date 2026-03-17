// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditor } from '../ImageEditor';

const { loadImageMock } = vi.hoisted(() => ({
  loadImageMock: vi.fn(),
}));

vi.mock('../utils/image-loader', () => ({
  loadImage: loadImageMock,
}));

vi.mock('../canvas/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="inkio-ie-canvas-mock" />,
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

describe('ImageEditor image loading', () => {
  beforeEach(() => {
    loadImageMock.mockReset();
    loadImageMock.mockResolvedValue({
      naturalWidth: 640,
      naturalHeight: 480,
    } as HTMLImageElement);

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reloads only when src changes', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ImageEditor
        src="first-image"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event('resize'));
    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ImageEditor
        src="first-image"
        onSave={onSave}
        onCancel={onCancel}
        locale={{ loading: 'Chargement...' }}
      />,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ImageEditor
        src="second-image"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledTimes(2);
    });

    expect(loadImageMock).toHaveBeenNthCalledWith(1, 'first-image');
    expect(loadImageMock).toHaveBeenNthCalledWith(2, 'second-image');
  });

  it('ignores a defaultTool that is not enabled', async () => {
    render(
      <ImageEditor
        src="first-image"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        tools={['draw']}
        defaultTool="text"
      />,
    );

    await waitFor(() => {
      expect(loadImageMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('inkio-ie-root').dataset.debugActiveTool).toBe('');
    });
  });
});
