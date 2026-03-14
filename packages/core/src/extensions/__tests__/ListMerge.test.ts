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
});
