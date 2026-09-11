// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorModal } from '../ImageEditorModal';

const { imageEditorSpy } = vi.hoisted(() => ({
  imageEditorSpy: vi.fn(),
}));

vi.mock('../ImageEditor', () => ({
  ImageEditor: (props: unknown) => {
    imageEditorSpy(props);
    return <div data-testid="inkio-ie-modal-image-editor" />;
  },
}));

describe('ImageEditorModal locale merging', () => {
  beforeEach(() => {
    imageEditorSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('accepts partial locale overrides without requiring sentinel keys', async () => {
    render(
      <ImageEditorModal
        isOpen
        imageSrc="/demo.png"
        onSave={vi.fn()}
        onClose={vi.fn()}
        locale={{ closeConfirm: 'Keep your edits?' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('inkio-ie-modal-image-editor')).toBeTruthy();
    });

    const lastCall = imageEditorSpy.mock.calls[imageEditorSpy.mock.calls.length - 1];
    const lastProps = lastCall?.[0] as { locale: Record<string, string> } | undefined;
    expect(lastProps?.locale.closeConfirm).toBe('Keep your edits?');
    expect(lastProps?.locale.crop).toBe('Crop');
  });

  it('closes immediately when there are no unsaved edits', () => {
    const onClose = vi.fn();
    render(
      <ImageEditorModal
        isOpen
        imageSrc="/demo.png"
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const lastCall = imageEditorSpy.mock.calls[imageEditorSpy.mock.calls.length - 1];
    const props = lastCall?.[0] as { onCancel: () => void };
    act(() => {
      props.onCancel();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('inkio-ie-discard-confirm')).toBeNull();
  });

  it('shows a non-blocking confirm instead of window.confirm when dirty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const onClose = vi.fn();
    render(
      <ImageEditorModal
        isOpen
        imageSrc="/demo.png"
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const firstCall = imageEditorSpy.mock.calls[imageEditorSpy.mock.calls.length - 1];
    const firstProps = firstCall?.[0] as {
      onCancel: () => void;
      onDirtyChange: (dirty: boolean) => void;
    };
    act(() => {
      firstProps.onDirtyChange(true);
    });

    // Re-read props after the dirty-state re-render (fresh requestClose closure).
    const dirtyCall = imageEditorSpy.mock.calls[imageEditorSpy.mock.calls.length - 1];
    const props = dirtyCall?.[0] as { onCancel: () => void };
    act(() => {
      props.onCancel();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('inkio-ie-discard-confirm')).toBeTruthy();

    // Cancel keeps the editor open.
    fireEvent.click(screen.getByTestId('inkio-ie-discard-confirm-cancel'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('inkio-ie-discard-confirm')).toBeNull();

    // Discard closes the modal.
    const reopenCall = imageEditorSpy.mock.calls[imageEditorSpy.mock.calls.length - 1];
    const reopenProps = reopenCall?.[0] as { onCancel: () => void };
    act(() => {
      reopenProps.onCancel();
    });
    fireEvent.click(screen.getByTestId('inkio-ie-discard-confirm-ok'));
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
