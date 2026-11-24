import { act, renderHook, waitFor } from '@testing-library/react';
import Blockquote from '@tiptap/extension-blockquote';
import Document from '@tiptap/extension-document';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Schema } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { migrateEditorDocument } from '../migrate-editor-document';
import { useResolvedInkioEditor } from '../use-resolved-inkio-editor';

function schema(strict: boolean) {
  return new Schema<string>({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      quote: { group: 'block', content: strict ? 'paragraph+' : 'block+' },
      caption: { group: 'block', content: 'inline*', marks: strict ? 'italic' : '_' },
      image: { group: 'block', attrs: { src: {} } },
      ...(strict ? {} : { rule: { group: 'block' } }),
      text: { group: 'inline' },
    },
    marks: { bold: { excludes: strict ? 'italic' : '' }, italic: {} },
  });
}

describe('live schema migration', () => {
  it('splits a narrowed quote around an image without discarding either, keeping a node selection on the image', () => {
    const old = schema(false);
    const paragraph = old.node('paragraph', null, old.text('same'));
    const image = old.node('image', { src: 'example.png' });
    const source = old.node('doc', null, old.node('quote', null, [paragraph, image, paragraph]));
    const selected = NodeSelection.create(source, 1 + paragraph.nodeSize);
    const { doc, mapping } = migrateEditorDocument(source, schema(true));
    expect(doc.toString()).toBe('doc(quote(paragraph("same")), image, quote(paragraph("same")))');
    const restored = selected.getBookmark().map(mapping).resolve(doc);
    expect(restored).toBeInstanceOf(NodeSelection);
    expect((restored as NodeSelection).node.attrs.src).toBe('example.png');
  });

  it('filters parent restrictions before applying destination mark exclusions, never losing text', () => {
    const old = schema(false);
    const word = old.text('word', [old.mark('bold'), old.mark('italic')]);
    const source = old.node('doc', null, [old.node('paragraph', null, word), old.node('caption', null, word)]);
    const { doc } = migrateEditorDocument(source, schema(true));
    expect(doc.toString()).toBe('doc(paragraph(bold("word")), caption(italic("word")))');
    expect(() => doc.check()).not.toThrow();
  });

  it('maps both ends of a backwards selection around separate deletions, even with duplicate paragraphs', () => {
    const old = schema(false);
    const p = old.node('paragraph', null, old.text('same'));
    const hr = old.node('rule');
    const source = old.node('doc', null, [hr, p, hr, p]);
    const range = TextSelection.create(source, 11, 4);
    const { doc, mapping } = migrateEditorDocument(source, schema(true));
    expect(range.getBookmark().map(mapping).resolve(doc).toJSON()).toEqual({ type: 'text', anchor: 9, head: 3 });
  });

  const full = [Document, Paragraph, Text, HorizontalRule, Blockquote];
  const narrow = [Document, Paragraph, Text, Blockquote];
  it('maps an empty leaf gaining content boundaries even though the JSON still validates', () => {
    const make = (content?: string) => new Schema({
      nodes: { doc: { content: 'block+' }, token: { group: 'block', content }, paragraph: { group: 'block', content: 'text*' }, text: {} },
    });
    const old = make(), next = make('text*');
    const source = old.node('doc', null, [old.node('token'), old.node('paragraph', null, old.text('abc'))]);
    const { doc, mapping } = migrateEditorDocument(source, next);
    expect(NodeSelection.create(source, 0).getBookmark().map(mapping).resolve(doc).toJSON()).toEqual({ type: 'node', anchor: 0 });
    expect(TextSelection.create(source, 3).getBookmark().map(mapping).resolve(doc).head).toBe(4);
  });

  it('restores the caret at its migrated text offset in the replacement editor', async () => {
    const hook = renderHook(({ extensions }) => useResolvedInkioEditor({
      content: '<hr><p>after</p>', extensions,
    }), { initialProps: { extensions: full } });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    act(() => { hook.result.current!.commands.setTextSelection(4); });
    hook.rerender({ extensions: narrow });
    await waitFor(() => expect(hook.result.current?.state.selection.head).toBe(3));
    expect(hook.result.current?.state.doc.toString()).toBe('doc(paragraph("after"))');
  });

  it('maps the viewer selection when reopening the prop yields the migrated document', async () => {
    const hook = renderHook(({ extensions }) => useResolvedInkioEditor({
      content: '<hr><p>after</p>', extensions, editable: false,
    }, true), { initialProps: { extensions: full } });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    act(() => { hook.result.current!.commands.setTextSelection(4); });
    hook.rerender({ extensions: narrow });
    await waitFor(() => expect(hook.result.current?.state.selection.head).toBe(3));
  });

  it('keeps replacement viewer content authoritative and does not restore a selection into unrelated text', async () => {
    const hook = renderHook(({ extensions, content }) => useResolvedInkioEditor({
      content, extensions, editable: false,
    }, true), { initialProps: { extensions: full, content: '<hr><p>previous</p>' } });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    act(() => { hook.result.current!.commands.setTextSelection(6); });
    hook.rerender({ extensions: narrow, content: '<p>incoming content</p>' });
    await waitFor(() => expect(hook.result.current?.state.doc.textContent).toBe('incoming content'));
    expect(hook.result.current?.state.selection.head).toBe(1);
  });
});
