import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { getSchema } from '@tiptap/core';
import { Editor, EditorContent } from '@tiptap/react';
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import type { DecorationSet } from '@tiptap/pm/view';
import Blockquote from '@tiptap/extension-blockquote';
import BaseCodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import javascript from 'highlight.js/lib/languages/javascript';
import plaintext from 'highlight.js/lib/languages/plaintext';
import { createLowlight } from 'lowlight';
import { CodeBlock } from '../CodeBlock';
import { isHljsGrammarRequested, resolveHljsLanguageName } from '../CodeBlock/hljs-lazy';
import { InkioLowlightPlugin, LOWLIGHT_REFRESH_META } from '../CodeBlock/lowlight-plugin';

describe('resolveHljsLanguageName', () => {
  it('maps UI language values to loadable grammars', () => {
    expect(resolveHljsLanguageName('typescript')).toBe('typescript');
    expect(resolveHljsLanguageName('TSX')).toBe('typescript');
    expect(resolveHljsLanguageName('c++')).toBe('cpp');
    expect(resolveHljsLanguageName('C#')).toBe('csharp');
    expect(resolveHljsLanguageName('sh')).toBe('bash');
    expect(resolveHljsLanguageName('zsh')).toBe('bash');
    expect(resolveHljsLanguageName('py')).toBe('python');
    expect(resolveHljsLanguageName('jsx')).toBe('typescript');
    expect(resolveHljsLanguageName('Python')).toBe('python');
    expect(resolveHljsLanguageName('bash')).toBe('bash');
  });

  it('returns null for empty or unknown languages (auto-detect fallback)', () => {
    expect(resolveHljsLanguageName('')).toBeNull();
    expect(resolveHljsLanguageName(null)).toBeNull();
    expect(resolveHljsLanguageName(undefined)).toBeNull();
    expect(resolveHljsLanguageName('html')).toBeNull();
    expect(resolveHljsLanguageName('not-a-language')).toBeNull();
  });
});

describe('incremental code block highlighting', () => {
  const schema = getSchema([Document, Paragraph, Text, Blockquote, BaseCodeBlock]);
  const code = (text: string) =>
    schema.nodes.codeBlock.create({ language: 'javascript' }, schema.text(text));

  it('maps existing tokens for non-code edits and only highlights the edited block', () => {
    const lowlight = createLowlight({ javascript });
    const plugin = InkioLowlightPlugin({ name: 'codeBlock', lowlight, defaultLanguage: null });
    const first = code('const first = 1;');
    const intro = schema.nodes.paragraph.create(null, schema.text('Intro'));
    const quote = schema.nodes.blockquote.create(null, code('const second = 2;'));
    const doc = schema.nodes.doc.create(null, [first, intro, quote]);
    let state = EditorState.create({ doc, plugins: [plugin] });
    const decorations = () => plugin.getState(state) as DecorationSet;
    const initial = decorations();
    const introPos = first.nodeSize + 1;
    const secondPos = first.nodeSize + intro.nodeSize + 1;
    const [firstToken] = initial.find(1, first.nodeSize - 1);
    const [secondToken] = initial.find(secondPos + 1, doc.content.size - 1);
    const highlight = vi.spyOn(lowlight, 'highlight');

    state = state.apply(state.tr.setSelection(TextSelection.create(doc, 2)));
    expect(decorations()).toBe(initial);
    state = state.apply(state.tr.insertText('!', introPos));
    expect(highlight).not.toHaveBeenCalled();
    expect(decorations().find(secondPos + 2)[0].from).toBe(secondToken.from + 1);

    // A remote edit can change a nested code block while the cursor is in prose.
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, introPos)));
    const keywordEnd = secondPos + 2 + 'const'.length;
    state = state.apply(state.tr.insertText('x', keywordEnd));
    expect(highlight).toHaveBeenCalledTimes(1);
    expect(highlight).toHaveBeenCalledWith('javascript', 'constx second = 2;');
    expect(decorations().find(1, first.nodeSize - 1)[0].from).toBe(firstToken.from);
    expect(decorations().find(secondPos + 2, secondPos + 6)).toHaveLength(0);

    highlight.mockClear();
    state = state.apply(state.tr.delete(keywordEnd, keywordEnd + 1));
    expect(highlight).toHaveBeenCalledTimes(1);
    expect(highlight).toHaveBeenCalledWith('javascript', 'const second = 2;');
  });

  it('replaces stale tokens when a block changes language or becomes prose', () => {
    const lowlight = createLowlight({ javascript, plaintext });
    const plugin = InkioLowlightPlugin({ name: 'codeBlock', lowlight, defaultLanguage: null });
    const first = code('const first = 1;');
    const second = code('const second = 2;');
    let state = EditorState.create({
      doc: schema.nodes.doc.create(null, [first, second]),
      plugins: [plugin],
    });
    const highlight = vi.spyOn(lowlight, 'highlight');
    state = state.apply(
      state.tr
        .setNodeAttribute(0, 'language', 'plaintext')
        .setNodeMarkup(first.nodeSize, schema.nodes.paragraph)
        .insert(first.nodeSize + second.nodeSize, code('const third = 3;')),
    );
    expect(highlight.mock.calls).toEqual([
      ['plaintext', 'const first = 1;'],
      ['javascript', 'const third = 3;'],
    ]);
    const decorations = plugin.getState(state) as DecorationSet;
    expect(decorations.find(1, first.nodeSize + second.nodeSize - 1)).toHaveLength(0);
    expect(decorations.find(first.nodeSize + second.nodeSize + 1).length).toBeGreaterThan(0);

    const docBeforeRefresh = state.doc;
    highlight.mockClear();
    state = state.apply(state.tr.setMeta(LOWLIGHT_REFRESH_META, true));
    expect(state.doc).toBe(docBeforeRefresh);
    expect(highlight).toHaveBeenCalledTimes(2);
  });
});

// CodeBlockView is a React node view: since tiptap 3.31 those render only
// through <EditorContent>, so mount the editor the way the app does.
function mount(editor: Editor) {
  return render(createElement(EditorContent, { editor }));
}

describe('CodeBlock with lazy grammars', () => {
  it('mounts and renders code without eagerly registered grammars', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x: number = 1;' }],
          },
        ],
      },
    });

    const { unmount } = mount(editor);
    await waitFor(() => {
      expect(editor.view.dom.querySelector('pre code')?.textContent).toBe('const x: number = 1;');
    });
    unmount();
    editor.destroy();
  });

  it('paints highlighting once the lazy grammar chunk arrives', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x: number = 1;' }],
          },
        ],
      },
    });

    const { unmount } = mount(editor);
    const code = () => editor.view.dom.querySelector('pre code');
    await waitFor(() => {
      expect(code()?.querySelector('[class*="hljs"]') ?? null).not.toBeNull();
    });
    unmount();
    editor.destroy();
  });

  it('repaints a newly loaded grammar without changing the document', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'csharp' },
            content: [{ type: 'text', text: 'var answer = 42;' }],
          },
        ],
      },
    });
    const docBefore = editor.state.doc;
    const transactions: Transaction[] = [];
    let updates = 0;
    editor.on('transaction', ({ transaction }) => {
      transactions.push(transaction);
    });
    editor.on('update', () => {
      updates += 1;
    });

    // The only transaction after creation is the repaint dispatched when the
    // C# grammar lands.
    await waitFor(() => {
      expect(transactions.length).toBeGreaterThan(0);
    });
    // A repaint must not look like an edit: no doc change, no onUpdate.
    expect(transactions.some((tr) => tr.docChanged)).toBe(false);
    expect(updates).toBe(0);
    expect(editor.state.doc).toBe(docBefore);
    editor.destroy();
  });

  it('still discovers code blocks nested in containers (pruned textblock walk)', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, Blockquote, CodeBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Some introductory prose that must be pruned, not walked.' }],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'codeBlock',
                attrs: { language: 'python' },
                content: [{ type: 'text', text: 'print("nested")' }],
              },
            ],
          },
        ],
      },
    });

    const { unmount } = mount(editor);
    const code = () => editor.view.dom.querySelector('blockquote pre code');
    await waitFor(() => {
      expect(code()?.textContent).toBe('print("nested")');
    });
    await waitFor(() => {
      expect(code()?.querySelector('[class*="hljs"]') ?? null).not.toBeNull();
    });
    unmount();
    editor.destroy();
  });

  it('requests grammars for code blocks inserted or re-languaged after creation (incremental scan)', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, Blockquote, CodeBlock],
      content: '<p>Intro</p><blockquote><p>quoted</p></blockquote>',
    });

    expect(isHljsGrammarRequested('rust')).toBe(false);
    // Typing in a paragraph touches no code block.
    editor.commands.insertContentAt(1, 'x');
    expect(isHljsGrammarRequested('rust')).toBe(false);

    // Insert inside a container so the new block is nested in a changed range.
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, {
      type: 'codeBlock',
      attrs: { language: 'rust' },
      content: [{ type: 'text', text: 'fn main() {}' }],
    });
    expect(isHljsGrammarRequested('rust')).toBe(true);

    // Language change via a node attribute step (AttrStep has an empty map).
    // Position of the code block after the keystroke below shifts it by one.
    let codePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'codeBlock') codePos = pos + 1;
    });
    expect(isHljsGrammarRequested('go')).toBe(false);
    // A plain keystroke first: the queued rust load bumped the grammar state,
    // so this update does the one full rescan and the next is incremental.
    editor.commands.insertContentAt(1, 'x');
    editor.view.dispatch(editor.state.tr.setNodeAttribute(codePos, 'language', 'go'));
    expect(isHljsGrammarRequested('go')).toBe(true);

    // Language change via setNodeMarkup (ReplaceAroundStep).
    expect(isHljsGrammarRequested('lua')).toBe(false);
    editor.commands.insertContentAt(1, 'x');
    codePos += 1;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(codePos, undefined, { language: 'lua' }),
    );
    expect(isHljsGrammarRequested('lua')).toBe(true);

    // Typing inside the code block after a language change still works.
    editor.view.dispatch(editor.state.tr.insertText('y', codePos + 2));
    expect(editor.state.doc.textContent).toContain('fyn main');
    editor.destroy();
  });
});
