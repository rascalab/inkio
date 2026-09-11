// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { ImageBlockView } from '../ImageBlockView';

function createProps(caption = ''): NodeViewProps & { updateAttributes: ReturnType<typeof vi.fn> } {
  const updateAttributes = vi.fn();
  return {
    node: {
      attrs: { caption, width: '100%', src: 'https://example.com/a.png', alt: 'a', align: 'center' },
    },
    updateAttributes,
    selected: false,
    editor: {
      isEditable: true,
      on: vi.fn(),
      off: vi.fn(),
    },
    extension: { options: {} },
  } as unknown as NodeViewProps & { updateAttributes: ReturnType<typeof vi.fn> };
}

describe('ImageBlockView caption', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not dispatch updateAttributes on every keystroke', () => {
    const props = createProps('');
    render(<ImageBlockView {...props} />);
    const input = screen.getByPlaceholderText('Write a caption...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(props.updateAttributes).not.toHaveBeenCalled();
    // Live preview still follows typing.
    expect(input.value).toBe('ab');
  });

  it('commits the caption after a pause (debounce)', () => {
    const props = createProps('');
    render(<ImageBlockView {...props} />);
    const input = screen.getByPlaceholderText('Write a caption...');

    fireEvent.change(input, { target: { value: 'hello' } });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(props.updateAttributes).toHaveBeenCalledTimes(1);
    expect(props.updateAttributes).toHaveBeenCalledWith({ caption: 'hello' });
  });

  it('commits the caption on blur', () => {
    const props = createProps('');
    render(<ImageBlockView {...props} />);
    const input = screen.getByPlaceholderText('Write a caption...');

    fireEvent.change(input, { target: { value: 'draft' } });
    fireEvent.blur(input);
    expect(props.updateAttributes).toHaveBeenCalledWith({ caption: 'draft' });
  });
});
