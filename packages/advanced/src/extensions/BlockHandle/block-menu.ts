import React from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { createOverlayHost, toRectLike, type EditorUi, type OverlayHost } from '@inkio/core';
import { BlockHandleActionMenu, fingerprintBlockAt, type BlockFingerprint } from './BlockHandleView';
import type { HoveredBlock } from './block-drop';
import type { BlockMenuIcons } from './icons';

interface BlockMenuOptions {
  view: EditorView;
  handle: HTMLButtonElement;
  signal: AbortSignal;
  editor: Editor;
  icons?: BlockMenuIcons;
  currentUi: () => EditorUi;
  onHighlight: (transaction: Transaction, pos: number | null) => void;
  onMove: (transaction: Transaction, movedTo: number) => void;
}

interface OpenRequest {
  blockPos: number;
  fingerprint: BlockFingerprint | null;
}

export function createBlockMenu({
  view,
  handle,
  signal,
  editor,
  icons,
  currentUi,
  onHighlight,
  onMove,
}: BlockMenuOptions) {
  const ownerDocument = view.dom.ownerDocument;
  let host: OverlayHost | null = null;
  let request: OpenRequest | null = null;
  let highlighted = false;

  const getAnchorRect = () => toRectLike(handle.getBoundingClientRect());

  function clearHighlight() {
    if (!highlighted) return;
    highlighted = false;
    view.dom.removeEventListener('mousedown', clearHighlight);
    ownerDocument.removeEventListener('keydown', clearHighlight, true);
    if (!signal.aborted && view.editable) onHighlight(view.state.tr, null);
  }

  function close() {
    request = null;
    handle.setAttribute('aria-expanded', 'false');
    if (host?.isMounted()) host.render(null);
  }

  function move(transaction: Transaction, movedTo: number) {
    clearHighlight();
    onMove(transaction, movedTo);
  }

  function refresh() {
    if (!host) return;
    host.syncTheme();
    if (!request || !host.isMounted()) return;

    const ui = currentUi();
    host.render(
      React.createElement(BlockHandleActionMenu, {
        editor,
        blockPos: request.blockPos,
        blockFingerprint: request.fingerprint,
        anchorRect: getAnchorRect(),
        anchorResolver: getAnchorRect,
        icons,
        locale: ui.locale,
        messages: ui.messages,
        coreIcons: ui.icons,
        onClose: close,
        onMove: move,
      }),
    );
  }

  function open(blockPos: number) {
    if (signal.aborted || !view.editable) return;
    const opening = { blockPos, fingerprint: fingerprintBlockAt(editor.state.doc, blockPos) };
    request = opening;
    handle.setAttribute('aria-expanded', 'true');

    if (!host || host.isDestroyed()) {
      host = createOverlayHost({
        editorDom: view.dom,
        className: 'inkio inkio-block-handle-portal',
        label: 'block menu',
      });
    }
    host.ready().then((mounted) => {
      if (request !== opening) return;
      if (mounted) refresh();
      else close();
    }).catch(() => {
      if (request === opening) close();
    });
  }

  function activate({ blockPos }: HoveredBlock) {
    if (signal.aborted || !view.editable) return;

    highlighted = true;
    view.dom.addEventListener('mousedown', clearHighlight, { once: true, signal });
    // The shortcut opens from the editor's keydown handler. Capture only
    // the next key, not the bubbling event that just opened the menu.
    ownerDocument.addEventListener('keydown', clearHighlight, { once: true, capture: true, signal });

    const node = view.state.doc.nodeAt(blockPos);
    const transaction = view.state.tr;
    if ((node?.isAtom || node?.isLeaf) && NodeSelection.isSelectable(node)) {
      transaction.setSelection(NodeSelection.create(view.state.doc, blockPos));
    }
    onHighlight(transaction, blockPos);
    if (signal.aborted) return;
    view.focus();

    const anchor = getAnchorRect();
    view.dom.dispatchEvent(new CustomEvent('inkio:block-menu', {
      bubbles: true,
      detail: {
        blockPos,
        position: { top: anchor.bottom, left: anchor.left },
      },
    }));
    open(blockPos);
  }

  function destroy() {
    close();
    clearHighlight();
    host?.destroy();
    host = null;
  }

  return {
    get isOpen() { return request !== null; },
    get hasHighlight() { return highlighted; },
    activate,
    close,
    clearHighlight,
    refresh,
    destroy,
  };
}
