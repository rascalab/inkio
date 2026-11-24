// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorModal } from '../ImageEditorModal';
import type { ImageEditorProps } from '../types';

let latestEditorProps: ImageEditorProps | undefined;

function editorProps(): ImageEditorProps {
  if (!latestEditorProps) throw new Error('Image editor has not rendered');
  return latestEditorProps;
}

const { imageEditorSpy } = vi.hoisted(() => ({
  imageEditorSpy: vi.fn(),
}));

vi.mock('../ImageEditor', () => ({
  ImageEditorWorkbench: (props: ImageEditorProps) => {
    latestEditorProps = props;
    imageEditorSpy(props);
    return <div data-testid="inkio-ie-modal-image-editor" />;
  },
}));

describe('ImageEditorModal locale merging', () => {
  beforeEach(() => {
    imageEditorSpy.mockReset();
    latestEditorProps = undefined;
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

  it('pins the portal theme so a dark page cannot leak into a light editor', () => {
    document.documentElement.classList.add('dark');
    try {
      render(<ImageEditorModal isOpen imageSrc="/demo.png" onSave={vi.fn()} onClose={vi.fn()} theme="light" />);
      const portal = document.querySelector('.inkio-ie-portal-theme')!;
      // tokens.css applies dark tokens to `.dark .inkio:not(.light)`.
      expect(portal.classList.contains('light')).toBe(true);
      expect(portal.classList.contains('dark')).toBe(false);
    } finally {
      document.documentElement.classList.remove('dark');
    }
  });

  it('follows a dark page when no theme is passed', () => {
    document.documentElement.classList.add('dark');
    try {
      render(<ImageEditorModal isOpen imageSrc="/demo.png" onSave={vi.fn()} onClose={vi.fn()} />);
      expect(document.querySelector('.inkio-ie-portal-theme')!.classList.contains('dark')).toBe(true);
    } finally {
      document.documentElement.classList.remove('dark');
    }
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
    expect(document.activeElement).toBe(screen.getByTestId('inkio-ie-discard-confirm-cancel'));

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

  it('starts clean when a persistent modal is reopened after discarding edits', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <ImageEditorModal isOpen imageSrc="/demo.png" onSave={onSave} onClose={onClose} />,
    );
    act(() => { editorProps().onDirtyChange?.(true); });
    rerender(<ImageEditorModal isOpen={false} imageSrc="/demo.png" onSave={onSave} onClose={onClose} />);
    rerender(<ImageEditorModal isOpen imageSrc="/demo.png" onSave={onSave} onClose={onClose} />);

    act(() => { editorProps().onCancel(); });

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
