// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { CodeBlockView, legacyCopyText } from '../CodeBlock/CodeBlockView';

function createProps(): NodeViewProps {
  return {
    node: {
      attrs: { language: 'typescript' },
      textContent: 'const a = 1;',
    },
    updateAttributes: vi.fn(),
    editor: { isEditable: false },
  } as unknown as NodeViewProps;
}

describe('CodeBlockView copy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows copied state on clipboard success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<CodeBlockView {...createProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });
    expect(writeText).toHaveBeenCalledWith('const a = 1;');
  });

  it('falls back to execCommand when the async clipboard rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    render(<CodeBlockView {...createProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('shows a visible error state instead of a silent no-op when copy is blocked', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true });

    render(<CodeBlockView {...createProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy failed — try again' })).toBeTruthy();
    });
  });

  it('legacyCopyText returns false when execCommand is unavailable', () => {
    Object.defineProperty(document, 'execCommand', {
      value: () => {
        throw new Error('not supported');
      },
      configurable: true,
    });
    expect(legacyCopyText('hello')).toBe(false);
  });
});
