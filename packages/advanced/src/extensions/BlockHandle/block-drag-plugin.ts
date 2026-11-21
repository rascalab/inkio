import React from 'react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
  InkioCoreMessageOverrides,
} from '@inkio/core';
import {
  createInkioIconElement,
  GripVerticalIconNode,
  type InkioIconRegistry,
} from '@inkio/core/icons';
import type { Editor } from '@tiptap/core';
import {
  createOverlayHost,
  editorUi,
  editorUiRevision,
  mergeCoreMessages,
  toCoreMessageOverrides,
  type OverlayHost,
} from '@inkio/core';
import { findHoveredBlock, getVisibleBlockPos, isHTMLElement, isInEditor, positionHandle, type HoveredBlock } from './block-drop';
import { createBlockMenu } from './block-menu';
import { createBlockDragVisuals, syncTheme } from './drag-visuals';
import { createNativeBlockDrag } from './native-drag';
import { createTouchBlockDrag } from './touch-drag';
import type { BlockMenuIcons } from './icons';

export interface BlockHandlePluginState {
  activeBlockPos: number | null;
  activeBlockElement: HTMLElement | null;
}

interface BlockHandlePluginOptions {
  handleWidth: number;
  editor: Editor;
  icons?: BlockMenuIcons;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  coreIcons?: Partial<InkioIconRegistry>;
}

const HANDLE_CLASS_NAME = 'inkio-block-handle';
const HIDE_DELAY_MS = 120;
const GRIP_PROPS = { size: 20, strokeWidth: 1.8 };

type HandleState = BlockHandlePluginState & { highlight: DecorationSet };
export const blockHandlePluginKey = new PluginKey<BlockHandlePluginState>('blockHandle');
const HIGHLIGHT_META = 'inkio:block-handle-highlight';

const createHandleElement = (doc: Document, label: string, withDefaultIcon: boolean) => {
  const handle = doc.createElement('button');
  handle.type = 'button';
  handle.className = `inkio ${HANDLE_CLASS_NAME}`;
  handle.setAttribute('draggable', 'true');
  handle.setAttribute('data-block-handle', '');
  handle.setAttribute('aria-label', label);
  handle.setAttribute('aria-haspopup', 'menu');
  handle.setAttribute('aria-expanded', 'false');
  handle.tabIndex = -1;
  handle.setAttribute('aria-keyshortcuts', 'Shift+F10');

  if (!withDefaultIcon) return handle;
  const icon = createInkioIconElement(GripVerticalIconNode, {
    ...GRIP_PROPS,
    className: 'inkio-block-handle-dots',
  });
  icon.setAttribute('aria-hidden', 'true');
  handle.appendChild(icon);

  return handle;
};

const updateState = (view: EditorView, next: BlockHandlePluginState) => {
  const current = blockHandlePluginKey.getState(view.state);
  if (current?.activeBlockPos === next.activeBlockPos && current?.activeBlockElement === next.activeBlockElement) return;
  view.dispatch(view.state.tr.setMeta(blockHandlePluginKey, next).setMeta('addToHistory', false));
};

const getScrollParent = (element: HTMLElement) => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return parent;
  }
  return window;
};

const mountBlockHandle = (view: EditorView, options: BlockHandlePluginOptions) => {
  const doc = view.dom.ownerDocument;
  const controller = new AbortController();
  const { signal } = controller;
  const currentUi = () => editorUi(options.editor, {
    locale: options.locale,
    messages: options.messages,
    icons: options.coreIcons,
  });
  const handleLabel = () => {
    const ui = currentUi();
    return mergeCoreMessages(ui.locale, toCoreMessageOverrides(ui.messages)).blockHandle.handle;
  };
  let uiRevision = editorUiRevision(options.editor);
  const Grip = currentUi().icons?.grip;
  const handle = createHandleElement(doc, handleLabel(), !Grip);
  doc.body.appendChild(handle);
  let gripHost: OverlayHost | null = null;
  if (Grip) {
    gripHost = createOverlayHost({ parent: handle, className: 'inkio-block-handle-grip', label: 'block handle icon' });
    gripHost.render(React.createElement(Grip, GRIP_PROPS));
  }

  let active: HoveredBlock | null = null;
  let positioned: { block: HoveredBlock; doc: ProseMirrorNode } | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingHover: PointerEvent | null = null;
  let hoverFrame = 0;
  let positionFrame = 0;

  const clearHideTimer = () => {
    clearTimeout(hideTimer);
    hideTimer = undefined;
  };
  const menu = createBlockMenu({
    view, handle, signal, editor: options.editor, icons: options.icons, currentUi,
    onHighlight: (transaction, pos) => view.dispatch(transaction.setMeta(HIGHLIGHT_META, pos).setMeta('addToHistory', false)),
    onMove: (transaction, movedTo) => {
      view.dispatch(transaction.setMeta(blockHandlePluginKey, {
        activeBlockPos: movedTo,
        activeBlockElement: null,
      } satisfies BlockHandlePluginState));
    },
  });
  const visuals = createBlockDragVisuals(view);
  const onLift = () => {
    menu.close();
    menu.clearHighlight();
    clearHideTimer();
    pendingHover = null;
  };
  const dragOptions = {
    view, handle, signal, visuals,
    getBlock: () => active,
    onPress: clearHideTimer,
    onLift,
    onHide: () => hide(true),
  };
  const native = createNativeBlockDrag({
    ...dragOptions,
    isTouchPressed: (): boolean => touch.isPressed,
  });
  const touch = createTouchBlockDrag({
    ...dragOptions,
    hasNativeDrag: () => native.isActive,
    hasOpenMenu: () => menu.isOpen,
    onReveal: (block) => {
      pendingHover = null;
      clearHideTimer();
      show(block);
    },
  });

  const dragging = () => native.isActive || touch.isPressed;
  const retainsHandle = () => dragging() || touch.keepsHandle || menu.isOpen || doc.activeElement === handle;
  const measure = (block: HoveredBlock) => {
    positionHandle(handle, block.blockElement, options.handleWidth);
    positioned = { block, doc: view.state.doc };
  };
  const schedulePosition = () => {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      if (active) measure(active);
    });
  };
  const markVisible = (visible: boolean) => {
    handle.classList.toggle('visible', visible);
    handle.tabIndex = visible ? 0 : -1;
  };
  function show(block: HoveredBlock) {
    if (!view.editable) return;
    const previous = active;
    active = previous?.blockPos === block.blockPos && previous.blockElement === block.blockElement ? previous : block;
    syncTheme(handle, view.dom);
    measure(active);
    markVisible(true);
    if (active !== previous) updateState(view, { activeBlockPos: block.blockPos, activeBlockElement: block.blockElement });
  }
  function hide(force = false) {
    if (!force && retainsHandle()) return;
    touch.forgetHandle();
    markVisible(false);
    if (force || active) {
      active = null;
      updateState(view, { activeBlockPos: null, activeBlockElement: null });
    }
  }
  const scheduleHide = () => {
    if (retainsHandle()) return;
    clearHideTimer();
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  };

  handle.addEventListener('mouseenter', clearHideTimer, { signal });
  handle.addEventListener('mouseleave', scheduleHide, { signal });
  handle.addEventListener('blur', scheduleHide, { signal });
  handle.addEventListener('click', (event) => {
    if (!view.editable || dragging() || !active) return;
    event.preventDefault();
    event.stopPropagation();
    clearHideTimer();
    menu.activate(active);
  }, { signal });

  const onScroll = () => {
    if (native.isActive) native.refreshMarker();
    else if (touch.isPressed) touch.refreshMarker();
    else schedulePosition();
  };
  getScrollParent(view.dom).addEventListener('scroll', onScroll, { passive: true, signal });

  return {
    get hasHighlight() { return view.editable && menu.hasHighlight; },
    touch,
    pointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        touch.pointerMove(event);
        return;
      }
      if (!view.editable || dragging() || doc.activeElement === handle) return;
      touch.forgetHandle();
      clearHideTimer();
      if (!isInEditor(view, event)) {
        scheduleHide();
        return;
      }
      if (menu.hasHighlight) return;
      // posAtCoords and handle geometry are read at most once per frame.
      pendingHover = event;
      if (hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        const coords = pendingHover;
        pendingHover = null;
        if (!coords || dragging() || touch.keepsHandle) return;
        const block = findHoveredBlock(view, coords.clientX, coords.clientY);
        if (!block) {
          scheduleHide();
          return;
        }
        show(block);
        if (menu.isOpen) menu.refresh();
      });
    },
    pointerLeave(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      if (event.relatedTarget instanceof Node && handle.contains(event.relatedTarget)) return;
      scheduleHide();
    },
    keyDown(event: KeyboardEvent) {
      const contextKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
      if (!contextKey || event.isComposing || !view.editable || dragging()) return false;
      const { selection } = view.state;
      const blockPos = selection instanceof NodeSelection && selection.node.isBlock
        ? selection.from
        : getVisibleBlockPos(selection.$head);
      if (blockPos === null) return false;
      const blockElement = view.nodeDOM(blockPos);
      if (!isHTMLElement(blockElement)) return false;
      event.preventDefault();
      show({ blockPos, blockElement });
      handle.click();
      return true;
    },
    handleDrop(event: DragEvent, move: boolean) {
      if (native.isActive) return native.handleDrop(event, move);
      menu.close();
      hide();
      return false;
    },
    update(nextView: EditorView, prevState: EditorView['state']) {
      native.update();
      if (touch.update()) active = null;

      const revision = editorUiRevision(options.editor);
      if (revision !== uiRevision) {
        uiRevision = revision;
        syncTheme(handle, nextView.dom);
        visuals.syncTheme();
        handle.setAttribute('aria-label', handleLabel());
        const Icon = currentUi().icons?.grip;
        if (Icon) gripHost?.render(React.createElement(Icon, GRIP_PROPS));
      }
      if (nextView.state.doc !== prevState.doc && menu.isOpen) menu.close();

      const nextPos = blockHandlePluginKey.getState(nextView.state)?.activeBlockPos;
      if (!nextView.editable || !active || nextPos == null) {
        if (!nextView.editable) menu.clearHighlight();
        touch.forgetHandle();
        markVisible(false);
        active = null;
        menu.close();
        return;
      }
      const element = nextView.nodeDOM(nextPos);
      if (!isHTMLElement(element)) {
        menu.close();
        hide(true);
        return;
      }
      if (dragging()) return;

      if (active.blockPos !== nextPos || active.blockElement !== element) {
        active = { blockPos: nextPos, blockElement: element };
      }
      // Don't move the anchor under an open menu or read layout on selection-only updates.
      if (!menu.isOpen && (positioned?.block !== active || positioned.doc !== nextView.state.doc)) {
        if (handle.classList.contains('visible')) schedulePosition();
        else measure(active);
      }
      markVisible(true);
      if (menu.isOpen) menu.refresh();
    },
    destroy() {
      controller.abort();
      native.destroy();
      touch.destroy();
      clearHideTimer();
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      if (positionFrame) cancelAnimationFrame(positionFrame);
      menu.destroy();
      gripHost?.destroy();
      handle.remove();
    },
  };
};

export const createBlockHandlePlugin = (options: BlockHandlePluginOptions) => {
  let handle: ReturnType<typeof mountBlockHandle> | null = null;
  return new Plugin<HandleState>({
    key: blockHandlePluginKey,
    state: {
      init: () => ({ activeBlockPos: null, activeBlockElement: null, highlight: DecorationSet.empty }),
      apply: (tr, current) => {
        const meta = tr.getMeta(blockHandlePluginKey) as BlockHandlePluginState | undefined;
        const selected = tr.getMeta(HIGHLIGHT_META) as number | null | undefined;
        if (!tr.docChanged && !meta && selected === undefined) return current;
        const pos = current.activeBlockPos;
        const mapped = tr.docChanged && pos !== null
          ? { activeBlockPos: tr.mapping.map(pos), activeBlockElement: null }
          : current;
        let highlight = tr.docChanged ? DecorationSet.empty : current.highlight;
        if (selected !== undefined) {
          const node = selected === null ? null : tr.doc.nodeAt(selected);
          // A decoration survives ProseMirror rebuilding the block after focus leaves.
          highlight = selected !== null && node?.isBlock
            ? DecorationSet.create(tr.doc, [Decoration.node(selected, selected + node.nodeSize, { class: 'inkio-block-selected' })])
            : DecorationSet.empty;
        }
        return { ...mapped, ...meta, highlight };
      },
    },
    props: {
      decorations(state) {
        return handle?.hasHighlight ? this.getState(state)?.highlight : null;
      },
      handleDOMEvents: {
        pointerdown: (_view, event) => { handle?.touch.pointerDown(event); return false; },
        pointerup: (_view, event) => { handle?.touch.pointerUp(event); return false; },
        pointercancel: (_view, event) => { handle?.touch.pointerCancel(event); return false; },
        pointermove: (_view, event) => { handle?.pointerMove(event); return false; },
        pointerleave: (_view, event) => { handle?.pointerLeave(event); return false; },
        keydown: (_view, event) => handle?.keyDown(event) ?? false,
      },
      handleDrop: (_view, event, _slice, move) => handle?.handleDrop(event, move) ?? false,
    },
    view: (view) => {
      const instance = mountBlockHandle(view, options);
      handle = instance;
      return {
        update: instance.update,
        destroy: () => {
          handle = null;
          instance.destroy();
        },
      };
    },
  });
};
