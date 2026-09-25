import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export const mentionClickPluginKey = new PluginKey('mentionClick');
export const hashTagClickPluginKey = new PluginKey('hashTagClick');

/**
 * Shared click handling for inline atom nodes (mention/hashTag) that render
 * static spans with no node view: resolves the node at the click position
 * and reports its id. Returns false always so default selection behavior is
 * preserved; the callback is purely observational.
 */
export function createInlineNodeClickPlugin(
  pluginKey: PluginKey,
  nodeName: string,
  getOnClick: () => ((id: string) => void) | undefined,
): Plugin {
  return new Plugin({
    key: pluginKey,
    props: {
      handleClick(view: EditorView, pos: number) {
        const onClick = getOnClick();
        if (!onClick) return false;
        let node;
        try {
          node = view.state.doc.nodeAt(pos);
        } catch {
          return false;
        }
        if (!node || node.type.name !== nodeName) return false;
        const id = (node.attrs as Record<string, unknown>).id;
        if (typeof id !== 'string' || !id) return false;
        onClick(id);
        return false;
      },
    },
  });
}
