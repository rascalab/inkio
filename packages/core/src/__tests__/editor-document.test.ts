import { Mark, Node, type Extensions, type JSONContent } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Document from '@tiptap/extension-document';
import CodeBlock from '@tiptap/extension-code-block';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { read, withDocumentAccess } from '../index';
import { ImageBlockSchema } from '../extensions/image-block-schema';
import { TocBlockSchema } from '../extensions/TocBlock/toc-block-schema';

function inlineReference(name: 'mention' | 'hashTag') {
  return Node.create({
    name,
    inline: true,
    group: 'inline',
    atom: true,
    addAttributes: () => ({ id: { default: null }, label: { default: null } }),
    renderHTML: () => ['span'],
  });
}

const editors: Editor[] = [];
function createEditor(content: JSONContent | string, extra: Extensions = []) {
  const editor = new Editor({
    extensions: [Document, Paragraph, Heading, Text, HardBreak, Blockquote, ImageBlockSchema,
      inlineReference('mention'), inlineReference('hashTag'),
      Mark.create({ name: 'comment', addAttributes: () => ({ commentId: { default: null } }), renderHTML: () => ['span', 0] }),
      ...extra],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

describe('document access', () => {
  it('decorates only the supplied editor and leaves its Tiptap identity and commands intact', () => {
    const raw = createEditor('<p>First</p>');
    const other = createEditor('<p>Other</p>');
    const state = vi.spyOn(raw, 'state', 'get');
    const editor = withDocumentAccess(raw);
    expect(editor).toBe(raw);
    const summarize = editor.summary;
    expect(withDocumentAccess(raw).summary).toBe(summarize);
    expect(state).not.toHaveBeenCalled();
    expect('summary' in other).toBe(false);
    expect(editor.commands.setContent('<p>Next</p>')).toBe(true);
    expect(editor.text).toBe('Next');
  });

  it('matches JSON text and stats for nested blocks, hard breaks and captioned or bare images', () => {
    const content = {
      type: 'doc', content: [
        { type: 'blockquote', content: [{ type: 'paragraph', content: [
          { type: 'text', text: ' first \t' }, { type: 'hardBreak' }, { type: 'text', text: 'second' },
        ] }] },
        { type: 'imageBlock', attrs: { caption: 'The view' } },
        { type: 'imageBlock' },
      ],
    };
    const saved = read(content);
    const editor = withDocumentAccess(createEditor(content));
    const json = vi.spyOn(editor, 'getJSON');
    expect(editor.text).toBe('first\nsecond\n\n[Image: The view]\n[Image]');
    expect(editor.text).toBe(saved.text);
    expect(editor.stats).toEqual(saved.stats);
    expect(editor.stats.blocks).toBe(4);
    expect(json).not.toHaveBeenCalled();
  });

  it('uses extension renderText for atoms and containers, with original serializer positions and block counts', () => {
    const badge = Node.create({
      name: 'badge', inline: true, group: 'inline', atom: true,
      renderHTML: () => ['span'],
      renderText: ({ pos, parent, index }) => `${parent.type.name}:${index}@${pos}`,
    });
    const panel = Node.create({
      name: 'panel', group: 'block', content: 'block+',
      renderHTML: () => ['section', 0],
      renderText: ({ node }) => `[${node.textContent}]`,
    });
    const editor = withDocumentAccess(createEditor({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }, { type: 'badge' }] },
      { type: 'panel', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'inside' }] }] },
    ] }, [badge, panel]));
    const saved = read(editor.getJSON(), { schema: editor.schema });
    const text = 'xparagraph:1@2\n[inside]';
    for (const doc of [editor, saved]) {
      expect(doc.text).toBe(text);
      expect(doc.stats).toEqual({ words: 2, chars: text.length, blocks: 3 });
      expect(doc.summary()).toBe(text);
    }
  });

  it('reads details children, literal code and a ToC atom consistently with their schemas', () => {
    const code = '  first  \n\n\n\tsecond\n';
    const content = { type: 'doc', content: [
      { type: 'details', content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Title' }] },
        { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }] },
      ] },
      { type: 'tocBlock' },
      { type: 'codeBlock', content: [{ type: 'text', text: code }] },
    ] };
    const editor = withDocumentAccess(createEditor(content, [CodeBlock, Details, DetailsSummary, DetailsContent, TocBlockSchema]));
    for (const doc of [editor, read(content), read(content, { schema: editor.schema })]) {
      expect(doc.text).toBe(`Title\nBody\n\n${code}`);
      expect(doc.stats).toEqual({ blocks: 6, words: 4, chars: doc.text.length });
      expect(doc.summary()).toBe(doc.text);
    }
  });

  it('reads deeply nested schema-backed JSON without truncating or following back-edges', () => {
    const schema = createEditor('<p></p>').schema;
    let child: JSONContent = { type: 'paragraph', content: [{ type: 'text', text: 'leaf' }] };
    for (let i = 0; i < 10_000; i++) child = { type: 'blockquote', content: [child] };
    const json: JSONContent = { type: 'doc', content: [child] };
    json.content!.push(json);
    const saved = read(json, { schema });
    expect(saved.text).toBe('leaf');
    expect(saved.stats).toEqual({ blocks: 10_001, words: 1, chars: 4 });
  });

  it('matches displayed reference prefixes for empty labels, prefixed labels and missing attributes', () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'mention', attrs: { id: 'Ada', label: '' } },
      { type: 'hashTag', attrs: { label: '##inkio' } }, { type: 'mention' }, { type: 'hashTag' },
    ] }] };
    expect(read(content).text).toBe('@Ada##inkio@#');
    expect(withDocumentAccess(createEditor(content)).text).toBe('@Ada##inkio@#');
  });

  it('includes visible references in live and saved text, summaries, counts and headings', () => {
    const editor = withDocumentAccess(createEditor({ type: 'doc', content: [
      { type: 'heading', content: [
        { type: 'mention', attrs: { id: 'Ada' } },
        { type: 'text', text: ' ' },
        { type: 'hashTag', attrs: { label: '#inkio' } },
      ] },
    ] }));
    const saved = read(editor.getJSON());
    expect(editor.text).toBe('@Ada #inkio');
    expect(saved.text).toBe(editor.text);
    expect(editor.stats).toEqual({ words: 2, chars: 11, blocks: 1 });
    expect(saved.stats).toEqual(editor.stats);
    expect(editor.summary(7)).toBe('@Ada...');
    expect(saved.summary(7)).toBe(editor.summary(7));
    expect(editor.headings[0]?.text).toBe(editor.text);
    expect(saved.headings).toEqual(editor.headings);
  });

  it('exposes the referenced thread IDs once and updates them after document changes', () => {
    const marked = (text: string, commentId: string) => ({ type: 'text', text, marks: [{ type: 'comment', attrs: { commentId } }] });
    const editor = withDocumentAccess(createEditor({ type: 'doc', content: [
      { type: 'paragraph', content: [marked('a', ' x '), marked('b', 'y'), marked('c', 'x'), marked('d', ' ')] },
    ] }));
    expect(editor.commentIds).toEqual(['x', 'y']);
    const saved = read(editor.getJSON());
    expect(saved.commentIds).toEqual(editor.commentIds);
    editor.commands.setContent('<p>no references</p>');
    expect(editor.commentIds).toEqual([]);
    expect(saved.commentIds).toEqual(['x', 'y']);
  });

  it('collects only actual reference nodes, in first-seen order, using advanced deduplication rules', () => {
    const mention = (id: unknown, label: unknown) => ({ type: 'mention', attrs: { id, label } });
    const tag = (label: unknown) => ({ type: 'hashTag', attrs: { label } });
    const editor = withDocumentAccess(createEditor({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '@ghost #text' }, mention('2', 'B'), tag('##Second')] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [
        mention('1', 'A'), mention('2', 'B'), mention('2', 'Bee'), mention(1, 'C'), mention('3', ''),
        tag('#First'), tag('Second'), tag('second'), tag('###'), tag(''), tag(null),
      ] }] },
    ] }));
    const json = vi.spyOn(editor, 'getJSON');
    expect(editor.mentions).toEqual([{ id: '2', label: 'B' }, { id: '1', label: 'A' }, { id: '2', label: 'Bee' }, { id: '3', label: '3' }]);
    expect(editor.hashTags).toEqual(['Second', 'First', 'second']);
    expect(json).not.toHaveBeenCalled();
    const saved = read(editor.getJSON());
    expect(saved.mentions).toEqual(editor.mentions);
    expect(saved.hashTags).toEqual(editor.hashTags);
  });

  it('keeps immutable cached values across selection changes and replaces them after edits', () => {
    const editor = withDocumentAccess(createEditor('<p>Hello</p>'));
    const { stats, mentions, hashTags } = editor;
    editor.commands.setTextSelection(3);
    expect(editor.stats).toBe(stats);
    expect(editor.mentions).toBe(mentions);
    expect(editor.hashTags).toBe(hashTags);
    expect(Object.isFrozen(stats)).toBe(true);
    expect(Object.isFrozen(mentions)).toBe(true);
    expect(Object.isFrozen(hashTags)).toBe(true);
    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'mention', attrs: { id: '1', label: 'A' } }, { type: 'hashTag', attrs: { label: '#tag' } },
    ] }] });
    expect(editor.stats).toEqual({ words: 1, chars: 6, blocks: 1 });
    expect(editor.mentions).toEqual([{ id: '1', label: 'A' }]);
    expect(Object.isFrozen(editor.mentions[0])).toBe(true);
    expect(editor.hashTags).toEqual(['tag']);
    expect(editor.summary()).toBe('@A#tag');
    expect(stats.words).toBe(1);
  });

  it('gives saved previews the same total length limit as live previews', () => {
    const editor = withDocumentAccess(createEditor('<p>abcdef</p>'));
    expect(editor.summary(4)).toBe('a...');
    expect(read(editor.getJSON()).summary(4)).toBe('a...');
  });

  it('includes the ellipsis in the UTF-16 budget without cutting surrogate pairs', () => {
    const editor = withDocumentAccess(createEditor('<p>a😀 bcdef</p>'));
    for (const doc of [editor, read(editor.getJSON())]) {
      expect(doc.summary(7)).toBe('a😀...');
      expect(doc.summary(5)).toBe('a...');
      expect(doc.summary(4.9)).toBe('a...');
      expect(doc.summary(3)).toBe('...');
      expect(doc.summary(2)).toBe('..');
      expect(doc.summary(1)).toBe('.');
      expect(doc.summary(0)).toBe('');
      expect(doc.summary(-1)).toBe('');
      expect(doc.summary(NaN)).toBe('');
      expect(doc.summary(Infinity)).toBe('a😀 bcdef');
    }
    editor.commands.setContent(`<p>${'x'.repeat(141)}</p>`);
    expect(editor.summary()).toBe(`${'x'.repeat(137)}...`);
    expect(read(editor.getJSON()).summary()).toBe(editor.summary());
    editor.commands.setContent('<p>ok</p>');
    expect(editor.summary(2)).toBe('ok');
    expect(read(editor.getJSON()).summary(2)).toBe('ok');
  });

  it('returns well-formed summaries even for isolated surrogates in imported text', () => {
    const editor = withDocumentAccess(createEditor({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'a\uD800b' }] },
    ] }));
    expect(editor.summary()).toBe('a\uFFFDb');
    expect(read(editor.getJSON()).summary()).toBe(editor.summary());
  });
});
