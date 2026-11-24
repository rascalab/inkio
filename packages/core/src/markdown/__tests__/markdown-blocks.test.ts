import { getSchema, type JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { getSchemaExtensions } from '../../extensions/schema-extensions';
import { parseMarkdown, stringifyMarkdown } from '../index';

const text = (value: string): JSONContent => ({ type: 'text', text: value });
const paragraph = (value: string): JSONContent => ({ type: 'paragraph', content: [text(value)] });
const image: JSONContent = {
  type: 'imageBlock',
  attrs: { src: '/photo.png', alt: 'Photo', title: 'Credit', caption: 'A | B <img> & *more* at www.example.com', width: '64.5%', align: 'right' },
};

describe('Markdown block content', () => {
  it('exports a native image and readable caption, restoring its layout without importing HTML', () => {
    const md = stringifyMarkdown(image);
    expect(md).toContain('![Photo](/photo.png "Credit")');
    expect(md).not.toContain('<img>');
    expect(parseMarkdown(md).content).toEqual([image]);
    expect(parseMarkdown(stringifyMarkdown({ ...image, attrs: { ...image.attrs, width: 'bad--> <img>', align: 'bad' } })).content?.[0].attrs).toEqual({
      src: '/photo.png', alt: 'Photo', title: 'Credit', caption: image.attrs?.caption,
    });
  });

  it('does not consume a second image as caption metadata', () => {
    const doc = parseMarkdown('![one](/one)<!-- inkio:image caption -->*![two](/two)*');
    expect(doc.content?.filter(block => block.type === 'imageBlock').map(block => block.attrs?.src)).toEqual(['/one', '/two']);
  });

  it('keeps labels but never an unsafe image destination', () => {
    const md = stringifyMarkdown({ ...image, attrs: { ...image.attrs, src: 'javascript:bad' } });
    expect(md).not.toContain('javascript:');
    expect(getSchema(getSchemaExtensions()).nodeFromJSON(parseMarkdown(md)).textContent).toContain('A | B <img> & *more*');
  });

  it('lifts inline and marked images in order without losing surrounding text marks', () => {
    const doc = parseMarkdown('**Before ![alt][pic] after** ![](/empty) end\n\n[pic]: /photo "Credit"');
    expect(doc.content?.map(node => node.type)).toEqual(['paragraph', 'imageBlock', 'paragraph', 'imageBlock', 'paragraph']);
    expect(doc.content?.[0].content?.[0]).toEqual({ type: 'text', text: 'Before ', marks: [{ type: 'bold' }] });
    expect(doc.content?.[1].attrs).toEqual({ src: '/photo', alt: 'alt', title: 'Credit' });
    expect(doc.content?.[2].content?.[0]).toEqual({ type: 'text', text: ' after', marks: [{ type: 'bold' }] });
    expect(doc.content?.[3].attrs?.src).toBe('/empty');
    expect(doc.content?.[4]).toEqual(paragraph(' end'));
  });

  it('satisfies paragraph-first list schemas without discarding the following blocks', () => {
    const schema = getSchema(getSchemaExtensions());
    const doc = parseMarkdown('- ![alt](/photo)\n\n  tail\n- ## Heading\n- [x] ![](/checked)');
    schema.nodeFromJSON(doc).check();
    expect(doc.content?.[0].content?.map(item => item.content?.map(block => block.type))).toEqual([
      ['paragraph', 'imageBlock', 'paragraph'], ['paragraph', 'heading'],
    ]);
    expect(doc.content?.[1].content?.[0]).toMatchObject({ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }, { type: 'imageBlock' }] });
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(doc);
  });

  it('keeps a checked task when only a heading follows its required empty paragraph', () => {
    const task = {
      type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [
        { type: 'paragraph' }, { type: 'heading', attrs: { level: 2 }, content: [text('Later')] },
      ] }],
    };
    expect(parseMarkdown(stringifyMarkdown(task)).content).toEqual([task]);
  });

  it('preserves cell images and flattens nonparagraph labels without breaking a GFM row', () => {
    const table: JSONContent = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [
      image,
      { type: 'heading', attrs: { level: 2 }, content: [text('By '), { type: 'mention', attrs: { id: '1', label: 'Ada' } }] },
    ] }, { type: 'tableHeader', content: [paragraph('Next')] }] }] };
    const doc = parseMarkdown(stringifyMarkdown(table));
    const cells = doc.content?.[0].content?.[0].content;
    expect(cells).toHaveLength(2);
    expect(cells?.[0].content?.[0]).toEqual(image);
    expect(cells?.[0].content?.[1].content?.[0].text?.trim()).toBe('By @Ada');
    expect(cells?.[1].content).toEqual([paragraph('Next')]);
  });

  it('rejects a merge that covers an image-only cell', () => {
    const doc = parseMarkdown('<!-- inkio:table-spans 0,0,2,1 -->\n\n| One | ![alt](/photo) |\n| - | - |');
    expect(doc.content?.[0].content?.[0].content).toHaveLength(2);
    expect(doc.content?.[0].content?.[0].content?.[1].content?.[0].type).toBe('imageBlock');
  });

  it('writes an open details block with plain visible reference labels and escaped summary markup', () => {
    const details: JSONContent = { type: 'details', attrs: { open: true }, content: [
      { type: 'detailsSummary', content: [text('Before <'), { type: 'mention', attrs: { id: 'Ada' } }, text('> After')] },
      { type: 'detailsContent', content: [paragraph('Body')] },
    ] };
    const md = stringifyMarkdown(details);
    expect(md).toContain('<details open>\n<summary>Before &lt;@Ada&gt; After</summary>');
    expect(parseMarkdown(md).content?.[0]).toMatchObject({
      type: 'details', attrs: { open: true }, content: [
        { type: 'detailsSummary', content: [text('Before <@Ada> After')] }, { type: 'detailsContent', content: [paragraph('Body')] },
      ],
    });
  });

  it('preserves footnote reference and definition labels as ordinary visible text', () => {
    const doc = parseMarkdown('a[^Source]b\n\n[^Source]: Original **note**');
    expect(doc.content).toEqual([
      paragraph('a[^Source]b'),
      { type: 'paragraph', content: [text('[^Source]: Original '), { type: 'text', text: 'note', marks: [{ type: 'bold' }] }] },
    ]);
    expect(parseMarkdown(stringifyMarkdown(doc))).toEqual(doc);
  });
});
