import { Editor, getSchema, type JSONContent } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { describe, expect, it, vi } from 'vitest';
import { getExtensions } from '../get-extensions';
import { MAX_TABLE_COLUMNS, MAX_TABLE_SPAN } from '../../utils/table-bounds';

const extensions = getExtensions();
const paragraph: JSONContent = { type: 'paragraph', content: [{ type: 'text', text: 'Report' }] };

function tableWithColumnCount(columns: number): JSONContent {
  return {
    type: 'table',
    content: [{
      type: 'tableRow',
      content: Array.from({ length: columns }, () => ({ type: 'tableCell', content: [paragraph] })),
    }],
  };
}

describe('live table bounds', () => {
  it('keeps a normally merged table through HTML load, replacement and paste', () => {
    const merged = '<table><tr><th rowspan="2">Heading</th><td>A</td></tr>' +
      '<tr><td>B</td></tr><tr><td colspan="2">Total</td></tr></table>';
    const editor = new Editor({ extensions, content: `<p>Before</p>${merged}<p>After</p>` });
    try {
      expect(editor.getHTML()).toContain('colspan="2"');
      expect(editor.getHTML()).toContain('rowspan="2"');
      expect(editor.getText()).toContain('After');
      expect(editor.commands.setContent('<p>Paste here</p>')).toBe(true);
      editor.view.pasteHTML(merged, new Event('paste') as ClipboardEvent);
      expect(editor.getHTML()).toContain('colspan="2"');
    } finally {
      editor.destroy();
    }
  });

  it('rejects a paste that would grow an existing table past the column limit', () => {
    const editor = new Editor({
      extensions,
      content: { type: 'doc', content: [tableWithColumnCount(MAX_TABLE_COLUMNS)] },
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const row = editor.state.doc.firstChild!.firstChild!;
      const lastCellText = 4 + row.content.size - row.lastChild!.nodeSize;
      editor.commands.setTextSelection(lastCellText);
      editor.view.pasteHTML(
        '<table><tr><td>Previous month</td><td>Latest month</td></tr></table>',
        new Event('paste') as ClipboardEvent,
      );
      expect(editor.state.doc.firstChild?.firstChild?.childCount).toBe(MAX_TABLE_COLUMNS);
      expect(editor.getText()).not.toContain('Latest month');
      expect(warning).toHaveBeenCalledWith(expect.stringMatching(/table.*limit/i));
    } finally {
      warning.mockRestore();
      editor.destroy();
    }
  });

  it('keeps the surrounding HTML when a spreadsheet is too wide to import', () => {
    const row = '<td>Quarterly total</td>'.repeat(MAX_TABLE_COLUMNS + 1);
    const report = `<p>Before report</p><table><tr>${row}</tr></table><p>After report</p>`;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = new Editor({ extensions, content: report });
    try {
      expect(editor.getText()).toContain('After report');
      expect(editor.getHTML()).not.toContain('<table');
      expect(editor.commands.setContent(report)).toBe(true);
      expect(editor.getText()).toContain('Before report');
      expect(editor.getHTML()).not.toContain('<table');
      editor.commands.clearContent();
      editor.view.pasteHTML(report, new Event('paste') as ClipboardEvent);
      expect(editor.getText()).toContain('After report');
      expect(editor.getHTML()).not.toContain('<table');
      expect(warning).toHaveBeenCalledWith(expect.stringMatching(/table.*limit/i));
    } finally {
      editor.destroy();
      warning.mockRestore();
    }
  });

  it('normalizes imported cell spans without losing nearby text', () => {
    const report: JSONContent = {
      type: 'doc',
      content: [paragraph, {
        type: 'table',
        content: [{ type: 'tableRow', content: [{
          type: 'tableHeader', attrs: { colspan: MAX_TABLE_SPAN + 1 }, content: [paragraph],
        }] }],
      }],
    };
    const editor = new Editor({ extensions, content: report });
    try {
      expect(editor.getText()).toContain('Report');
      expect(editor.getHTML()).toContain(`colspan="${MAX_TABLE_SPAN}"`);
      expect(editor.commands.setContent(report, { errorOnInvalidContent: true })).toBe(true);
      expect(editor.getHTML()).toContain(`colspan="${MAX_TABLE_SPAN}"`);
    } finally {
      editor.destroy();
    }
  });

  it('rejects an oversized report explicitly without replacing the current document', () => {
    const report = { type: 'doc', content: [paragraph, tableWithColumnCount(MAX_TABLE_COLUMNS + 1)] };
    expect(() => new Editor({ extensions, content: report })).toThrow(/table.*limit/i);
    const editor = new Editor({ extensions, content: '<p>Keep this</p>' });
    try {
      expect(() => editor.commands.setContent(report)).toThrow(/table.*limit/i);
      expect(editor.getText()).toBe('Keep this');
    } finally {
      editor.destroy();
    }
  });

  it('declares valid spans in the schema and rejects over-budget schema-built updates', () => {
    const schema = getSchema(extensions);
    const header = schema.node('tableHeader', { colspan: 2 }, schema.nodeFromJSON(paragraph));
    expect(() => header.check()).not.toThrow();
    expect(() => schema.node('tableHeader', { colspan: MAX_TABLE_SPAN + 1 }, schema.nodeFromJSON(paragraph)))
      .toThrow(/span/i);

    const editor = new Editor({ extensions, content: '<p>Keep this</p>' });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const rows = tableWithColumnCount(MAX_TABLE_COLUMNS + 1).content!.map((row) => editor.schema.nodeFromJSON(row));
      const table = editor.schema.node('table', null, rows);
      editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, Fragment.from(table)));
      expect(editor.getText()).toBe('Keep this');
      expect(warning).toHaveBeenCalledWith(expect.stringMatching(/table.*limit/i));
    } finally {
      warning.mockRestore();
      editor.destroy();
    }
  });
});
