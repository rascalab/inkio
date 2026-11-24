import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { BubbleMenu } from '../BubbleMenu';
import { Toolbar } from '../Toolbar';
import { BubbleMenuLinkInputPopover } from '../BubbleMenuLinkInputPopover';

describe('BubbleMenuLinkInputPopover', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render input with type="text" allowing relative URLs', () => {
    render(<BubbleMenuLinkInputPopover {...defaultProps} />);
    const input = screen.getByPlaceholderText('https://example.com');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('should accept relative paths', () => {
    const onSave = vi.fn();
    render(<BubbleMenuLinkInputPopover {...defaultProps} onSave={onSave} />);
    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(input, { target: { value: '/about' } });

    const form = input.closest('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith('/about');
  });

  it('should accept hash URLs', () => {
    const onSave = vi.fn();
    render(<BubbleMenuLinkInputPopover {...defaultProps} onSave={onSave} />);
    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(input, { target: { value: '#section-1' } });

    const form = input.closest('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith('#section-1');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload="alert(1)">',
    'vbscript:msgbox(1)',
  ])('should block unsafe URL %s with an inline error', (unsafeUrl) => {
    const onSave = vi.fn();
    render(<BubbleMenuLinkInputPopover {...defaultProps} onSave={onSave} />);
    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(input, { target: { value: unsafeUrl } });

    const form = input.closest('form')!;
    // fireEvent wraps dispatch in act() so the inline error state flushes.
    fireEvent.submit(form);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

it.each([['toolbar', Toolbar], ['bubble', BubbleMenu]] as const)(
  '%s restores the edited link selection without taking focus from a reopened field',
  async (_surface, Menu) => {
    const mount = document.body.appendChild(document.createElement('div'));
    const editor = new Editor({
      element: mount,
      extensions: [Document, Paragraph, Text, Link],
      content: '<p><a href="/old">linked text</a></p>',
    });
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue(new DOMRect());
    const ui = render(<Menu editor={editor} />);
    try {
      act(() => {
        editor.commands.setTextSelection({ from: 2, to: 5 });
        editor.view.focus();
      });
      const trigger = ui.getByRole('button', { name: 'Add link' });
      fireEvent.click(trigger);
      const field = within(await ui.findByRole('dialog')).getByRole('textbox');
      expect(field).toHaveFocus();
      fireEvent.change(field, { target: { value: '/new' } });

      // Reopen before either Radix's unmount timer or Tiptap's focus frame.
      vi.useFakeTimers();
      fireEvent.click(ui.getByRole('button', { name: 'Save' }));
      expect(editor.view.dom).toHaveFocus();
      expect(window.getSelection()?.toString()).toBe('linked text');
      fireEvent.click(trigger);
      const reopened = within(ui.getByRole('dialog')).getByRole('textbox');
      expect(reopened).toHaveValue('/new');
      act(() => { vi.advanceTimersToNextFrame(); });
      expect(reopened).toHaveFocus();
    } finally {
      ui.unmount();
      if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
      vi.useRealTimers();
      editor.destroy();
      mount.remove();
    }
  },
);
