import { Extension, type Editor } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection, type EditorState } from '@tiptap/pm/state';
import { runOptionalChainCommand } from './optional-commands';

interface BlockContext {
  blockIndex: number;
  blockNode: ProseMirrorNode;
  blockPos: number;
  parentNode: ProseMirrorNode;
  parentStart: number;
}

const findCurrentBlockContext = (state: EditorState): BlockContext | null => {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);

    if (!node.isBlock) {
      continue;
    }

    const parentDepth = depth - 1;
    const parentNode = parentDepth === 0 ? state.doc : $from.node(parentDepth);
    const parentName = parentNode.type.name;

    // Stop at direct children of doc, or items inside list containers.
    // This ensures Mod-D on a list item duplicates the whole listItem,
    // not the paragraph inside it.
    if (
      parentDepth === 0 ||
      parentName === 'bulletList' ||
      parentName === 'orderedList' ||
      parentName === 'taskList'
    ) {
      return {
        blockIndex: $from.index(parentDepth),
        blockNode: node,
        blockPos: $from.before(depth),
        parentNode,
        parentStart: parentDepth === 0 ? 0 : $from.start(parentDepth),
      };
    }
  }

  return null;
};

const setNearestSelectionInside = (
  selectionPos: number,
  state: {
    doc: EditorState['doc'];
  }
) => {
  const resolvedPos = state.doc.resolve(Math.max(0, Math.min(selectionPos, state.doc.content.size)));
  return TextSelection.near(resolvedPos);
};

const duplicateCurrentBlock = (editor: Editor): boolean => {
  const context = findCurrentBlockContext(editor.state);

  if (!context) {
    return false;
  }

  const insertPos = context.blockPos + context.blockNode.nodeSize;
  const transaction = editor.state.tr.insert(insertPos, context.blockNode);
  transaction.setSelection(setNearestSelectionInside(insertPos + 1, transaction));

  editor.view.dispatch(transaction.scrollIntoView());
  return true;
};

const moveCurrentBlock = (editor: Editor, direction: -1 | 1): boolean => {
  const context = findCurrentBlockContext(editor.state);

  if (!context) {
    return false;
  }

  const targetIndex = context.blockIndex + direction;

  if (targetIndex < 0 || targetIndex >= context.parentNode.childCount) {
    return false;
  }

  const children: ProseMirrorNode[] = [];
  context.parentNode.forEach((child) => {
    children.push(child);
  });

  [children[context.blockIndex], children[targetIndex]] = [
    children[targetIndex],
    children[context.blockIndex],
  ];

  const transaction = editor.state.tr.replaceWith(
    context.parentStart,
    context.parentStart + context.parentNode.content.size,
    Fragment.fromArray(children)
  );

  const newBlockPos =
    context.parentStart +
    children.slice(0, targetIndex).reduce((sum, node) => sum + node.nodeSize, 0);

  transaction.setSelection(setNearestSelectionInside(newBlockPos + 1, transaction));
  editor.view.dispatch(transaction.scrollIntoView());

  return true;
};

export const KeyboardShortcuts = Extension.create({
  name: 'keyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': ({ editor }) => runOptionalChainCommand(editor, 'toggleStrike'),
      'Mod-e': ({ editor }) => runOptionalChainCommand(editor, 'toggleCode'),
      'Mod-Shift-h': ({ editor }) => runOptionalChainCommand(editor, 'toggleHighlight'),
      'Mod-d': ({ editor }) => duplicateCurrentBlock(editor),
      'Mod-Shift-ArrowUp': ({ editor }) => moveCurrentBlock(editor, -1),
      'Mod-Shift-ArrowDown': ({ editor }) => moveCurrentBlock(editor, 1),
      'Mod-Alt-1': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 1 } }),
      'Mod-Alt-2': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 2 } }),
      'Mod-Alt-3': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 3 } }),
      'Mod-Alt-4': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 4 } }),
      'Mod-Alt-5': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 5 } }),
      'Mod-Alt-6': ({ editor }) => runOptionalChainCommand(editor, 'setHeading', { args: { level: 6 } }),
      'Mod-Alt-0': ({ editor }) => runOptionalChainCommand(editor, 'setParagraph'),
    };
  },
});
