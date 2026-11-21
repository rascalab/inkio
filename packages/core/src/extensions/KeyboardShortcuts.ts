import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Selection, TextSelection, type EditorState } from '@tiptap/pm/state';
import { runOptionalChainCommand } from './optional-commands';
import { planAdjacentBlockMove } from './adjacent-block-move';

interface BlockContext {
  blockNode: ProseMirrorNode;
  blockPos: number;
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
        blockNode: node,
        blockPos: $from.before(depth),
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
  // Direct view.dispatch bypasses the command pipeline, so editable must be
  // checked here: keymaps still fire in a read-only Viewer.
  if (!editor.isEditable) {
    return false;
  }
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
  // Same direct-dispatch bypass as duplicateCurrentBlock (see above).
  if (!editor.isEditable) {
    return false;
  }
  const context = findCurrentBlockContext(editor.state);

  if (!context) {
    return false;
  }

  const move = planAdjacentBlockMove(editor.state.doc, context.blockPos, direction);
  if (!move) return false;
  const transaction = editor.state.tr.step(move.step);
  transaction.setSelection(Selection.near(transaction.doc.resolve(move.selectionPos)));
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
