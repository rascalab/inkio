import { describe, expect, it } from 'vitest';
import { getExtensions } from '../../extensions/get-extensions';
import { MAX_TABLE_COLUMNS, MAX_TABLE_SLOTS } from '../../utils/table-bounds';
import { normalizeInkioContent, renderInkioStaticContent } from '../render-static-content';

const extensions = getExtensions();

describe('static render: sanitizes documents and reports limits', () => {
  it('returns an empty shell for invalid documents instead of throwing', () => {
    const bad = { type: 'doc', content: [{ type: 'nope', content: 'x' }] } as never;
    const result = renderInkioStaticContent(bad, extensions);
    expect(typeof result.html).toBe('string');
  });

  it('strips script tags and event handlers from raw HTML input', () => {
    const result = renderInkioStaticContent(
      '<p onclick="evil()">hi</p><script>alert(1)</script>',
      extensions,
    );
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onclick');
    expect(result.html).toContain('hi');
  });

  it('drops unsafe link targets from generated JSON output', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'click',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }],
      }],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('click');
  });

  it('renders unsafe image sources as placeholders, not img tags', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'imageBlock', attrs: { src: 'javascript:alert(1)' } }],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('<img');
  });

  it('preserves comparison text like a<3 instead of stripping it as markup', () => {
    const json = normalizeInkioContent('a<3 and 1<2 are true');
    expect(JSON.stringify(json)).toContain('a<3');
    expect(JSON.stringify(json)).toContain('1<2');
    expect(normalizeInkioContent('<p>Sales <!-- editor note --> rose</p>').content?.[0]?.content?.[0]?.text)
      .toBe('Sales rose');
  });

  it('keeps ordinary table merges in raw HTML and generated JSON', () => {
    const html = '<table><tr><th colspan="2">Report</th></tr><tr><td>May</td><td>June</td></tr></table>';
    expect(renderInkioStaticContent(html, extensions).html).toContain('colspan="2"');
    const cell = (type: string, text: string, attrs?: { colspan: number }) => ({
      type, attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    const json = { type: 'doc', content: [{ type: 'table', content: [
      { type: 'tableRow', content: [cell('tableHeader', 'Report', { colspan: 2 })] },
      { type: 'tableRow', content: [cell('tableCell', 'May'), cell('tableCell', 'June')] },
    ] }] };
    expect(renderInkioStaticContent(json, extensions).html).toContain('colspan="2"');
  });

  it('checks the expanded size of a spreadsheet report, not only its stored cells', () => {
    const rows = Math.floor(MAX_TABLE_SLOTS / MAX_TABLE_COLUMNS) + 1;
    const row = `<tr><td colspan="${MAX_TABLE_COLUMNS}">Group total</td></tr>`;
    expect(() => renderInkioStaticContent(
      `<p>Report</p><table>${row.repeat(rows)}</table>`,
      extensions,
    )).toThrow(/table.*limit/i);
    const report = { type: 'doc', content: [{ type: 'table', content: Array.from({ length: rows }, () => ({
      type: 'tableRow', content: [{
        type: 'tableCell',
        attrs: { colspan: MAX_TABLE_COLUMNS },
        content: [{ type: 'paragraph' }],
      }],
    })) }] };
    expect(() => renderInkioStaticContent(report, extensions)).toThrow(/table.*limit/i);
  });

  it('keeps only disabled task checkboxes in static output', () => {
    const result = renderInkioStaticContent(
      '<p><input type="text"><input type="checkbox"></p>' +
      '<ul data-type="taskList"><li data-type="taskItem"><label>' +
      '<input type="checkbox" checked>Done</label></li></ul>',
      extensions,
    );
    expect(result.html.match(/<input\b/g)).toHaveLength(1);
    expect(result.html).toMatch(/<input type="checkbox"[^>]*\bdisabled\b/);
    expect(result.html).toMatch(/<input type="checkbox"[^>]*\bchecked\b/);
    expect(result.html).toContain('Done');
  });

  it('rejects a report over the input budget before rendering', () => {
    const text = 'Monthly report. '.repeat(140_000);
    expect(() => renderInkioStaticContent(`<p>${text}</p>`, extensions)).toThrow(/static.*limit/i);
    expect(() => renderInkioStaticContent({
      type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    }, extensions)).toThrow(/static.*limit/i);
  });

  it('injects stable heading ids for anchors', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello World' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello World' }] },
      ],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).toContain('id="hello-world"');
    expect(result.html).toContain('id="hello-world-1"');
    expect(result.headings).toHaveLength(2);
  });
});
