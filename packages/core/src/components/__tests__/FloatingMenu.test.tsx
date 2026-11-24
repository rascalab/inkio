import { act, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { FloatingMenu } from '../FloatingMenu';

describe('FloatingMenu component', () => {
  it('should render null when editor is null', () => {
    const { container } = render(<FloatingMenu editor={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should always render DOM when editor is provided (visibility pattern)', () => {
    const mockEditor = {
      state: {
        selection: { from: 0, empty: true },
        doc: {
          resolve: () => ({
            parent: { type: { name: 'paragraph' }, textContent: '' },
          }),
        },
      },
      view: {
        coordsAtPos: () => ({ top: 100, left: 50 }),
        dom: {
          getBoundingClientRect: () => ({ top: 0, left: 0, width: 500 }),
        },
      },
      on: vi.fn(),
      off: vi.fn(),
      isActive: () => false,
      chain: () => ({
        focus: () => ({
          toggleHeading: () => ({ run: () => { } }),
          toggleBulletList: () => ({ run: () => { } }),
          toggleOrderedList: () => ({ run: () => { } }),
          toggleTaskList: () => ({ run: () => { } }),
          toggleCallout: () => ({ run: () => { } }),
          toggleCodeBlock: () => ({ run: () => { } }),
          setHorizontalRule: () => ({ run: () => { } }),
        }),
      }),
    } as any;

    const { container } = render(<FloatingMenu editor={mockEditor} />);
    // Should render the menu div even when not visible (visibility: hidden)
    const menuDiv = container.firstChild as HTMLElement;
    expect(menuDiv).not.toBeNull();
    expect(menuDiv.className).toContain('inkio-floating-overlay');
    expect(menuDiv.className).not.toContain('is-visible');
  });

  it('applies floating item transforms', () => {
    const mockEditor = {
      state: {
        selection: { from: 0, empty: true },
        doc: {
          resolve: () => ({
            parent: { type: { name: 'paragraph' }, textContent: '' },
            depth: 1,
            node: () => ({ type: { name: 'paragraph' } }),
          }),
        },
      },
      view: {
        coordsAtPos: () => ({ top: 100, left: 50, right: 60, bottom: 120 }),
        dom: {
          getBoundingClientRect: () => ({ top: 0, left: 0, right: 500, bottom: 400, width: 500, height: 400 }),
        },
      },
      extensionManager: {
        extensions: [{ name: 'heading' }],
      },
      on: vi.fn(),
      off: vi.fn(),
      isActive: () => false,
      chain: () => ({
        focus: () => ({
          toggleHeading: () => ({ run: () => {} }),
        }),
      }),
    } as any;

    const { queryByLabelText } = render(
      <FloatingMenu
        editor={mockEditor}
        items={(defaults) => defaults.filter((action) => action.id === 'heading1')}
      />,
    );

    expect(queryByLabelText('Heading 1')).not.toBeNull();
    expect(queryByLabelText('Heading 2')).toBeNull();
  });

  describe('focus ownership', () => {
    let editor: Editor;
    let parent: HTMLElement;

    function open() {
      parent = document.body.appendChild(document.createElement('div'));
      editor = new Editor({ element: parent, extensions: [Document, Paragraph, Text] });
      vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue(new DOMRect());
      const run = vi.fn();
      const ui = render(<>
        <FloatingMenu editor={editor} items={() => [
          { id: 'disabled', label: 'Disabled', iconId: 'heading1', group: 'test', surfaces: ['floating'], isDisabled: () => true, run },
          { id: 'first', label: 'First', iconId: 'heading1', group: 'test', surfaces: ['floating'], run },
          { id: 'last', label: 'Last', iconId: 'heading2', group: 'test', surfaces: ['floating'], run },
        ]} />
        <input aria-label="Outside" />
      </>);
      act(() => editor.view.dom.focus());
      return { ...ui, run, first: ui.getByLabelText('First'), last: ui.getByLabelText('Last') };
    }

    afterEach(() => {
      editor.destroy();
      parent.remove();
      vi.useRealTimers();
    });

    it('leaves keys in the editor after focus returns from the toolbar', () => {
      vi.useFakeTimers();
      const { first, run, container } = open();
      act(() => first.focus());
      act(() => editor.view.dom.focus());
      fireEvent.keyDown(editor.view.dom, { key: 'ArrowRight' });
      expect(editor.view.dom).toHaveFocus();
      fireEvent.compositionStart(editor.view.dom);
      fireEvent.keyDown(editor.view.dom, { key: 'Enter', isComposing: true });
      expect(run).not.toHaveBeenCalled();
      fireEvent.compositionEnd(editor.view.dom);
      act(() => vi.advanceTimersToNextFrame());
      expect(container.firstChild).toHaveClass('is-visible');
    });

    it('hides after keyboard focus leaves the toolbar for another control', () => {
      vi.useFakeTimers();
      const { first, getByLabelText, container } = open();
      act(() => first.focus());
      act(() => vi.advanceTimersToNextFrame());
      act(() => getByLabelText('Outside').focus());
      act(() => vi.advanceTimersToNextFrame());
      expect(container.firstChild).not.toHaveClass('is-visible');
    });

    it('keeps Escape dismissed at the same caret and returns focus to the editor', () => {
      vi.useFakeTimers();
      const { first, container } = open();
      act(() => first.focus());
      fireEvent.keyDown(first, { key: 'Escape' });
      act(() => vi.advanceTimersToNextFrame());
      expect(editor.view.dom).toHaveFocus();
      expect(container.firstChild).not.toHaveClass('is-visible');
      act(() => { editor.commands.splitBlock(); });
      expect(container.firstChild).toHaveClass('is-visible');
    });

    it('skips disabled buttons, ignores composing arrows, and activates with Space', async () => {
      const { first, last, run } = open();
      expect(first.tabIndex).toBe(0);
      act(() => first.focus());
      fireEvent.keyDown(first, { key: 'ArrowLeft', isComposing: true });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: 'ArrowLeft' });
      expect(last).toHaveFocus();
      await userEvent.keyboard(' ');
      expect(run).toHaveBeenCalledTimes(1);
    });
  });
});
