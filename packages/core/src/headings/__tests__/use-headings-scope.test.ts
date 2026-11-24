import { Editor, Node } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import { stepMayAffectHeadings } from '../use-headings';
import { getHeadingsFromDoc } from '../headings';
import { read } from '../../read-document';

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

it('uses configured heading levels for live and schema-aware saved headings', () => {
  const raw = { type: 'doc', content: [4, 'oops', 3].map(level => ({
    type: 'heading', attrs: { level }, content: [{ type: 'text', text: 'Heading' }],
  })) };
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Heading.configure({ levels: [2, 3] })],
    content: raw,
  });
  try {
    expect(Array.from(editor.view.dom.children, el => el.tagName)).toEqual(['H2', 'H2', 'H3']);
    expect(getHeadingsFromDoc(editor.state.doc).map(h => h.level)).toEqual([2, 2, 3]);
    expect(read(raw, { schema: editor.schema }).headings).toEqual(getHeadingsFromDoc(editor.state.doc));
    expect(read(raw).headings.map(h => h.level)).toEqual([4, 1, 3]);
  } finally {
    editor.destroy();
  }
});

it('uses a custom inline renderer at its document position in schema-backed headings', () => {
  const badge = Node.create({
    name: 'badge', group: 'inline', inline: true, atom: true,
    renderHTML: () => ['span'],
    renderText: ({ parent, index, pos }) => `${parent.type.name} ${index} at ${pos}`,
  });
  const content = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
    { type: 'heading', content: [{ type: 'text', text: 'See ' }, { type: 'badge' }] },
  ] };
  const editor = new Editor({ extensions: [Document, Paragraph, Text, Heading, badge], content });
  try {
    const expected = [{ level: 1, text: 'See heading 1 at 11', id: 'see-heading-1-at-11', index: 0 }];
    expect(getHeadingsFromDoc(editor.state.doc)).toEqual(expected);
    expect(read(content, { schema: editor.schema }).headings).toEqual(expected);
  } finally {
    editor.destroy();
  }
});

describe('stepMayAffectHeadings', () => {
  it('ignores plain text insertion inside a paragraph', () => {
    const { editor, cleanup } = createEditor();
    const tr = editor.state.tr.insertText('x', firstTextPos(editor, 1));
    expect(tr.steps).toHaveLength(1);
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(false);
    cleanup();
  });

  it('ignores a pasted paragraph away from headings', () => {
    const { editor, cleanup } = createEditor();
    const paragraph = editor.schema.nodes.paragraph.create(null, editor.schema.text('Another paragraph'));
    const tr = editor.state.tr.insert(editor.state.doc.content.size, paragraph);
    expect(stepMayAffectHeadings(tr.before, tr.steps[0])).toBe(false);
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

  it('handles a step that reaches the end of the document', () => {
    const { editor, cleanup } = createEditor();
    // setContent replaces the whole doc: the step's `to` equals doc.content.size.
    const paragraph = editor.schema.nodes.paragraph!.create(null, editor.schema.text('Replaced'));
    const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, paragraph);
    expect(() => stepMayAffectHeadings(tr.before, tr.steps[0]!)).not.toThrow();
    expect(stepMayAffectHeadings(tr.before, tr.steps[0]!)).toBe(true);
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
