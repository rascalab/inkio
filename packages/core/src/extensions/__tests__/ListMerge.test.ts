import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { ListMerge } from '../ListMerge';

function createEditor(content: object) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, BulletList, OrderedList, ListItem, ListMerge],
    content,
  });
}

describe('ListMerge extension', () => {
  it('has the correct extension name', () => {
    expect(ListMerge.name).toBe('listMerge');
  });

  it('merges adjacent bullet lists into one', () => {
    // Start with a single paragraph, then programmatically set content with two bullet lists.
    // setContent triggers a docChanged transaction which fires appendTransaction (ListMerge).
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const bulletLists = doc.content?.filter((node: any) => node.type === 'bulletList') ?? [];
    expect(bulletLists.length).toBe(1);
    expect(bulletLists[0].content?.length).toBe(2);

    editor.destroy();
  });

  it('merges adjacent ordered lists with the same start', () => {
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const orderedLists = doc.content?.filter((node: any) => node.type === 'orderedList') ?? [];
    expect(orderedLists.length).toBe(1);

    editor.destroy();
  });

  it('does NOT merge adjacent ordered lists with different start numbers', () => {
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 5 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Five' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const orderedLists = doc.content?.filter((node: any) => node.type === 'orderedList') ?? [];
    // Different start numbers — should NOT merge
    expect(orderedLists.length).toBe(2);

    editor.destroy();
  });

  it('does NOT merge bullet list with ordered list', () => {
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet' }] }] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const bulletLists = doc.content?.filter((node: any) => node.type === 'bulletList') ?? [];
    const orderedLists = doc.content?.filter((node: any) => node.type === 'orderedList') ?? [];
    expect(bulletLists.length).toBe(1);
    expect(orderedLists.length).toBe(1);

    editor.destroy();
  });

  it('does not merge non-adjacent lists separated by a paragraph', () => {
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Separator' }],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const bulletLists = doc.content?.filter((node: any) => node.type === 'bulletList') ?? [];
    expect(bulletLists.length).toBe(2);

    editor.destroy();
  });

  it('still merges lists inserted after list-free typing (fast-path transition)', () => {
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph' }] });

    // Plain typing in a list-free doc exercises the guarded fast path.
    editor.commands.insertContent('hello');

    // Introducing lists afterwards must fall back to the full scan and merge.
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] },
          ],
        },
      ],
    });

    const doc = editor.getJSON();
    const bulletLists = doc.content?.filter((node: any) => node.type === 'bulletList') ?? [];
    expect(bulletLists.length).toBe(1);
    expect(bulletLists[0].content?.length).toBe(2);

    editor.destroy();
  });

  describe('incremental (changed-range) scanning after the first change', () => {
    const item = (text: string) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });

    function positionOf(editor: Editor, predicate: (node: any) => boolean): { pos: number; size: number } {
      let found = { pos: -1, size: 0 };
      editor.state.doc.descendants((node, pos) => {
        if (found.pos === -1 && predicate(node)) found = { pos, size: node.nodeSize };
      });
      return found;
    }

    it('merges top-level lists once the separating paragraph is deleted', () => {
      const editor = createEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
          { type: 'bulletList', content: [item('A')] },
          { type: 'paragraph', content: [{ type: 'text', text: 'between' }] },
          { type: 'bulletList', content: [item('B')] },
        ],
      });
      // First change: the one-time full scan.
      editor.commands.insertContentAt(1, 'x');

      const sep = positionOf(editor, (n) => n.type.name === 'paragraph' && n.textContent === 'between');
      editor.view.dispatch(editor.state.tr.delete(sep.pos, sep.pos + sep.size));

      const lists = editor.getJSON().content?.filter((n: any) => n.type === 'bulletList') ?? [];
      expect(lists.length).toBe(1);
      expect(lists[0].content?.length).toBe(2);
      editor.destroy();
    });

    it('merges nested lists inside a list item', () => {
      const editor = createEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'parent' }] },
                  { type: 'bulletList', content: [item('n1')] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'between' }] },
                  { type: 'bulletList', content: [item('n2')] },
                ],
              },
            ],
          },
        ],
      });
      editor.commands.insertContentAt(1, 'x');

      const sep = positionOf(editor, (n) => n.type.name === 'paragraph' && n.textContent === 'between');
      editor.view.dispatch(editor.state.tr.delete(sep.pos, sep.pos + sep.size));

      const parentItem = (editor.getJSON().content?.[1] as any).content[0];
      const nested = parentItem.content.filter((n: any) => n.type === 'bulletList');
      expect(nested.length).toBe(1);
      expect(nested[0].content.length).toBe(2);
      editor.destroy();
    });

    it('merges ordered lists once an attribute change aligns their starts', () => {
      const editor = createEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
          { type: 'orderedList', attrs: { start: 1 }, content: [item('one')] },
          { type: 'orderedList', attrs: { start: 5 }, content: [item('five')] },
        ],
      });
      editor.commands.insertContentAt(1, 'x');
      expect(editor.getJSON().content?.filter((n: any) => n.type === 'orderedList').length).toBe(2);

      const second = positionOf(editor, (n) => n.type.name === 'orderedList' && n.attrs.start === 5);
      editor.view.dispatch(editor.state.tr.setNodeAttribute(second.pos, 'start', 1));

      expect(editor.getJSON().content?.filter((n: any) => n.type === 'orderedList').length).toBe(1);
      editor.destroy();
    });

    it('merges a list inserted right after an existing list', () => {
      const editor = createEditor({
        type: 'doc',
        content: [
          { type: 'bulletList', content: [item('A')] },
          { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
        ],
      });
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, 'x');

      const list = positionOf(editor, (n) => n.type.name === 'bulletList');
      editor.commands.insertContentAt(list.pos + list.size, { type: 'bulletList', content: [item('B')] });

      const lists = editor.getJSON().content?.filter((n: any) => n.type === 'bulletList') ?? [];
      expect(lists.length).toBe(1);
      expect(lists[0].content?.length).toBe(2);
      editor.destroy();
    });
  });
});
