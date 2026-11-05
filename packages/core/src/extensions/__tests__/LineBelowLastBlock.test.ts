import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { LineBelowLastBlock } from '../LineBelowLastBlock';

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '앞' }] }, { type: 'horizontalRule' }],
};

describe('LineBelowLastBlock', () => {
  let editor: Editor;
  const create = (editable = true) => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, HorizontalRule, LineBelowLastBlock],
      content,
      editable,
    });
  };
  const types = () => editor.getJSON().content?.map((node) => node.type);
  const pressDown = () =>
    editor.view.someProp('handleKeyDown', (handle) =>
      handle(editor.view, new KeyboardEvent('keydown', { key: 'ArrowDown' })),
    );
  afterEach(() => editor.destroy());

  it('leaves the document alone when it is opened or the last block is selected', () => {
    create();
    editor.commands.setNodeSelection(3);
    expect(types()).toEqual(['paragraph', 'horizontalRule']);
  });

  it('adds a line with the caret on it when ArrowDown leaves the last block', () => {
    create();
    editor.commands.setNodeSelection(3);
    expect(pressDown()).toBe(true);
    expect(types()).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(editor.state.selection.from).toBe(5);
  });

  it('adds nothing in a read-only editor', () => {
    create(false);
    editor.commands.setNodeSelection(3);
    expect(pressDown()).toBeFalsy();
    expect(types()).toEqual(['paragraph', 'horizontalRule']);
  });
});
