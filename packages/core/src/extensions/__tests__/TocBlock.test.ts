import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TocBlock } from '../TocBlock';
import { getExtensions } from '../get-extensions';
import { resolveInkioExtensions } from '../resolve-extensions';

describe('resolveInkioExtensions empty-vs-undefined', () => {
  it('returns defaults for undefined', () => {
    expect(resolveInkioExtensions(undefined)).toHaveLength(getExtensions({}).length);
  });

  it('returns a bare set for an explicit empty array', () => {
    expect(resolveInkioExtensions([])).toEqual([]);
  });
});

describe('TocBlock', () => {
  it('is included in default extensions', () => {
    const extensions = getExtensions({});
    expect(extensions.some((ext) => ext.name === 'tocBlock')).toBe(true);
  });

  it('can be disabled', () => {
    const extensions = getExtensions({ tocBlock: false });
    expect(extensions.some((ext) => ext.name === 'tocBlock')).toBe(false);
  });

  it('seeds inserted blocks with the configured maxLevel', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, TocBlock.configure({ maxLevel: 2 })],
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.insertContent({ type: 'tocBlock' });
    const json = editor.getJSON().content as Array<{ attrs?: Record<string, unknown> }>;
    expect(json[0]?.attrs?.maxLevel).toBe(2);
    editor.destroy();
  });

  it('forwards maxLevel from getExtensions options', () => {
    const configured = getExtensions({ tocBlock: { maxLevel: 4 } }).find(
      (ext) => ext.name === 'tocBlock',
    );
    expect(configured?.options.maxLevel).toBe(4);
  });
});
