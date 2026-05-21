import { describe, it, expect } from 'vitest';
import { parseMarkdown, stringifyMarkdown } from '../index';

// Round-trip idempotence for every core markdown construct:
// parse -> stringify -> parse must yield a stable JSONContent and a stable markdown string.
const cases: Record<string, string> = {
  'heading levels': '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6',
  'inline marks': 'text **bold** *italic* ~~strike~~ `code` and [link](https://example.com)',
  'bullet list': '- one\n- two\n- three',
  'nested bullet list': '- one\n  - nested a\n  - nested b\n- two',
  'ordered list': '1. one\n2. two\n3. three',
  'ordered list with start': '5. five\n\n6. six',
  'task list': '- [ ] undone\n- [x] done',
  'blockquote': '> quoted line one\n> quoted line two',
  'code block with lang': '```js\nconst x = 1;\nconst y = 2;\n```',
  'code block no lang': '```\nplain code\n```',
  'horizontal rule': 'before\n\n---\n\nafter',
  'gfm table': '| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |',
  'callout directive': ':::callout{color="blue"}\n\nCallout body text.\n\n:::',
  'details block': '<details>\n<summary>Summary</summary>\n\nHidden body.\n\n</details>',
  'standalone image': '![alt text](https://example.com/i.png)',
  'hard break': 'line one\\\nline two',
  'mixed document': '# Title\n\nIntro **para** with `code`.\n\n- a\n- b\n\n> note\n\n```ts\nok();\n```\n\n| x | y |\n| - | - |\n| 1 | 2 |\n\n---\n\nEnd.',
};

describe('markdown round-trip idempotence', () => {
  for (const [name, md] of Object.entries(cases)) {
    it(`stays stable: ${name}`, () => {
      const json1 = parseMarkdown(md);
      const md2 = stringifyMarkdown(json1);
      const json2 = parseMarkdown(md2);
      const md3 = stringifyMarkdown(json2);
      expect(json2).toEqual(json1);
      expect(md3).toEqual(md2);
    });
  }

  it('produces a doc root with expected block types for the mixed document', () => {
    const doc = parseMarkdown(cases['mixed document']);
    expect(doc.type).toBe('doc');
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual([
      'heading', 'paragraph', 'bulletList', 'blockquote', 'codeBlock', 'table', 'horizontalRule', 'paragraph',
    ]);
  });
});
