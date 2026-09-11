import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { WikiLink } from '../extensions/WikiLink';

function createEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, WikiLink],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });
}

function wikiLinkHrefs(editor: Editor): string[] {
  const hrefs: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'wikiLink') {
      hrefs.push(String(node.attrs.href ?? ''));
    }
  });
  return hrefs;
}

function inputRulePlugin(editor: Editor) {
  const plugin = editor.state.plugins.find(
    (candidate) => typeof candidate.props.handleTextInput === 'function',
  );
  expect(plugin).toBeDefined();
  return plugin!;
}

/**
 * WikiLink targets must reject javascript:/data:/vbscript: on
 * create (input/paste rules), on HTML parse, and on render.
 */
describe('WikiLink href validation', () => {
  it('input rule ignores dangerous targets but accepts plain page names', () => {
    const editor = createEditor();
    try {
      const plugin = inputRulePlugin(editor);

      const handledBad = plugin.props.handleTextInput!(
        editor.view,
        1,
        1,
        '[[javascript:alert(1)]]',
      );
      expect(handledBad).toBe(false);
      expect(wikiLinkHrefs(editor)).toEqual([]);

      const handledGood = plugin.props.handleTextInput!(editor.view, 1, 1, '[[My Page]]');
      expect(handledGood).toBe(true);
      expect(wikiLinkHrefs(editor)).toEqual(['My Page']);
    } finally {
      editor.destroy();
    }
  });

  it('parseHTML drops unsafe wiki-link targets', () => {
    const editor = createEditor();
    try {
      editor.commands.setContent('<p><span data-wiki-link>javascript:alert(1)</span></p>');
      expect(wikiLinkHrefs(editor).some((href) => href.includes('javascript:'))).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('renderHTML never emits an unsafe href', () => {
    const editor = createEditor();
    try {
      editor.commands.insertContent({
        type: 'paragraph',
        content: [{ type: 'wikiLink', attrs: { href: 'javascript:alert(1)' } }],
      });
      // Serialized HTML (used by copy/export paths) must not carry the payload.
      expect(editor.getHTML()).not.toContain('javascript:');
    } finally {
      editor.destroy();
    }
  });
});
