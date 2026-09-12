import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import { stepMayAffectHeadings } from '../useHeadings';

function createEditor() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [Document, Paragraph, Text, Heading.configure({ levels: [1, 2] })],
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text here' }] },
      ],
    },
  });
  return {
    editor,
    cleanup: () => {
      editor.destroy();
      element.remove();
    },
  };
}

function firstTextPos(editor: Editor, blockIndex: number): number {
  let pos = -1;
  let seen = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.isTextblock) {
      seen += 1;
      if (seen === blockIndex) {
        pos = nodePos + 1;
        return false;
      }
    }
    return true;
  });
  return pos;
}

describe('stepMayAffectHeadings', () => {
  it('ignores plain text insertion inside a paragraph', () => {
    const { editor, cleanup } = createEditor();
    const tr = editor.state.tr.insertText('x', firstTextPos(editor, 1));
    expect(tr.steps).toHaveLength(1);
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(false);
    cleanup();
  });

  it('catches text insertion inside a heading', () => {
    const { editor, cleanup } = createEditor();
    const tr = editor.state.tr.insertText('x', firstTextPos(editor, 0));
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(true);
    cleanup();
  });

  it('catches deletion spanning a heading', () => {
    const { editor, cleanup } = createEditor();
    // Delete from inside the heading through the paragraph start.
    const tr = editor.state.tr.delete(2, firstTextPos(editor, 1) + 2);
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(true);
    cleanup();
  });

  it('catches pasted heading blocks', () => {
    const { editor, cleanup } = createEditor();
    const heading = editor.schema.nodes.heading!.create({ level: 2 }, editor.schema.text('New'));
    const tr = editor.state.tr.replaceWith(
      firstTextPos(editor, 1),
      firstTextPos(editor, 1),
      heading,
    );
    const lastStep = tr.steps[tr.steps.length - 1]!;
    expect(stepMayAffectHeadings(tr.before, lastStep)).toBe(true);
    cleanup();
  });

  it('ignores attribute changes outside headings', () => {
    const { editor, cleanup } = createEditor();
    const tr = editor.state.tr.setNodeAttribute(firstTextPos(editor, 1) - 1, 'data-x' as never, '1');
    expect(tr.steps).toHaveLength(1);
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(false);
    cleanup();
  });
});
