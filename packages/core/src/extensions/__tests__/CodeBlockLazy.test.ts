import { Editor } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { CodeBlock } from '../CodeBlock';
import { resolveHljsLanguageName } from '../CodeBlock/hljs-lazy';

describe('resolveHljsLanguageName', () => {
  it('maps UI language values to loadable grammars', () => {
    expect(resolveHljsLanguageName('typescript')).toBe('typescript');
    expect(resolveHljsLanguageName('TSX')).toBe('typescript');
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

describe('CodeBlock with lazy grammars', () => {
  it('mounts and renders code without eagerly registered grammars', () => {
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

    expect(editor.view.dom.querySelector('pre code')?.textContent).toBe('const x: number = 1;');
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

    const code = () => editor.view.dom.querySelector('pre code');
    const deadline = Date.now() + 5000;
    while (!code()?.querySelector('[class*="hljs"]') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(code()?.querySelector('[class*="hljs"]')).not.toBeNull();
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

    const code = () => editor.view.dom.querySelector('blockquote pre code');
    expect(code()?.textContent).toBe('print("nested")');
    const deadline = Date.now() + 5000;
    while (!code()?.querySelector('[class*="hljs"]') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(code()?.querySelector('[class*="hljs"]')).not.toBeNull();
    editor.destroy();
  });
});
