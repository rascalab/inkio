// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { IMAGE_BLOCK_CAPTION_DEBOUNCE_MS, ImageBlockView } from '../ImageBlockView';

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
      vi.advanceTimersByTime(IMAGE_BLOCK_CAPTION_DEBOUNCE_MS);
    });
    expect(props.updateAttributes).toHaveBeenCalledTimes(1);
    expect(props.updateAttributes).toHaveBeenCalledWith({ caption: 'hello' });
  });

  it('drops a pending commit when the caption changes externally', () => {
    const props = createProps('');
    const { rerender } = render(<ImageBlockView {...props} />);
    const input = screen.getByPlaceholderText('Write a caption...');

    fireEvent.change(input, { target: { value: 'draft' } });
    rerender(
      <ImageBlockView
        {...props}
        node={{ ...props.node, attrs: { ...props.node.attrs, caption: 'external' } } as never}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(IMAGE_BLOCK_CAPTION_DEBOUNCE_MS + 100);
    });
    // The stale draft must not overwrite the external value.
    expect(props.updateAttributes).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText('Write a caption...') as HTMLInputElement).value).toBe(
      'external',
    );
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
