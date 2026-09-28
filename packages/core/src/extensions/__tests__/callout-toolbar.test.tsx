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

  it('lets the icon input take focus on mouse click', () => {
    const { container, unmount } = render(
      <CalloutToolbar editor={stubEditor()} currentColor={null} currentIcon="😀" />,
    );
    try {
      // jsdom performs no default focus on mousedown: assert on the event
      // itself. Old code preventDefaulted every mousedown (input unfocusable).
      const onInput = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      iconInput().dispatchEvent(onInput);
      expect(onInput.defaultPrevented).toBe(false);
      const button = container.querySelector('button');
      const onButton = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      button!.dispatchEvent(onButton);
      expect(onButton.defaultPrevented).toBe(true);
    } finally {
      unmount();
    }
  });
});
