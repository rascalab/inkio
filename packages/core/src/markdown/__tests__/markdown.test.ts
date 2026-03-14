import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { parseMarkdown, stringifyMarkdown } from '../index';

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
