import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { Plugin } from '@tiptap/pm/state';
import { HashTag } from '../extensions/HashTag';
import { Mention } from '../extensions/Mention';
import {
  hashTagClickPluginKey,
  mentionClickPluginKey,
} from '../extensions/inline-node-click';

function createEditor(options: {
  onMentionClick?: (id: string) => void;
  onHashtagClick?: (id: string) => void;
}) {
  return new Editor({
    element: document.createElement('div'),
    editable: true,
    extensions: [
      Document,
      Paragraph,
      Text,
      Mention.configure({ onClick: options.onMentionClick }),
      HashTag.configure({ onClick: options.onHashtagClick }),
    ],
    content: '<p>hi</p>',
  });
}

function clickPlugin(editor: Editor, key: unknown): Plugin {
  const plugin = editor.state.plugins.find(
    (candidate) => (candidate.spec as { key?: unknown }).key === key,
  );
  expect(plugin).toBeDefined();
  return plugin!;
}

function nodePos(editor: Editor, typeName: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found === -1 && node.type.name === typeName) {
      found = pos;
    }
  });
  expect(found).toBeGreaterThanOrEqual(0);
  return found;
}

/**
 * Adapter navigation callbacks must reach the document: clicks on mention /
 * hashtag nodes report their id without altering selection behavior.
 */
describe('mention/hashTag click callbacks', () => {
  it('reports mention clicks with the node id', () => {
    const onMentionClick = vi.fn();
    const editor = createEditor({ onMentionClick });
    try {
      editor.commands.insertMention({ id: 'u1', label: 'Ann' });
      const plugin = clickPlugin(editor, mentionClickPluginKey);
      const result = plugin.props.handleClick?.(
        editor.view,
        nodePos(editor, 'mention'),
        {} as MouseEvent,
      );
      expect(onMentionClick).toHaveBeenCalledWith('u1');
      expect(result).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('reports hashtag clicks with the node id', () => {
    const onHashtagClick = vi.fn();
    const editor = createEditor({ onHashtagClick });
    try {
      editor.commands.insertHashTag({ id: 'inkio', label: 'inkio' });
      const plugin = clickPlugin(editor, hashTagClickPluginKey);
      const result = plugin.props.handleClick?.(
        editor.view,
        nodePos(editor, 'hashTag'),
        {} as MouseEvent,
      );
      expect(onHashtagClick).toHaveBeenCalledWith('inkio');
      expect(result).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('ignores clicks on other nodes and missing callbacks', () => {
    const onMentionClick = vi.fn();
    const editor = createEditor({ onMentionClick });
    try {
      const plugin = clickPlugin(editor, mentionClickPluginKey);
      const result = plugin.props.handleClick?.(editor.view, 0, {} as MouseEvent);
      expect(result).toBe(false);
      expect(onMentionClick).not.toHaveBeenCalled();
    } finally {
      editor.destroy();
    }
  });
});
