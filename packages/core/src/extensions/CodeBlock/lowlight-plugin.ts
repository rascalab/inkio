import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import highlight from 'highlight.js/lib/core';
import { clampRange, collectChangedRanges } from '../../utils/changed-ranges';

export type InkioLowlight = ReturnType<typeof import('lowlight').createLowlight>;

function parseNodes(
  nodes: Array<{ value?: string; children?: unknown; properties?: { className?: string[] } }>,
  className: string[] = [],
): Array<{ text: string; classes: string[] }> {
  return nodes.flatMap((node) => {
    const classes = [...className, ...(node.properties ? (node.properties.className ?? []) : [])];
    if (node.children) {
      return parseNodes(node.children as typeof nodes, classes);
    }
    return {
      text: node.value ?? '',
      classes,
    };
  });
}

function getHighlightNodes(result: { value?: unknown; children?: unknown }): unknown[] {
  const value = result.value as unknown[] | undefined;
  const children = result.children as unknown[] | undefined;
  return value || children || [];
}

/**
 * A throwing grammar must degrade to plain text, never break the
 * ProseMirror transaction that asked for decorations.
 */
function safeHighlight(
  run: () => { value?: unknown; children?: unknown },
): { value?: unknown; children?: unknown } {
  try {
    return run();
  } catch {
    return { value: [] };
  }
}

/**
 * Transaction meta that forces a full rehighlight without a doc change, e.g.
 * after a lazy grammar registers (see `refreshCodeBlockDecorations`).
 */
export const LOWLIGHT_REFRESH_META = 'inkioLowlightRefresh';

function isFunction(param: unknown): param is (...args: never[]) => unknown {
  return typeof param === 'function';
}

/** Highlight changed code blocks, preserving mapped decorations elsewhere. */
export function InkioLowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string;
  lowlight: InkioLowlight;
  defaultLanguage: string | null | undefined;
}): Plugin {
  if (!['highlight', 'highlightAuto', 'listLanguages'].every((api) => isFunction(lowlight[api as keyof InkioLowlight]))) {
    throw Error('You should provide an instance of lowlight to use the code-block-lowlight extension');
  }

  const highlightBlock = (node: ProseMirrorNode, pos: number, decorations: Decoration[]) => {
    const language = node.attrs.language || defaultLanguage;
    const source = node.textContent;
    const result =
      language &&
      (highlight.getLanguage(language) ||
        (lowlight.registered?.(language) ?? lowlight.listLanguages().includes(language)))
        ? safeHighlight(() => lowlight.highlight(language, source))
        : safeHighlight(() => lowlight.highlightAuto(source));
    const nodes = getHighlightNodes(result) as Parameters<typeof parseNodes>[0];
    let from = pos + 1;
    for (const { text, classes } of parseNodes(nodes)) {
      const to = from + text.length;
      if (classes.length) {
        decorations.push(Decoration.inline(from, to, { class: classes.join(' ') }));
      }
      from = to;
    }
  };

  const highlightDocument = (doc: ProseMirrorNode): DecorationSet => {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === name) highlightBlock(node, pos, decorations);
      return !node.isTextblock;
    });
    return DecorationSet.create(doc, decorations);
  };

  const lowlightPlugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
    key: new PluginKey('lowlight'),
    state: {
      init: (_, { doc }) => highlightDocument(doc),
      apply(transaction, decorationSet) {
        const { doc, mapping } = transaction;
        if (transaction.getMeta(LOWLIGHT_REFRESH_META)) return highlightDocument(doc);
        if (!transaction.docChanged) return decorationSet;

        const mapped = decorationSet.map(mapping, doc);
        const touched = new Set<number>();
        const remove: Decoration[] = [];
        const add: Decoration[] = [];
        for (const range of collectChangedRanges([transaction])) {
          const [from, to] = clampRange(doc, range);
          // A collapsed range still visits its ancestors (e.g. text deleted
          // inside a code block), but skips adjacent blocks at node boundaries.
          doc.nodesBetween(from, to, (node, pos) => {
            if (!node.isTextblock) return true;
            if (touched.has(pos)) return false;
            touched.add(pos);
            // Cover any textblock here: changing a code block to a paragraph
            // can preserve its inline decorations through the step's mapping.
            for (const decoration of mapped.find(pos + 1, pos + node.nodeSize - 1)) {
              remove.push(decoration);
            }
            if (node.type.name === name) highlightBlock(node, pos, add);
            return false;
          });
        }

        const next = mapped.remove(remove).add(doc, add);
        // DecorationSet.eq exists at runtime but is missing from its types.
        // Keep the original set when its coordinates and tokens are identical.
        const comparable = next as DecorationSet & { eq(other: DecorationSet): boolean };
        return comparable.eq(decorationSet) ? decorationSet : next;
      },
    },
    props: {
      decorations(state: EditorState) {
        return lowlightPlugin.getState(state);
      },
    },
  });
  return lowlightPlugin;
}
