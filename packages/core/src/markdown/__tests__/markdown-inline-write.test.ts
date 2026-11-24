import { Editor, Extension, type JSONContent } from '@tiptap/core';
import Code from '@tiptap/extension-code';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { getExtensions } from '../../extensions/get-extensions';
import { Markdown, type MarkdownEditor, parseMarkdown, stringifyMarkdown } from '../index';

const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const documentOf = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const text = (value: string, ...types: string[]): JSONContent => ({
  type: 'text', text: value, ...(types.length ? { marks: types.map(type => ({ type })) } : {}),
});
const wiki = (href: string): JSONContent => ({ type: 'wikiLink', attrs: { href } });
const br = { type: 'hardBreak' };

describe('inline Markdown representation', () => {
  it.each(['comment', 'underline'])('joins bold text after dropping %s and preserves neighboring mark changes', (dropped) => {
    const source = documentOf(paragraph(text('A', 'bold', dropped), text('B', 'bold'),
      text('C', 'bold', 'italic'), text('D', 'italic'), text('E', 'strike'), text('F', 'strike', dropped)));
    const result = parseMarkdown(stringifyMarkdown(source)).content?.[0].content;
    expect(result?.map(node => [node.text, node.marks?.map(mark => mark.type).sort()])).toEqual([
      ['AB', ['bold']], ['C', ['bold', 'italic']], ['D', ['italic']], ['EF', ['strike']],
    ]);
  });

  it('keeps neighboring code spans and links with different destinations distinct', () => {
    const a = { type: 'link', attrs: { href: '/first' } };
    const b = { type: 'link', attrs: { href: '/second' } };
    const doc = documentOf(paragraph(text('A', 'code', 'underline'), text('B', 'code'),
      { type: 'text', text: 'C', marks: [a, { type: 'comment' }] }, { type: 'text', text: 'D', marks: [a] },
      { type: 'text', text: 'E', marks: [b] }));
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(documentOf(paragraph(text('AB', 'code'),
      { type: 'text', text: 'CD', marks: [a] }, { type: 'text', text: 'E', marks: [b] })));
  });

  it('produces standalone content compatible with the default inline code mark', () => {
    expect(parseMarkdown('**`A`** / [`B`](/p)')).toEqual(documentOf(paragraph(text('A', 'code'), text(' / '), text('B', 'code'))));
  });

  it('keeps escaped wiki delimiters literal while recognizing only real wiki tokens before GFM links', () => {
    const source = String.raw`see \[\[plain]] [[https://example.com/path?a=1&amp;b=2]], [[a@b.com]] and [[www.example.com]].`;
    const doc = documentOf(paragraph(text('see [[plain]] '), wiki('https://example.com/path?a=1&b=2'),
      text(', '), wiki('a@b.com'), text(' and '), wiki('www.example.com'), text('.')));
    expect(parseMarkdown(source)).toEqual(doc);
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(doc);
    expect(parseMarkdown('`[[www.example.com]]`').content?.[0]).toEqual(paragraph(text('[[www.example.com]]', 'code')));
  });

  it('keeps wiki punctuation literal without creating a link for an unsafe scheme', () => {
    const target = 'my_page *A* & `B` #x :note | end';
    const doc = documentOf(paragraph(text('first:'), wiki(target), text('!')));
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(doc);
    expect(parseMarkdown('x [[javascript&#58;alert(1)]] y').content?.[0]).toEqual(paragraph(text('x [[javascript:alert(1)]] y')));
  });

  it('preserves breaks at the end of a paragraph, not a literal backslash or extra paragraph', () => {
    const doc = documentOf(paragraph(text('first'), br, text('last'), br, br), paragraph(br), paragraph(text('next')));
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(doc);
  });

  it('exports displayed reference labels with exactly one prefix and an ID fallback', () => {
    const doc = documentOf(paragraph({ type: 'mention', attrs: { id: 'a', label: '@Ada' } }, text(' '),
      { type: 'hashTag', attrs: { id: 'inkio', label: '' } }, text(' '), { type: 'wikiLink', attrs: { href: 'Guide', label: '' } }));
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(documentOf(paragraph(text('@Ada #inkio '), wiki('Guide'))));
  });
});

describe('live Markdown writes', () => {
  it('throws on a transaction veto and leaves identical assignments untouched', () => {
    const veto = Extension.create({ name: 'vetoMarkdown', addProseMirrorPlugins: () => [
      new Plugin({ filterTransaction: tr => !tr.doc.textContent.includes('denied') }),
    ] });
    const editor = new Editor({ extensions: [...getExtensions(), Markdown, veto], content: '<p>old</p>' }) as MarkdownEditor<Editor>;
    const update = vi.fn();
    editor.on('update', update);
    try {
      editor.markdown = 'new';
      expect(editor.markdown).toBe('new');
      editor.markdown = 'new';
      const before = editor.state;
      expect(() => { editor.markdown = 'denied'; }).toThrow();
      expect(() => { editor.markdown = '[[unsupported]]'; }).toThrow();
      expect(() => { editor.markdown = 'a'.repeat(1_000_001); }).toThrow();
      expect(editor.state).toBe(before);
      expect(editor.markdown).toBe('new');
      expect(update).toHaveBeenCalledTimes(1);
      editor.markdown = String.raw`\[\[plain]]`;
      expect(editor.state.doc.textContent).toBe('[[plain]]');
    } finally { editor.destroy(); }
  });

  it('reports live table guard decisions for both table dimensions', () => {
    const row = (width: number, value: string) => '|' + (value + '|').repeat(width);
    const table = (width: number, height: number) => [row(width, 'x'), row(width, '-'), ...Array<string>(height - 1).fill(row(width, 'y'))].join('\n');
    const editor = new Editor({ extensions: [...getExtensions(), Markdown], content: '<p>old</p>' }) as MarkdownEditor<Editor>;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const before = editor.state;
      expect(() => { editor.markdown = table(129, 1); }).toThrow();
      expect(() => { editor.markdown = table(1, 513); }).toThrow();
      expect(editor.state).toBe(before);
      editor.markdown = table(128, 1);
      expect(editor.state.doc.firstChild?.firstChild?.childCount).toBe(128);
    } finally { warning.mockRestore(); editor.destroy(); }
  });

  it.each([false, true])('imports nested code marks within the active schema (permissive=%s)', (permissive) => {
    const extensions = getExtensions({ code: false });
    const editor = new Editor({ extensions: [...extensions, permissive ? Code.extend({ excludes: '' }) : Code, Markdown] }) as MarkdownEditor<Editor>;
    try {
      editor.markdown = '**`A`** / [`B`](/p)';
      const content = editor.getJSON().content?.[0]?.content;
      expect(content?.map(node => ['text' in node ? node.text : undefined, node.marks?.map(mark => mark.type).sort()])).toEqual([
        ['A', permissive ? ['bold', 'code'] : ['code']], [' / ', undefined], ['B', permissive ? ['code', 'link'] : ['code']],
      ]);
    } finally { editor.destroy(); }
  });
});
