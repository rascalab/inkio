import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { CalloutToolbar } from '../callout-toolbar-plugin';

function stubEditor() {
  return {
    commands: {
      updateCalloutIcon: vi.fn(),
      updateCalloutColor: vi.fn(),
      updateAttributes: vi.fn(),
    },
  } as unknown as Editor;
}

function iconInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Icon') as HTMLInputElement;
}

describe('CalloutToolbar icon input', () => {
  it('follows the selected callout instead of sticking to the first', () => {
    const { rerender, unmount } = render(
      <CalloutToolbar editor={stubEditor()} currentColor={null} currentIcon="😀" />,
    );
    try {
      expect(iconInput().value).toBe('😀');
      rerender(<CalloutToolbar editor={stubEditor()} currentColor={null} currentIcon="🚀" />);
      expect(iconInput().value).toBe('🚀');
    } finally {
      unmount();
    }
  });
});
