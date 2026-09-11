import { fireEvent, render, screen } from '@testing-library/react';
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
