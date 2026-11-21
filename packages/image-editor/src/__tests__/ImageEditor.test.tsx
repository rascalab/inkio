// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditor } from '../ImageEditor';
import type { ImageEditorCustomTool, ImageEditorToolActions } from '../types';

const { exportCanvasMock, loadImageMock } = vi.hoisted(() => ({
  exportCanvasMock: vi.fn(),
  loadImageMock: vi.fn(),
}));

vi.mock('../utils/image-loader', () => ({
  loadImage: loadImageMock,
}));

vi.mock('../utils/export-canvas', () => ({
  exportCanvas: exportCanvasMock,
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
    exportCanvasMock.mockReset();
    exportCanvasMock.mockResolvedValue('data:image/png;base64,edited');
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

  it('keeps a selected custom tool across reordering and falls back when it is removed', async () => {
    const custom: ImageEditorCustomTool = {
      id: 'photo-preset',
      label: 'Photo preset',
      renderControls: ({ actions, filter }) => (
        <button type="button" aria-pressed={filter === 'grayscale'} onClick={() => actions.setFilter('grayscale')}>
          Monochrome
        </button>
      ),
    };
    const duplicate = { ...custom, label: 'Duplicate preset' };
    const props = { src: 'first-image', onSave: vi.fn(), onCancel: vi.fn(), defaultTool: custom.id };
    const reserved = { ...custom, id: 'resize', label: 'Reserved name' };
    const { rerender } = render(<ImageEditor {...props} tools={['rotate', custom, reserved, 'crop', 'resize', duplicate]} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Image editor tools' });
    expect([...toolbar.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')))
      .toEqual(['Rotate', 'Photo preset', 'Resize']);
    const monochrome = await screen.findByRole('button', { name: 'Monochrome' });
    await waitFor(() => expect(monochrome.closest('fieldset')?.disabled).toBe(false));
    fireEvent.click(monochrome);
    expect(monochrome.getAttribute('aria-pressed')).toBe('true');

    rerender(<ImageEditor {...props} tools={['resize', custom, 'rotate']} />);
    expect(screen.getByRole('button', { name: 'Photo preset' }).getAttribute('aria-pressed')).toBe('true');
    rerender(<ImageEditor {...props} tools={['rotate', 'crop']} />);
    expect(screen.getByRole('button', { name: 'Resize' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Monochrome' })).toBeNull();
    fireEvent.click(screen.getByTestId('inkio-ie-undo'));
    expect(screen.getByRole('button', { name: 'Resize' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('inkio-ie-root').dataset.debugFilter).toBe('none');

    rerender(<ImageEditor {...props} tools={[custom, 'rotate', 'crop']} />);
    expect(screen.getByRole('button', { name: 'Resize' }).getAttribute('aria-pressed')).toBe('true');

    rerender(<ImageEditor {...props} tools={[]} />);
    expect(screen.queryByRole('toolbar', { name: 'Image editor tools' })).toBeNull();
    expect(screen.getByTestId('inkio-ie-root').dataset.debugActiveTool).toBe('');
  });

  it('applies custom geometry actions to the same draft and undoes the output size', async () => {
    const custom: ImageEditorCustomTool = {
      id: 'geometry',
      label: 'Geometry',
      renderControls: ({ actions, adjustments, outputSize, transform }) => (
        <>
          <button type="button" onClick={() => {
            actions.setFilter('sepia');
            actions.setAdjustments({ brightness: 0.25 });
            actions.setCrop({ x: 5, y: 8, width: 200, height: 100 });
            actions.rotate('clockwise');
            actions.flip('horizontal');
            actions.setOutputSize({ width: 320, height: 180 });
          }}>
            Apply geometry preset
          </button>
          <output data-testid="custom-geometry">
            {`${outputSize.width}x${outputSize.height}; ${transform.rotation}; ${transform.flipX}; ${transform.crop?.x}; ${adjustments.brightness}`}
          </output>
        </>
      ),
    };
    render(<ImageEditor src="first-image" onSave={vi.fn()} onCancel={vi.fn()} tools={[custom]} />);
    const preset = await screen.findByRole('button', { name: 'Apply geometry preset' });
    await waitFor(() => expect(preset.closest('fieldset')?.disabled).toBe(false));
    fireEvent.click(preset);
    expect(screen.getByTestId('custom-geometry').textContent).toBe('320x180; 90; true; 5; 0.25');
    fireEvent.click(screen.getByTestId('inkio-ie-undo'));
    expect(screen.getByTestId('custom-geometry').textContent).toBe('100x200; 90; true; 5; 0.25');
    // Undo the flip, quarter turn, crop, and finetune without undoing the filter.
    for (let step = 0; step < 4; step++) fireEvent.click(screen.getByTestId('inkio-ie-undo'));
    expect(screen.getByTestId('custom-geometry').textContent).toBe('640x480; 0; false; undefined; 0');
    expect(screen.getByTestId('inkio-ie-root').dataset.debugFilter).toBe('sepia');
  });

  it('disables tools during saving and ignores retained actions after switching tools', async () => {
    let retainedActions: ImageEditorToolActions | undefined;
    let releaseSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { releaseSave = resolve; }));
    const custom: ImageEditorCustomTool = {
      id: 'filters',
      label: 'Custom filters',
      renderControls: ({ actions }) => {
        retainedActions = actions;
        return <button type="button" onClick={() => actions.setFilter('grayscale')}>Monochrome</button>;
      },
    };
    render(<ImageEditor src="first-image" onSave={onSave} onCancel={vi.fn()} tools={[custom, 'rotate']} />);
    const preset = await screen.findByRole('button', { name: 'Monochrome' });
    const fieldset = preset.closest('fieldset');
    await waitFor(() => expect(fieldset?.disabled).toBe(false));
    fireEvent.click(preset);
    fireEvent.click(screen.getByTestId('inkio-ie-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const root = screen.getByTestId('inkio-ie-root');
    const rotate = screen.getByTestId<HTMLButtonElement>('inkio-ie-tool-rotate');
    expect(rotate.disabled).toBe(true);
    expect(fieldset?.disabled).toBe(true);
    expect(fieldset?.hasAttribute('inert')).toBe(true);
    act(() => retainedActions?.setFilter('sepia'));
    expect(root.dataset.debugFilter).toBe('grayscale');

    await act(async () => { releaseSave?.(); });
    expect(rotate.disabled).toBe(false);
    fireEvent.click(rotate);
    act(() => retainedActions?.setFilter('sepia'));
    expect(root.dataset.debugFilter).toBe('grayscale');
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
    expect(dialog.contains(screen.getByRole('slider', { name: 'Brush size' }))).toBe(true);
  });

  it('undoes only in the focused editor and ignores input outside both editors', async () => {
    const { getAllByTestId } = render(
      <>
        <ImageEditor src="first-image" onSave={vi.fn()} onCancel={vi.fn()} tools={['rotate']} />
        <ImageEditor src="second-image" onSave={vi.fn()} onCancel={vi.fn()} tools={['rotate']} />
      </>,
    );
    const roots = getAllByTestId('inkio-ie-root');
    await waitFor(() => expect(roots.map((root) => root.dataset.debugImageWidth)).toEqual(['640', '640']));
    const rotate = getAllByTestId('inkio-ie-rotate-cw');
    rotate.forEach((button) => fireEvent.click(button));
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(roots.map((root) => root.dataset.debugDirty)).toEqual(['true', 'true']);
    rotate[1].focus();
    fireEvent.keyDown(rotate[1], { key: 'z', ctrlKey: true });
    expect(roots.map((root) => root.dataset.debugDirty)).toEqual(['true', 'false']);
  });

  it('rejects dimensions beyond the output budget without changing the image', async () => {
    render(<ImageEditor src="first-image" onSave={vi.fn()} onCancel={vi.fn()} />);
    const trigger = await screen.findByTestId('inkio-ie-resize-dimensions-trigger');
    await waitFor(() => expect(trigger.textContent).toContain('640 × 480'));
    fireEvent.click(trigger);
    const width = screen.getByTestId<HTMLInputElement>('inkio-ie-resize-width');
    fireEvent.focus(width);
    fireEvent.change(width, { target: { value: '5000' } });
    expect(width.getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(width);
    expect(width.value).toBe('640');
    expect(screen.getByTestId('inkio-ie-root').dataset.debugDirty).toBe('false');
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
