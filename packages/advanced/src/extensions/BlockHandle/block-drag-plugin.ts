import React from 'react';
import { DOMSerializer, Fragment, Slice, type ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
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
import type { Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { BlockHandleActionMenu } from './BlockHandleView';
import type { BlockMenuIcons } from './icons';
import { getCreateRoot } from '../../utils/create-root';

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

interface HoveredBlock {
  blockPos: number;
  blockElement: HTMLElement;
}

interface AnchorRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

const HANDLE_CLASS_NAME = 'inkio-block-handle';
const HIDE_DELAY_MS = 120;
const HANDLE_SIZE = 24;

export const blockHandlePluginKey = new PluginKey<BlockHandlePluginState>('blockHandle');

const isHTMLElement = (value: unknown): value is HTMLElement => value instanceof HTMLElement;

const createHandleElement = () => {
  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS_NAME;
  handle.setAttribute('draggable', 'true');
  handle.setAttribute('data-block-handle', '');
  handle.setAttribute('aria-label', 'Block handle');
  handle.style.userSelect = 'none';

  const icon = createInkioIconElement(GripVerticalIconNode, { size: 14 });
  handle.appendChild(icon);

  return handle;
};

const getVisibleBlockPos = ($pos: ResolvedPos): number | null => {
  if ($pos.depth < 1) {
    return null;
  }

  for (let depth = $pos.depth; depth >= 2; depth -= 1) {
    const node = $pos.node(depth);
    if (
      node.type.name === 'listItem'
      || node.type.name === 'taskItem'
    ) {
      return $pos.before(depth);
    }
  }

  const topLevelNode = $pos.node(1);
  if (topLevelNode.isBlock) {
    return $pos.before(1);
  }

  return null;
};

const findHoveredBlock = (view: EditorView, clientX: number, clientY: number): HoveredBlock | null => {
  const positionAtCoords = view.posAtCoords({ left: clientX, top: clientY });

  if (!positionAtCoords) {
    return null;
  }

  const resolvedPos = view.state.doc.resolve(positionAtCoords.pos);
  let blockPos = getVisibleBlockPos(resolvedPos);

  // For atom nodes (contentEditable=false), try `inside` first — it points into the node.
  if (blockPos === null && positionAtCoords.inside != null && positionAtCoords.inside >= 0) {
    try {
      const $inside = view.state.doc.resolve(positionAtCoords.inside);
      blockPos = getVisibleBlockPos($inside);
    } catch {
      // Ignore invalid positions.
    }
  }

  // For atom nodes, posAtCoords may return pos at the boundary (depth 0).
  // Check the node at `inside` or scan nearby positions.
  if (blockPos === null) {
    const checkPos = positionAtCoords.inside != null && positionAtCoords.inside >= 0
      ? positionAtCoords.inside
      : positionAtCoords.pos;
    if (checkPos >= 0 && checkPos < view.state.doc.content.size) {
      const node = view.state.doc.nodeAt(checkPos);
      if (node?.isBlock) {
        blockPos = checkPos;
      } else if (checkPos > 0) {
        const nodeBefore = view.state.doc.nodeAt(checkPos - 1);
        if (nodeBefore?.isBlock) {
          blockPos = checkPos - 1;
        }
      }
    }
  }

  if (blockPos === null) {
    const domAtCoords = document.elementFromPoint(clientX, clientY);
    if (domAtCoords) {
      let element: HTMLElement | null = domAtCoords instanceof HTMLElement ? domAtCoords : domAtCoords.parentElement;
      while (element && element !== view.dom) {
        try {
          const pos = view.posAtDOM(element, 0);
          if (pos >= 0) {
            const $pos = view.state.doc.resolve(pos);
            blockPos = getVisibleBlockPos($pos);
            if (blockPos !== null) break;
          }
        } catch {
          // Continue walking up.
        }

        element = element.parentElement;
      }
    }
  }

  if (blockPos === null) {
    return null;
  }

  const blockNode = view.state.doc.nodeAt(blockPos);
  if (!blockNode?.isBlock) {
    return null;
  }

  const blockDOM = view.nodeDOM(blockPos);
  if (!isHTMLElement(blockDOM)) {
    return null;
  }

  return {
    blockPos,
    blockElement: blockDOM,
  };
};

const FIRST_TEXT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, summary, [data-type="toc"]';

const getFirstLineHeight = (blockElement: HTMLElement): number => {
  // For blocks with nested content (lists, task items with NodeView, etc.), align to the first line
  const textEl = blockElement.querySelector(FIRST_TEXT_SELECTOR);
  if (textEl) {
    const rect = textEl.getBoundingClientRect();
    if (rect.height > 0) return rect.height;
  }

  // Fallback to computed line-height
  const style = window.getComputedStyle(blockElement);
  const lh = parseFloat(style.lineHeight);
  if (!isNaN(lh) && lh > 0) return lh;

  // Last resort
  const fs = parseFloat(style.fontSize);
  if (!isNaN(fs) && fs > 0) return fs * 1.5;

  return HANDLE_SIZE;
};

const positionHandle = (handle: HTMLElement, blockElement: HTMLElement, handleWidth: number) => {
  const blockRect = blockElement.getBoundingClientRect();

  let alignTop: number;
  let alignHeight: number;

  // Void elements (hr, etc.) — center handle vertically on the element
  const isVoid = blockElement.tagName === 'HR';
  if (isVoid) {
    const center = blockRect.top + blockRect.height / 2;
    alignTop = center - HANDLE_SIZE / 2;
    alignHeight = HANDLE_SIZE;
  } else {
    // Find the first text-containing element for precise vertical alignment.
    // Uses descendant selector (not :scope >) so it works with NodeView wrappers
    // like TaskItem (<li> > <div class="inkio-task-content"> > <p>).
    const firstTextEl = blockElement.querySelector(FIRST_TEXT_SELECTOR);
    const alignRect = firstTextEl ? firstTextEl.getBoundingClientRect() : null;

    if (alignRect && alignRect.height > 0) {
      alignTop = alignRect.top;
      alignHeight = getFirstLineHeight(firstTextEl as HTMLElement);
    } else {
      alignTop = blockRect.top;
      alignHeight = Math.min(blockRect.height, getFirstLineHeight(blockElement));
    }
  }

  // For list items, move handle left of the list markers
  let leftPos = blockRect.left - handleWidth;
  if (blockElement.tagName === 'LI') {
    const parent = blockElement.parentElement;
    if (parent) {
      const paddingLeft = parseFloat(getComputedStyle(parent).paddingLeft) || 0;
      leftPos = blockRect.left - paddingLeft - handleWidth;
    }
  }

  handle.style.position = 'fixed';
  handle.style.top = `${alignTop + Math.max(0, (alignHeight - HANDLE_SIZE) / 2)}px`;
  handle.style.left = `${Math.max(0, leftPos)}px`;
  handle.style.width = `${handleWidth}px`;
  handle.style.height = `${HANDLE_SIZE}px`;
};

function toAnchorRect(rect: DOMRect): AnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export const createBlockHandlePlugin = (options: BlockHandlePluginOptions) => {
  let handleElement: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let editorView: EditorView | null = null;
  let activeBlockPos: number | null = null;
  let activeBlockElement: HTMLElement | null = null;

  let blockSelected = false;
  let currentBlockCleanup: (() => void) | null = null;

  let menuContainer: HTMLDivElement | null = null;
  let menuRoot: Root | null = null;
  let menuReadyPromise: Promise<void> | null = null;
  let openMenuBlockPos: number | null = null;
  let abortController: AbortController | null = null;

  const clearHideTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const getHandleAnchorRect = (): AnchorRect | null => {
    if (!handleElement) {
      return null;
    }

    return toAnchorRect(handleElement.getBoundingClientRect());
  };

  const closeMenu = () => {
    openMenuBlockPos = null;
    menuRoot?.render(null);
  };

  const ensureMenuRoot = (): Promise<void> => {
    if (menuRoot) {
      return Promise.resolve();
    }

    if (!editorView) {
      return Promise.resolve();
    }

    if (!menuContainer) {
      menuContainer = document.createElement('div');
      menuContainer.className = 'inkio inkio-block-handle-portal';

      const editorElement = editorView.dom.closest('.inkio');
      if (editorElement) {
        const theme = editorElement.getAttribute('data-theme');
        if (theme) {
          menuContainer.setAttribute('data-theme', theme);
        }
      }

      document.body.appendChild(menuContainer);
    }

    if (menuReadyPromise) {
      return menuReadyPromise;
    }

    menuReadyPromise = getCreateRoot().then((createRoot) => {
      if (!menuContainer) {
        return;
      }

      menuRoot = createRoot(menuContainer);
    });

    return menuReadyPromise;
  };

  const renderMenu = () => {
    if (!menuRoot || openMenuBlockPos === null) {
      return;
    }

    menuRoot.render(
      React.createElement(BlockHandleActionMenu, {
        editor: options.editor,
        blockPos: openMenuBlockPos,
        anchorRect: getHandleAnchorRect(),
        anchorResolver: getHandleAnchorRect,
        icons: options.icons,
        locale: options.locale,
        messages: options.messages,
        coreIcons: options.coreIcons,
        onClose: closeMenu,
      }),
    );
  };

  const openMenu = (blockPos: number) => {
    openMenuBlockPos = blockPos;
    clearHideTimer();

    ensureMenuRoot().then(() => {
      if (openMenuBlockPos !== blockPos) {
        return;
      }

      renderMenu();
    });
  };

  const updateState = (view: EditorView, nextState: BlockHandlePluginState) => {
    const currentState = blockHandlePluginKey.getState(view.state);

    if (
      currentState?.activeBlockPos === nextState.activeBlockPos
      && currentState?.activeBlockElement === nextState.activeBlockElement
    ) {
      return;
    }

    const tr = view.state.tr
      .setMeta(blockHandlePluginKey, nextState)
      .setMeta('addToHistory', false);

    view.dispatch(tr);
  };

  const hideHandle = (view: EditorView, force = false) => {
    if (!force && openMenuBlockPos !== null) {
      return;
    }

    if (handleElement) {
      handleElement.classList.remove('visible');
    }

    if (activeBlockPos !== null || activeBlockElement !== null) {
      activeBlockPos = null;
      activeBlockElement = null;
      updateState(view, {
        activeBlockPos: null,
        activeBlockElement: null,
      });
    }
  };

  const showHandle = (view: EditorView, hovered: HoveredBlock) => {
    if (!handleElement) {
      return;
    }

    positionHandle(handleElement, hovered.blockElement, options.handleWidth);
    handleElement.classList.add('visible');

    if (
      activeBlockPos !== hovered.blockPos
      || activeBlockElement !== hovered.blockElement
    ) {
      activeBlockPos = hovered.blockPos;
      activeBlockElement = hovered.blockElement;
      updateState(view, {
        activeBlockPos,
        activeBlockElement,
      });
    }
  };

  const scheduleHideHandle = (view: EditorView) => {
    if (openMenuBlockPos !== null) {
      return;
    }

    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideHandle(view);
    }, HIDE_DELAY_MS);
  };

  const ensureHandleElement = () => {
    if (handleElement || !editorView) {
      return;
    }

    handleElement = createHandleElement();
    document.body.appendChild(handleElement);

    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;

    handleElement.addEventListener('mouseenter', () => {
      clearHideTimer();
    }, { signal });

    handleElement.addEventListener('mouseleave', () => {
      if (editorView) {
        scheduleHideHandle(editorView);
      }
    }, { signal });

    let capturedBlockPos: number | null = null;

    const LIST_ITEM_TYPES = new Set(['listItem', 'taskItem']);
    const LIST_TYPES_SET = new Set(['bulletList', 'orderedList', 'taskList']);

    handleElement.addEventListener('mousedown', (event) => {
      capturedBlockPos = activeBlockPos;
      event.stopPropagation();
    }, { signal });

    handleElement.addEventListener('dragstart', (event) => {
      const blockPos = capturedBlockPos ?? activeBlockPos;
      if (!editorView || blockPos === null) {
        return;
      }

      const node = editorView.state.doc.nodeAt(blockPos);
      if (!node) {
        return;
      }

      try {
        const selection = NodeSelection.create(editorView.state.doc, blockPos);
        const tr = editorView.state.tr.setSelection(selection);
        editorView.dispatch(tr);

        // For list items, wrap in parent list type to preserve ol/ul/taskList.
        // openStart=1, openEnd=1 so ProseMirror inserts just the listItem
        // when dropping inside a list, but preserves the list wrapper outside.
        let slice: Slice;
        if (LIST_ITEM_TYPES.has(node.type.name)) {
          const $pos = editorView.state.doc.resolve(blockPos);
          const parentList = $pos.parent;
          if (LIST_TYPES_SET.has(parentList.type.name)) {
            const wrappedFragment = Fragment.from(
              parentList.type.create(parentList.attrs, node),
            );
            slice = new Slice(wrappedFragment, 1, 1);
          } else {
            // Deeply nested item without a recognized list parent — use node directly.
            slice = selection.content();
          }
        } else {
          slice = selection.content();
        }

        (editorView as EditorView & { dragging?: unknown }).dragging = {
          slice,
          move: true,
        };

        if (event.dataTransfer) {
          const serializer = DOMSerializer.fromSchema(editorView.state.schema);
          const wrap = document.createElement('div');
          wrap.appendChild(serializer.serializeFragment(slice.content));

          event.dataTransfer.effectAllowed = 'copyMove';
          event.dataTransfer.setData('text/html', wrap.innerHTML);
          event.dataTransfer.setData('text/plain', node.textContent || '');
        }
      } catch {
        // Ignore stale positions when drag begins after document updates.
      }
    }, { signal });

    handleElement.addEventListener('click', (event) => {
      const posForMenu = capturedBlockPos;
      if (!editorView || posForMenu === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Clean up previous block selection before creating a new one
      if (currentBlockCleanup) currentBlockCleanup();

      const selectedEl = activeBlockElement;
      const view = editorView;

      if (selectedEl) {
        selectedEl.classList.add('inkio-block-selected');
        blockSelected = true;

        // For atom nodes, set NodeSelection (enables delete/backspace).
        const nodeAtPos = view.state.doc.nodeAt(posForMenu);
        if (nodeAtPos?.isAtom || nodeAtPos?.isLeaf) {
          try {
            const selection = NodeSelection.create(view.state.doc, posForMenu);
            view.dispatch(view.state.tr.setSelection(selection));
          } catch {
            // Ignore if NodeSelection can't be created.
          }
        }

        const cleanup = () => {
          currentBlockCleanup = null;
          selectedEl.classList.remove('inkio-block-selected');
          blockSelected = false;
          view.dom.removeEventListener('mousedown', cleanup);
          document.removeEventListener('keydown', onKeyCleanup);
        };
        const onKeyCleanup = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            // Menu closes but block stays visually selected; handle can move again
            blockSelected = false;
            document.removeEventListener('keydown', onKeyCleanup);
            return;
          }
          cleanup();
        };
        currentBlockCleanup = cleanup;
        view.dom.addEventListener('mousedown', cleanup, { once: true });
        document.addEventListener('keydown', onKeyCleanup);
      }

      editorView.focus();

      const anchor = getHandleAnchorRect();
      if (!anchor) {
        return;
      }

      const menuEvent = new CustomEvent('inkio:block-menu', {
        bubbles: true,
        detail: {
          blockPos: posForMenu,
          position: {
            top: anchor.bottom,
            left: anchor.left,
          },
        },
      });
      editorView.dom.dispatchEvent(menuEvent);

      openMenu(posForMenu);
    }, { signal });
  };

  return new Plugin<BlockHandlePluginState>({
    key: blockHandlePluginKey,
    state: {
      init: () => ({
        activeBlockPos: null,
        activeBlockElement: null,
      }),
      apply: (tr, pluginState) => {
        const meta = tr.getMeta(blockHandlePluginKey) as BlockHandlePluginState | undefined;

        let nextState = pluginState;

        if (tr.docChanged) {
          if (nextState.activeBlockPos !== null) {
            nextState = {
              ...nextState,
              activeBlockPos: tr.mapping.map(nextState.activeBlockPos),
              activeBlockElement: null,
            };
          }
        }

        if (meta) {
          nextState = {
            ...nextState,
            ...meta,
          };
        }

        return nextState;
      },
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!handleElement) {
            return false;
          }

          const target = event.target;
          if (target instanceof Node && handleElement.contains(target)) {
            clearHideTimer();
            return false;
          }

          clearHideTimer();

          // Only show handle when mouse is within the editor's content area
          const editorRect = view.dom.getBoundingClientRect();
          if (
            event.clientX < editorRect.left
            || event.clientX > editorRect.right
            || event.clientY < editorRect.top
            || event.clientY > editorRect.bottom
          ) {
            scheduleHideHandle(view);
            return false;
          }

          // Don't move handle while a block is selected
          if (blockSelected) {
            return false;
          }

          const hovered = findHoveredBlock(view, event.clientX, event.clientY);
          if (!hovered) {
            scheduleHideHandle(view);
            return false;
          }

          showHandle(view, hovered);
          if (openMenuBlockPos !== null) {
            renderMenu();
          }
          return false;
        },
        mouseleave: (view, event) => {
          if (!handleElement) {
            return false;
          }

          const relatedTarget = event.relatedTarget;
          if (relatedTarget instanceof Node && handleElement.contains(relatedTarget)) {
            return false;
          }

          scheduleHideHandle(view);
          return false;
        },
      },
      handleDrop: (view) => {
        closeMenu();
        hideHandle(view);
        return false;
      },
    },
    view: (view) => {
      editorView = view;
      ensureHandleElement();

      const scrollParent = (() => {
        let el: HTMLElement | null = view.dom.parentElement;
        while (el) {
          const overflow = getComputedStyle(el).overflowY;
          if (overflow === 'auto' || overflow === 'scroll') return el;
          el = el.parentElement;
        }
        return window;
      })();

      const handleScroll = () => {
        if (!handleElement) return;

        if (activeBlockElement && activeBlockPos !== null) {
          positionHandle(handleElement, activeBlockElement, options.handleWidth);
        }
      };

      scrollParent.addEventListener('scroll', handleScroll, { passive: true });

      return {
        update: (nextView, prevState) => {
          editorView = nextView;

          // Remap openMenuBlockPos when the document changes.
          // Done here in the view update (not in plugin state apply) to avoid
          // mutating closure state inside a pure apply function.
          // ProseMirror does not expose the transaction in update(), so we close
          // the menu on doc change; the menu will reopen if the user clicks again.
          if (prevState && nextView.state.doc !== prevState.doc && openMenuBlockPos !== null) {
            closeMenu();
          }

          if (!handleElement) {
            return;
          }

          const pluginState = blockHandlePluginKey.getState(nextView.state);
          const nextActivePos = pluginState?.activeBlockPos;

          if (nextActivePos === null || nextActivePos === undefined) {
            handleElement.classList.remove('visible');
            activeBlockPos = null;
            activeBlockElement = null;
            closeMenu();
            return;
          }

          const nextBlockDOM = nextView.nodeDOM(nextActivePos);
          if (!isHTMLElement(nextBlockDOM)) {
            closeMenu();
            hideHandle(nextView, true);
            return;
          }

          activeBlockPos = nextActivePos;
          activeBlockElement = nextBlockDOM;
          // Don't reposition when menu is open — keep handle at original position
          if (openMenuBlockPos === null) {
            positionHandle(handleElement, nextBlockDOM, options.handleWidth);
          }
          handleElement.classList.add('visible');

          if (openMenuBlockPos !== null) {
            renderMenu();
          }
        },
        destroy: () => {
          scrollParent.removeEventListener('scroll', handleScroll);
          abortController?.abort();
          abortController = null;
          clearHideTimer();
          closeMenu();

          if (menuRoot) {
            const rootToUnmount = menuRoot;
            menuRoot = null;
            queueMicrotask(() => rootToUnmount.unmount());
          }

          if (menuContainer) {
            menuContainer.remove();
            menuContainer = null;
          }

          menuReadyPromise = null;

          if (handleElement) {
            handleElement.remove();
            handleElement = null;
          }

          if (currentBlockCleanup) currentBlockCleanup();
          activeBlockPos = null;
          activeBlockElement = null;
          editorView = null;
          openMenuBlockPos = null;
        },
      };
    },
  });
};
