// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageBlockView } from '../ImageBlockView';
import type { ImageEditorComponentProps } from '../ImageBlock';

let capturedSave: ((data: string) => void) | null = null;

function StubImageEditor(props: ImageEditorComponentProps) {
  capturedSave = props.onSave;
  return null;
}

type ViewProps = NodeViewProps & { updateAttributes: ReturnType<typeof vi.fn> };

function createProps(src: string): ViewProps {
  capturedSave = null;
  return {
    node: {
      attrs: { caption: '', width: '100%', src, alt: 'a', align: 'center' },
    },
    updateAttributes: vi.fn(),
    selected: false,
    editor: {
      isEditable: true,
      on: vi.fn(),
      off: vi.fn(),
    },
    extension: { options: { imageEditor: StubImageEditor } },
  } as unknown as ViewProps;
}

/**
 * The image editor component is a trust boundary (it may be third-party):
 * its output must pass isSafeUrl before reaching the document, and an
 * already-persisted unsafe src must never reach the DOM.
 */
describe('ImageBlockView src safety', () => {
  it('renders a safe src as an <img>', () => {
    const props = createProps('https://example.com/a.png');
    const { container } = render(<ImageBlockView {...props} />);
    const img = container.querySelector('img.inkio-image-block-img');
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders a placeholder instead of an <img> for a persisted unsafe src', () => {
    const props = createProps('javascript:alert(1)');
    const { container } = render(<ImageBlockView {...props} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.inkio-image-block-placeholder')).not.toBeNull();
  });

  it('persists editor output that passes validation', () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedSave).not.toBeNull();
    act(() => {
      capturedSave?.('https://example.com/edited.png');
    });
    expect(props.updateAttributes).toHaveBeenCalledWith({ src: 'https://example.com/edited.png' });
  });

  it('refuses editor output that fails validation', () => {
    const props = createProps('https://example.com/a.png');
    render(<ImageBlockView {...props} />);
    fireEvent.click(screen.getByTestId('inkio-image-block-edit'));
    expect(capturedSave).not.toBeNull();
    act(() => {
      capturedSave?.('javascript:alert(1)');
    });
    expect(props.updateAttributes).not.toHaveBeenCalled();
  });
});
