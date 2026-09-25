import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Callout } from '../Callout';

function createEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, Callout],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
  });
}

function calloutColor(editor: Editor): unknown {
  let color: unknown = null;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'callout') {
      color = node.attrs.color;
      return false;
    }
    return true;
  });
  return color;
}

describe('Callout color boundary', () => {
  it('rejects unsafe colors in updateCalloutColor', () => {
    const editor = createEditor();
    try {
      editor.commands.setCallout({ color: 'blue' });
      expect(calloutColor(editor)).toBe('blue');
      expect(editor.commands.updateCalloutColor('javascript:alert(1)')).toBe(false);
      expect(calloutColor(editor)).toBe('blue');
    } finally {
      editor.destroy();
    }
  });

  it('strips unsafe colors in setCallout instead of persisting them', () => {
    const editor = createEditor();
    try {
      editor.commands.setCallout({ color: 'expression(alert(1))' });
      expect(calloutColor(editor)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it('keeps presets and safe custom colors', () => {
    const editor = createEditor();
    try {
      editor.commands.setCallout({ color: '#ff0000' });
      expect(calloutColor(editor)).toBe('#ff0000');
    } finally {
      editor.destroy();
    }
  });
});
