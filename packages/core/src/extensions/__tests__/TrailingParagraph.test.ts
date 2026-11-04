import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Selection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { TrailingParagraph } from '../TrailingParagraph';

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '앞' }] }, { type: 'horizontalRule' }],
};

describe('TrailingParagraph', () => {
  let editor: Editor;
  const create = (editable = true) => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, HorizontalRule, TrailingParagraph],
      content,
      editable,
    });
  };
  const types = () => editor.getJSON().content?.map((node) => node.type);
  afterEach(() => editor.destroy());

  it('leaves a document alone until someone works at its end', () => {
    create();
    editor.commands.setTextSelection(1);
    expect(types()).toEqual(['paragraph', 'horizontalRule']);

    editor.commands.setNodeSelection(3);
    expect(types()).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
  });

  it('adds nothing for what another client synced', () => {
    create();
    editor.view.dispatch(
      editor.state.tr
        .setSelection(Selection.atEnd(editor.state.doc))
        .setMeta('y-sync$', { isChangeOrigin: true }),
    );
    expect(types()).toEqual(['paragraph', 'horizontalRule']);
  });

  it('adds nothing in a read-only editor', () => {
    create(false);
    editor.commands.setNodeSelection(3);
    expect(types()).toEqual(['paragraph', 'horizontalRule']);
  });
});
