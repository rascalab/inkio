import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { parseMarkdown, stringifyMarkdown } from '../index';

describe('advanced inline nodes', () => {
  it('round-trips wiki links through [[name]] syntax', () => {
    const json = parseMarkdown('See [[Guide]] for details.');
    const para = json.content?.[0];
    expect(para?.content).toContainEqual({ type: 'wikiLink', attrs: { href: 'Guide' } });
    // Exported unescaped so other markdown tools still see a wiki link.
    const md2 = stringifyMarkdown(json);
    expect(md2).toBe('See [[Guide]] for details.');
    const json2 = parseMarkdown(md2);
    expect(json2.content?.[0]?.content).toContainEqual({ type: 'wikiLink', attrs: { href: 'Guide' } });
    expect(stringifyMarkdown(json2)).toBe(md2);
  });

  it('round-trips wiki names with spaces and underscores', () => {
    const md = 'See [[Release Notes]] and [[my_page_name]].';
    const json = parseMarkdown(md);
    expect(json.content?.[0]?.content?.filter((node) => node.type === 'wikiLink')).toEqual([
      { type: 'wikiLink', attrs: { href: 'Release Notes' } },
      { type: 'wikiLink', attrs: { href: 'my_page_name' } },
    ]);
    expect(stringifyMarkdown(json)).toBe(md);
  });

  it('keeps unsafe wiki targets as plain text', () => {
    const json = parseMarkdown('See [[javascript:alert(1)]] now.');
    const inlines = json.content?.[0]?.content ?? [];
    expect(inlines.some((node) => node.type === 'wikiLink')).toBe(false);
    expect(stringifyMarkdown(json)).not.toContain('wikiLink');
  });

  it('exports mentions as @text and does not reparse emails', () => {
    const md = stringifyMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'mention', attrs: { id: 'u1', label: 'Alice' } },
          { type: 'text', text: ' mail me at a@b.com' },
        ],
      }],
    });
    expect(md).toContain('@Alice');
    const back = parseMarkdown(md);
    const inlines = back.content?.[0]?.content ?? [];
    expect(inlines.some((node) => node.type === 'mention')).toBe(false);
  });

  it('exports bookmarks as links and drops comments', () => {
    const md = stringifyMarkdown({
      type: 'doc',
      content: [
        { type: 'bookmark', attrs: { url: 'https://example.com', title: 'Example' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'comment', attrs: { commentId: 'c1' } }] }] },
      ],
    });
    expect(md).toContain('[Example](https://example.com)');
    expect(md).toContain('hi');
    expect(md).not.toContain('comment');
  });

  it('exports wiki names containing brackets as plain text, not links', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'wikiLink', attrs: { href: 'https://x.test/a]]b' } }],
        },
      ],
    } as unknown as JSONContent;
    const printed = stringifyMarkdown(content);
    expect(printed).not.toContain('[[');
    // The mdast printer escapes the colon; what matters is no link
    // syntax is produced and the full href survives.
    expect(printed).toContain('https\\://x.test/a]]b');
  });
});

describe('@inkio/core/markdown', () => {
  it('parses and stringifies core markdown features', () => {
    const markdown = [
      '# Hello',
      '',
      'Paragraph with **bold**, *italic*, ~~strike~~, and `code`.',
      '',
      '- one',
      '- two',
      '',
      '- [x] done',
      '- [ ] todo',
      '',
      '---',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const content = parseMarkdown(markdown);
    const roundTrip = stringifyMarkdown(content);

    const nodes = content.content ?? [];
    expect(content.type).toBe('doc');
    expect(nodes.some((node) => node.type === 'heading' && node.attrs?.level === 1)).toBe(true);
    expect(nodes.some((node) => node.type === 'bulletList')).toBe(true);
    expect(nodes.some((node) => node.type === 'taskList')).toBe(true);
    expect(nodes.some((node) => node.type === 'horizontalRule')).toBe(true);
    expect(nodes.some((node) => node.type === 'codeBlock' && node.attrs?.language === 'ts')).toBe(true);

    expect(roundTrip).toContain('# Hello');
    expect(roundTrip).toMatch(/[*-] \[x\] done/);
    expect(roundTrip).toContain('```ts');
  });

  it('round-trips essential callouts', () => {
    const markdown = ':::callout{color="blue" icon="lightbulb"}\nHello callout\n:::';
    const content = parseMarkdown(markdown);

    expect(content.content?.[0]).toMatchObject({
      type: 'callout',
      attrs: {
        color: 'blue',
        icon: 'lightbulb',
      },
    });

    expect(stringifyMarkdown(content)).toBe(markdown);
  });

  it('round-trips details blocks using canonical html syntax', () => {
    const markdown = [
      '<details>',
      '<summary>More</summary>',
      '',
      'Inside details',
      '</details>',
    ].join('\n');

    const content = parseMarkdown(markdown);

    expect(content.content?.[0]).toMatchObject({
      type: 'details',
      content: [
        { type: 'detailsSummary' },
        { type: 'detailsContent' },
      ],
    });

    expect(stringifyMarkdown(content)).toBe(markdown);
  });

  it('round-trips gfm tables', () => {
    const markdown = [
      '| Name | Count |',
      '| --- | --- |',
      '| Inkio | 2 |',
    ].join('\n');

    const content = parseMarkdown(markdown);
    const table = content.content?.[0];

    expect(table).toMatchObject({
      type: 'table',
      content: [
        { type: 'tableRow' },
        { type: 'tableRow' },
      ],
    });

    const roundTrip = stringifyMarkdown(content);
    expect(roundTrip).toContain('| Name');
    expect(roundTrip).toContain('Count |');
    expect(roundTrip).toContain('| Inkio | 2');
  });

  it('keeps every block of a multi-block table cell instead of the first only', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
                    { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const markdown = stringifyMarkdown(content);
    expect(markdown).toContain('first');
    expect(markdown).toContain('second');
  });

  it('degrades advanced-only nodes to markdown-safe output', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'mini', label: 'mini' } },
            { type: 'text', text: ' ' },
            { type: 'hashTag', attrs: { id: 'inkio', label: 'inkio' } },
            { type: 'text', text: ' ' },
            { type: 'wikiLink', attrs: { href: '/docs', label: 'Docs' } },
          ],
        },
        {
          type: 'bookmark',
          attrs: {
            url: 'https://example.com',
            title: 'Example',
          },
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'commented',
              marks: [{ type: 'comment', attrs: { threadId: 't1' } }],
            },
          ],
        },
      ],
    };

    const markdown = stringifyMarkdown(content);

    expect(markdown).toContain('@mini');
    expect(markdown).toContain('#inkio');
    expect(markdown).toContain('Docs');
    expect(markdown).toContain('[Example](https://example.com)');
    expect(markdown).toContain('commented');
    expect(markdown).not.toContain('threadId');
  });

  it('falls back unknown html blocks to plain text paragraphs', () => {
    const markdown = '<custom-widget foo="bar"></custom-widget>';
    const content = parseMarkdown(markdown);

    expect(content).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '<custom-widget foo="bar"></custom-widget>',
            },
          ],
        },
      ],
    });
  });

});

describe('text written as it reads', () => {
  it('keeps a number range readable and unstruck', () => {
    const markdown = 'REQ-3~5, REQ-7~9 기간은 3~5일';
    const json = parseMarkdown(markdown);
    expect(json.content?.[0]?.content).toEqual([{ type: 'text', text: markdown }]);
    expect(stringifyMarkdown(json)).toBe(markdown);
  });

  it('still reads and writes strikethrough with two tildes', () => {
    const json = parseMarkdown('a ~~gone~~ b');
    expect(json.content?.[0]?.content?.[1]).toEqual({
      type: 'text',
      text: 'gone',
      marks: [{ type: 'strike' }],
    });
    expect(stringifyMarkdown(json)).toBe('a ~~gone~~ b');
  });

  it('escapes tildes that would start strikethrough or touch a mark', () => {
    const doubled = stringifyMarkdown({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a~~b~~c' }] }],
    });
    expect(parseMarkdown(doubled).content?.[0]?.content).toEqual([{ type: 'text', text: 'a~~b~~c' }]);

    const touching = stringifyMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a~' },
          { type: 'text', text: 'b', marks: [{ type: 'strike' }] },
        ],
      }],
    });
    expect(parseMarkdown(touching).content?.[0]?.content).toEqual([
      { type: 'text', text: 'a~' },
      { type: 'text', text: 'b', marks: [{ type: 'strike' }] },
    ]);
  });

  it('keeps an underscore inside a word and escapes one that could emphasize', () => {
    expect(stringifyMarkdown(parseMarkdown('user_id 값과 사용자_이름'))).toBe('user_id 값과 사용자_이름');

    const emphasis = stringifyMarkdown({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a _b_ c' }] }],
    });
    expect(parseMarkdown(emphasis).content?.[0]?.content).toEqual([{ type: 'text', text: 'a _b_ c' }]);
  });

  it('writes list items without blank lines between them', () => {
    const markdown = '- 하나\n- 둘\n\n1. 첫째\n2. 둘째\n\n- [x] 끝\n- [ ] 남음';
    expect(stringifyMarkdown(parseMarkdown(markdown))).toBe(markdown);
  });

  it('keeps nested lists and an item with two paragraphs readable', () => {
    const nested = '- 위\n  - 아래\n- 다음';
    expect(stringifyMarkdown(parseMarkdown(nested))).toBe(nested);

    const twoParagraphs = '- 첫 문단\n\n  둘째 문단\n- 다음';
    const json = parseMarkdown(twoParagraphs);
    expect(json.content?.[0]?.content?.[0]?.content).toHaveLength(2);
    expect(parseMarkdown(stringifyMarkdown(json))).toEqual(json);
  });
});

describe('a typed tab', () => {
  it('survives a round trip inside and at the start of a line', () => {
    for (const text of ['가\t나', '\t가']) {
      const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
      expect(parseMarkdown(stringifyMarkdown(doc)).content?.[0]?.content).toEqual([{ type: 'text', text }]);
    }
  });
});
