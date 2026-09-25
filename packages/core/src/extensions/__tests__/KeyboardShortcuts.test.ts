import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { KeyboardShortcuts } from '../KeyboardShortcuts';

function createMockEditor(commandName?: string) {
  const chain = {
    focus: vi.fn(() => chain),
    run: vi.fn(() => true),
  } as Record<string, any>;

  if (commandName) {
    chain[commandName] = vi.fn((value?: unknown) => {
      if (value !== undefined) {
        chain.lastArg = value;
      }
      return chain;
    });
  }

  const editor = {
    chain: vi.fn(() => chain),
  } as unknown as Editor;

  return { editor, chain };
}

describe('KeyboardShortcuts extension', () => {
  it('runs optional core commands when they are available', () => {
    const shortcuts = KeyboardShortcuts.config.addKeyboardShortcuts!.call({} as never);
    const { editor, chain } = createMockEditor('setHeading');

    const didRun = shortcuts['Mod-Alt-1']({ editor });

    expect(didRun).toBe(true);
    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.setHeading).toHaveBeenCalledWith({ level: 1 });
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('returns false without throwing when an optional command is missing', () => {
    const shortcuts = KeyboardShortcuts.config.addKeyboardShortcuts!.call({} as never);
    const { editor, chain } = createMockEditor();

    expect(() => shortcuts['Mod-Shift-h']({ editor })).not.toThrow();
    expect(shortcuts['Mod-Shift-h']({ editor })).toBe(false);
    expect(chain.focus).toHaveBeenCalled();
    expect(chain.run).not.toHaveBeenCalled();
  });

  it('refuses block mutation in a read-only editor', () => {
    const shortcuts = KeyboardShortcuts.config.addKeyboardShortcuts!.call({} as never);
    const dispatch = vi.fn();
    const editor = { isEditable: false, view: { dispatch } } as unknown as Editor;
    expect(shortcuts['Mod-d']({ editor })).toBe(false);
    expect(shortcuts['Mod-Shift-ArrowUp']({ editor })).toBe(false);
    expect(shortcuts['Mod-Shift-ArrowDown']({ editor })).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still duplicates the current block when editable', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, KeyboardShortcuts],
      content: '<p>one</p>',
    });
    const shortcuts = KeyboardShortcuts.config.addKeyboardShortcuts!.call({} as never);

    expect(shortcuts['Mod-d']({ editor })).toBe(true);
    expect(editor.getHTML()).toBe('<p>one</p><p>one</p>');
    editor.destroy();
  });
});
