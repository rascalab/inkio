// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
});
