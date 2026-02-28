import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkInputPopover } from '../BubbleMenu/LinkInputPopover';

describe('LinkInputPopover', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render input with type="text" allowing relative URLs', () => {
    render(<LinkInputPopover {...defaultProps} />);
    const input = screen.getByPlaceholderText('https://example.com');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('should accept relative paths', async () => {
    const onSave = vi.fn();
    render(<LinkInputPopover {...defaultProps} onSave={onSave} />);
    const input = screen.getByPlaceholderText('https://example.com');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, '/about');

    const form = input.closest('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith('/about');
  });

  it('should accept hash URLs', async () => {
    const onSave = vi.fn();
    render(<LinkInputPopover {...defaultProps} onSave={onSave} />);
    const input = screen.getByPlaceholderText('https://example.com');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, '#section-1');

    const form = input.closest('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith('#section-1');
  });
});
