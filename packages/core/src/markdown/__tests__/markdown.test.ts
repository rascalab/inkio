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

describe('merged table cells', () => {
  const cell = (text: string, attrs?: Record<string, number>, type = 'tableCell') => ({
    type,
    ...(attrs ? { attrs } : {}),
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const merged = {
    type: 'doc',
    content: [{
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('가', { colspan: 2, rowspan: 1 }, 'tableHeader'), cell('다', undefined, 'tableHeader')] },
        { type: 'tableRow', content: [cell('라', { colspan: 1, rowspan: 2 }), cell('마'), cell('바')] },
        { type: 'tableRow', content: [cell('아'), cell('자')] },
      ],
    }],
  };

  it('keeps every value in its column for other tools', () => {
    const markdown = stringifyMarkdown(merged);
    expect(markdown).toContain('<!-- inkio:table-spans 0,0,2,1 1,0,1,2 -->');
    expect(markdown.replace(/ +/g, ' ')).toContain('| 가 | | 다 |');
    expect(markdown.replace(/ +/g, ' ')).toContain('| | 아 | 자 |');
  });

  it('restores the merges when read back', () => {
    expect(parseMarkdown(stringifyMarkdown(merged))).toEqual(merged);
  });

  it('adds no comment to a table without merges', () => {
    const markdown = '| a | b |\n| - | - |\n| 1 | 2 |';
    expect(stringifyMarkdown(parseMarkdown(markdown))).toBe(markdown);
  });

  it('ignores a span that does not fit, or that would swallow text', () => {
    const table = '| a | b |\n| - | - |\n| 1 | 2 |';
    for (const spans of ['0,0,5,1', '0,0,2,1', '9,9,2,2', '0,0,1,1']) {
      const json = parseMarkdown(`<!-- inkio:table-spans ${spans} -->\n\n${table}`);
      expect(json.content?.[0]?.type).toBe('table');
      expect(JSON.stringify(json)).not.toContain('colspan');
      expect(JSON.stringify(json)).toContain('"b"');
    }
  });

  it('writes spans it cannot trust as plain cells', () => {
    for (const attrs of [
      { colspan: 1_000_000_000, rowspan: 1_000_000_000 },
      { colspan: -2, rowspan: 1 },
      { colspan: 1.5, rowspan: 1 },
    ]) {
      const markdown = stringifyMarkdown({
        type: 'doc',
        content: [{ type: 'table', content: [
          { type: 'tableRow', content: [cell('가', attrs, 'tableHeader'), cell('나', undefined, 'tableHeader')] },
        ] }],
      });
      expect(markdown).not.toContain('inkio:table-spans');
      expect(markdown.replace(/ +/g, ' ')).toContain('| 가 | 나 |');
    }
  });

  it('limits a row span to the rows the table has', () => {
    const markdown = stringifyMarkdown({
      type: 'doc',
      content: [{ type: 'table', content: [
        { type: 'tableRow', content: [cell('가', { colspan: 1, rowspan: 1_000_000 }, 'tableHeader'), cell('나', undefined, 'tableHeader')] },
        { type: 'tableRow', content: [cell('다')] },
      ] }],
    });
    expect(markdown).toContain('<!-- inkio:table-spans 0,0,1,2 -->');
  });

  it('does not let spans grow a small document into a huge table', () => {
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      type: 'tableRow',
      content: [cell(`${index}`, index === 0 ? { colspan: 90_000, rowspan: 1 } : undefined)],
    }));
    const markdown = stringifyMarkdown({ type: 'doc', content: [{ type: 'table', content: rows }] });
    expect(markdown).not.toContain('inkio:table-spans');
    expect(markdown.length).toBeLessThan(100_000);
  });

  it('counts how far merges push later cells', () => {
    // Small spans in the first row push the second row right, widening all 2000 rows.
    const width = 300;
    const rows = [
      { type: 'tableRow', content: Array.from({ length: width }, () => cell('가', { colspan: 1, rowspan: 2 })) },
      { type: 'tableRow', content: Array.from({ length: width }, () => cell('나')) },
      ...Array.from({ length: 1998 }, () => ({ type: 'tableRow', content: [cell('다')] })),
    ];
    const markdown = stringifyMarkdown({ type: 'doc', content: [{ type: 'table', content: rows }] });
    expect(markdown).not.toContain('inkio:table-spans');
  });

  it('charges the work of a table that gives up its merges', () => {
    const tooWide = {
      type: 'table',
      content: [{ type: 'tableRow', content: [cell('가', { colspan: 99_999, rowspan: 1 })] }],
    };
    const small = {
      type: 'table',
      content: [{ type: 'tableRow', content: [cell('나', { colspan: 2, rowspan: 1 })] }],
    };
    const markdown = stringifyMarkdown({ type: 'doc', content: [tooWide, small] });
    expect(markdown).not.toContain('inkio:table-spans');
  });

  it('counts the cells spans add across the whole document', () => {
    const wideTable = {
      type: 'table',
      content: [{ type: 'tableRow', content: [cell('가', { colspan: 40_000, rowspan: 1 })] }],
    };
    const document = { type: 'doc', content: [wideTable, wideTable, wideTable] };

    // The first fits. The other two would pass the limit, so they stay plain.
    expect(stringifyMarkdown(document).match(/inkio:table-spans/g)).toHaveLength(1);
    // Each document starts over.
    expect(stringifyMarkdown(document).match(/inkio:table-spans/g)).toHaveLength(1);
  });

  it('refuses a malformed table that padding would blow up, and writes the next document', () => {
    const malformed = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [
          { type: 'tableRow', content: Array.from({ length: 2000 }, () => cell('가')) },
          ...Array.from({ length: 1000 }, () => ({ type: 'tableRow', content: [cell('나')] })),
        ],
      }],
    };
    expect(() => stringifyMarkdown(malformed)).toThrow(RangeError);
    expect(stringifyMarkdown(merged)).toContain('inkio:table-spans');
  });

  it('writes a large rectangular table, which pads nothing', () => {
    const row = { type: 'tableRow', content: Array.from({ length: 50 }, () => cell('가')) };
    const table = { type: 'table', content: Array.from({ length: 2000 }, () => row) };
    expect(stringifyMarkdown({ type: 'doc', content: [table] })).toContain('| 가');
  });

  it('leaves a comment with no table after it as text', () => {
    const json = parseMarkdown('<!-- inkio:table-spans 0,0,2,1 -->\n\n문단');
    expect(json.content?.[0]?.content?.[0]?.text).toContain('inkio:table-spans');
  });
});
