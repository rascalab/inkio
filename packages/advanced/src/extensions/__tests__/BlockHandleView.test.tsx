import { fireEvent, render, screen } from '@testing-library/react';
import { getExtensions } from '@inkio/core';
import { Editor } from '@tiptap/core';
import { BlockHandleActionMenu, fingerprintBlockAt } from '../BlockHandle';

const anchorRect = { top: 20, left: 20, right: 60, bottom: 60, width: 40, height: 40 };
let editor: Editor;

beforeEach(() => {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: getExtensions(),
    content: '<p>Keep this</p><p>Target block</p>',
  });
});

afterEach(() => editor.destroy());

function openMenu(blockPos = editor.state.doc.firstChild!.nodeSize) {
  return render(<BlockHandleActionMenu
    editor={editor}
    blockPos={blockPos}
    blockFingerprint={fingerprintBlockAt(editor.state.doc, blockPos)}
    anchorRect={anchorRect}
    onClose={() => undefined}
  />);
}

describe('BlockHandleActionMenu', () => {
  it('focuses the menu as soon as it mounts so the first key reaches it', () => {
    openMenu();
    expect(document.activeElement).toBe(screen.getByRole('menu'));
  });

  it('converts the block beside the handle rather than the current selection', () => {
    editor.commands.setTextSelection(2);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Heading 1' }));

    expect(editor.getHTML()).toBe('<p>Keep this</p><h1>Target block</h1>');
  });

  it('does not convert a different block when the original target changes', () => {
    openMenu();
    editor.commands.setContent('<p>Keep this</p><p>Replacement</p>');
    editor.commands.setTextSelection(2);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Heading 1' }));

    expect(editor.getHTML()).toBe('<p>Keep this</p><p>Replacement</p>');
  });

  it('deletes the target but preserves its neighbor', () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(editor.getHTML()).toBe('<p>Keep this</p>');
  });

  it('does not expose the menu when the editor is read-only', () => {
    editor.setEditable(false);
    openMenu();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
