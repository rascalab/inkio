import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { Editor, EditorContent } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import Blockquote from '@tiptap/extension-blockquote';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { CodeBlock } from '../CodeBlock';
import { isHljsGrammarRequested, resolveHljsLanguageName } from '../CodeBlock/hljs-lazy';

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
