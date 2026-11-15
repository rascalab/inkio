// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByTestId('inkio-ie-root').dataset.debugActiveTool).toBe('draw');
    });
  });

  it('exposes popover controls to assistive technology inside the editor', async () => {
    render(
      <ImageEditor
        src="first-image"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        tools={['draw']}
        defaultTool="draw"
      />,
    );

    fireEvent.click(await screen.findByTestId('inkio-ie-draw-brush-size-range-trigger'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(screen.getByRole('slider'))).toBe(true);
  });

  it('allows replacing a dimension and applies integer pixels while typing', async () => {
    render(<ImageEditor src="first-image" onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('inkio-ie-resize-dimensions-trigger'));
    const width = screen.getByTestId<HTMLInputElement>('inkio-ie-resize-width');
    fireEvent.focus(width);
    fireEvent.change(width, { target: { value: '' } });
    expect(width.value).toBe('');
    fireEvent.change(width, { target: { value: '210.6' } });
    expect(screen.getByTestId('inkio-ie-root').dataset.debugOutputSize).toBe('211x158');
    fireEvent.blur(width);
    expect(width.value).toBe('211');
  });

  it.each([
    { field: 'width', sizes: ['2x1', '20x13', '200x129'] },
    { field: 'height', sizes: ['3x2', '31x20', '311x200'] },
  ])('keeps the locked ratio through sequential $field input', async ({ field, sizes }) => {
    loadImageMock.mockResolvedValueOnce({ naturalWidth: 560, naturalHeight: 360 });
    render(<ImageEditor src="first-image" onSave={vi.fn()} onCancel={vi.fn()} />);
    const trigger = await screen.findByTestId('inkio-ie-resize-dimensions-trigger');
    await waitFor(() => expect(trigger.textContent).toContain('560 × 360'));
    fireEvent.click(trigger);
    const input = screen.getByTestId<HTMLInputElement>(`inkio-ie-resize-${field}`);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    for (const [index, value] of ['2', '20', '200'].entries()) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByTestId('inkio-ie-root').dataset.debugOutputSize).toBe(sizes[index]);
    }
  });
});
