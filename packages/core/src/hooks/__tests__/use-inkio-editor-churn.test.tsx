import { act, renderHook, waitFor } from '@testing-library/react';
import { Extension } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Markdown } from '../../markdown';
import { useInkioEditor } from '../use-inkio-editor';

describe('useInkioEditor extension registration', () => {
  it('keeps equivalent inputs stable and preserves current edits and selection when registration changes', async () => {
    const created = vi.fn();
    const changed = vi.fn();
    const renders: boolean[] = [];
    const hook = renderHook(({ enabled, seed }) => {
      const editor = useInkioEditor({
        extensions: { items: enabled ? [Markdown] : [], replace: false },
        content: seed, onCreate: created, onChange: changed,
      });
      if (editor) renders.push(('markdown' in editor) === enabled);
      return editor;
    }, { initialProps: { enabled: false, seed: '<p>Initial</p>' } });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    const first = hook.result.current!;
    await act(async () => {
      first.commands.setContent('<p>Local edits</p>');
      first.commands.setTextSelection({ from: 3, to: 7 });
    });
    hook.rerender({ enabled: false, seed: '<p>Ignored</p>' });
    expect(hook.result.current).toBe(first);

    hook.rerender({ enabled: true, seed: '<p>Ignored</p>' });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(2));
    const second = hook.result.current!;
    expect(created).toHaveBeenLastCalledWith(second);
    expect(second).toHaveProperty('markdown', 'Local edits');
    expect(second.state.selection).toMatchObject({ from: 3, to: 7 });
    expect(changed).toHaveBeenCalledTimes(1);
    await act(async () => { second.commands.insertContent('!'); });
    expect(changed).toHaveBeenLastCalledWith(second);
    hook.rerender({ enabled: true, seed: '' });
    expect(hook.result.current).toBe(second);
    const selection = second.state.selection.toJSON();
    const text = second.text;

    hook.rerender({ enabled: false, seed: '' });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(3));
    expect(hook.result.current).not.toHaveProperty('markdown');
    expect(hook.result.current?.state.selection.toJSON()).toEqual(selection);
    expect(hook.result.current?.text).toBe(text);
    expect(renders).not.toContain(false);
  });

  it('fits the edited document to a smaller schema rather than clearing it or leaving invalid children', async () => {
    const base = [Document, Paragraph, Text, Blockquote];
    const hook = renderHook(({ headings }) => useInkioEditor({
      extensions: { items: headings ? [...base, Heading] : base, replace: true },
      content: '<p>Seed</p>',
    }), { initialProps: { headings: true } });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    act(() => {
      hook.result.current!.commands.setContent('<h2>First edit</h2><blockquote><h3>Nested edit</h3></blockquote><p>Last edit</p>');
    });
    hook.rerender({ headings: false });
    await waitFor(() => expect(hook.result.current?.schema.nodes.heading).toBeUndefined());
    const edited = hook.result.current!;
    expect(() => edited.state.doc.check()).not.toThrow();
    expect(edited.getHTML()).toBe('<p>First edit</p><blockquote><p>Nested edit</p></blockquote><p>Last edit</p>');
  });

  it('retains nested text when an extension with the same name changes its content expression', async () => {
    const onlyParagraphs = Blockquote.extend({ content: 'paragraph+' });
    const hook = renderHook(({ strict }) => useInkioEditor({
      extensions: { items: [Document, Paragraph, Heading, Text, strict ? onlyParagraphs : Blockquote], replace: true },
      content: '<blockquote><h2>First edit</h2><p>Second edit</p></blockquote><p>Last edit</p>',
    }), { initialProps: { strict: false } });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    hook.rerender({ strict: true });
    const edited = hook.result.current!;
    expect(edited.schema.nodes.blockquote?.spec.content).toBe('paragraph+');
    expect(() => edited.state.doc.check()).not.toThrow();
    expect(edited.state.doc.textContent).toBe('First editSecond editLast edit');
  });

  it('reports only the same-name extension that survived the additive merge', async () => {
    const shadow = Extension.create({ name: Markdown.name });
    const changed = vi.fn();
    const hook = renderHook(() => useInkioEditor({ extensions: [Markdown, shadow], onChange: changed }));
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    await act(async () => { hook.result.current!.commands.insertContent('x'); });
    expect(changed).toHaveBeenCalledWith(hook.result.current);
    expect(hook.result.current).not.toHaveProperty('markdown');
  });
});
