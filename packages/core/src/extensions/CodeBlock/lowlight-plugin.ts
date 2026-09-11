import { findChildren } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Step } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import highlight from 'highlight.js/lib/core';
import type { InkioLowlight } from './hljs-lazy';

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

function registered(aliasOrLanguage: string): boolean {
  return Boolean(highlight.getLanguage(aliasOrLanguage));
}

function getDecorations({
  doc,
  name,
  lowlight,
  defaultLanguage,
}: {
  doc: ProseMirrorNode;
  name: string;
  lowlight: InkioLowlight;
  defaultLanguage: string | null | undefined;
}): DecorationSet {
  const decorations: Decoration[] = [];
  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    let from = block.pos + 1;
    const language = block.node.attrs.language || defaultLanguage;
    const languages = lowlight.listLanguages();
    const nodes =
      language &&
      (languages.includes(language) ||
        registered(language) ||
        lowlight.registered?.(language))
        ? getHighlightNodes(lowlight.highlight(language, block.node.textContent))
        : getHighlightNodes(lowlight.highlightAuto(block.node.textContent));
    parseNodes(nodes as Parameters<typeof parseNodes>[0]).forEach((node) => {
      const to = from + node.text.length;
      if (node.classes.length) {
        const decoration = Decoration.inline(from, to, {
          class: node.classes.join(' '),
        });
        decorations.push(decoration);
      }
      from = to;
    });
  });
  return DecorationSet.create(doc, decorations);
}

function isFunction(param: unknown): param is (...args: never[]) => unknown {
  return typeof param === 'function';
}

/**
 * Fork of tiptap's LowlightPlugin with one change: when nothing needs
 * recomputing, the incoming `decorationSet` is returned AS-IS instead of a
 * mapped copy. tiptap's version always returns
 * `decorationSet.map(...)` — a fresh object every transaction — which makes
 * ProseMirror refresh outer decorations on EVERY node view, and tiptap's
 * React layer re-renders every portal (`setRenderer` storm, O(views) per
 * keystroke). Returning the identical set lets ProseMirror skip all of that.
 */
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
  const lowlightPlugin: Plugin = new Plugin({
    key: new PluginKey('lowlight'),
    state: {
      init: (_: unknown, { doc }: { doc: ProseMirrorNode }) =>
        getDecorations({
          doc,
          name,
          lowlight,
          defaultLanguage,
        }),
      apply: (
        transaction: Transaction,
        decorationSet: DecorationSet,
        oldState: EditorState,
        newState: EditorState,
      ) => {
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name);
        const newNodes = findChildren(newState.doc, (node) => node.type.name === name);
        if (
          transaction.docChanged && // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) || // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length || // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step: Step) => {
              const from = (step as unknown as { from?: number }).from;
              const to = (step as unknown as { to?: number }).to;
              return (
                from !== undefined &&
                to !== undefined &&
                oldNodes.some((node) => node.pos >= from && node.pos + node.node.nodeSize <= to)
              );
            })))
          {
          return getDecorations({
            doc: transaction.doc,
            name,
            lowlight,
            defaultLanguage,
          });
        }
        const mapped = decorationSet.map(transaction.mapping, transaction.doc);
        // DecorationSet.eq exists at runtime but is missing from the
        // published types.
        const unchanged = (
          mapped as unknown as { eq(other: DecorationSet): boolean }
        ).eq(decorationSet);
        return unchanged ? decorationSet : mapped;
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
