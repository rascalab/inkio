import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
  InkioCoreMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  useInkioCoreUi,
} from '@inkio/core';
import { NodeSelection } from '@tiptap/pm/state';
import { defaultBlockMenuIcons, type BlockMenuIcons, type BlockMenuIconId } from './icons';
import { runOptionalChainCommand, type InkioOptionalChainCommand } from '../optional-commands';

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface BlockHandleActionMenuProps {
  editor: Editor;
  blockPos: number;
  anchorRect: AnchorRect | null;
  anchorResolver?: () => AnchorRect | null;
  icons?: BlockMenuIcons;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  coreIcons?: Partial<InkioIconRegistry>;
  onClose: () => void;
  /**
   * Identity snapshot of the block the menu was opened for (captured at
   * open time). Actions validate the resolved node against it and refuse to
   * run when it no longer matches, so a stale `blockPos` can never delete,
   * duplicate, or transform an adjacent block. Optional for backwards
   * compatibility — when absent, only structural guards apply.
   */
  blockFingerprint?: BlockFingerprint | null;
}

/** Minimal structural view of a ProseMirror node, for identity checks. */
export interface FingerprintableNode {
  type: { name: string };
  nodeSize: number;
  textContent: string;
  isText: boolean;
  isInline: boolean;
}

/** Identity snapshot of a block, captured when the menu opens. */
export interface BlockFingerprint {
  type: string;
  size: number;
  textPrefix: string;
}

const FINGERPRINT_TEXT_LENGTH = 64;

/** Capture the identity of the node at `pos`, or null when there is none. */
export function fingerprintBlockAt(
  doc: { nodeAt: (pos: number) => FingerprintableNode | null | undefined },
  pos: number,
): BlockFingerprint | null {
  try {
    const node = doc.nodeAt(pos);
    if (!node) return null;
    return {
      type: node.type.name,
      size: node.nodeSize,
      textPrefix: node.textContent.slice(0, FINGERPRINT_TEXT_LENGTH),
    };
  } catch {
    return null;
  }
}

/**
 * Verify a resolved node is still the block the menu was opened for.
 * Rejects inline/text nodes outright (never valid block targets) and, when a
 * fingerprint is available, requires type/size/text-prefix to match so doc
 * edits between open and action can't redirect onto an adjacent block.
 */
export function isExpectedBlock(
  node: FingerprintableNode | null | undefined,
  fingerprint?: BlockFingerprint | null,
): boolean {
  if (!node || node.isText || node.isInline) return false;
  if (!fingerprint) return true;
  return (
    node.type.name === fingerprint.type &&
    node.nodeSize === fingerprint.size &&
    node.textContent.slice(0, FINGERPRINT_TEXT_LENGTH) === fingerprint.textPrefix
  );
}

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

interface MenuItemProps {
  item: MenuItem;
  active: boolean;
  onSelect: () => void;
  itemRef: (node: HTMLButtonElement | null) => void;
}

const MenuItemButton = ({ item, active, onSelect, itemRef }: MenuItemProps) => {
  const className = [
    'inkio-block-handle-action-item',
    active && 'is-active',
    item.danger && 'is-danger',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      role="menuitem"
      ref={itemRef}
      tabIndex={active ? 0 : -1}
      className={className}
      onClick={onSelect}
    >
      <span className="inkio-block-handle-action-icon">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
};

function resolveAnchorRect(
  anchorRect: AnchorRect | null,
  anchorResolver?: () => AnchorRect | null,
): AnchorRect | null {
  return anchorResolver?.() ?? anchorRect;
}

export const BlockHandleActionMenu = ({
  editor,
  blockPos,
  anchorRect,
  anchorResolver,
  icons: iconOverrides,
  locale,
  messages,
  coreIcons,
  onClose,
  blockFingerprint,
}: BlockHandleActionMenuProps) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ui = useInkioCoreUi({
    locale,
    messages,
    icons: coreIcons,
  });

  const icons = useMemo(() => {
    return {
      ...defaultBlockMenuIcons,
      ...iconOverrides,
    };
  }, [iconOverrides]);

  // blockPos is captured at menu-open time and may be stale after doc edits.
  // Clamp into range, verify a node exists, and validate its identity before
  // every action — never act on an adjacent block.
  const resolveBlockPos = useCallback(() => {
    if (!editor) return null;
    const size = editor.state.doc.content.size;
    const pos = Math.max(0, Math.min(blockPos, size));
    try {
      const node = editor.state.doc.nodeAt(pos);
      if (!node || !isExpectedBlock(node, blockFingerprint)) return null;
      return { pos, node };
    } catch {
      return null;
    }
  }, [blockPos, blockFingerprint, editor]);

  const turnInto = useCallback(
    (command: InkioOptionalChainCommand, attrs?: Record<string, unknown>) => {
      // No mutations from read-only surfaces.
      if (!editor.isEditable) {
        onClose();
        return;
      }
      const resolved = resolveBlockPos();
      const didRun = runOptionalChainCommand(editor, command, {
        args: attrs,
        prepare: (chain) => {
          // Atom/leaf blocks (hr, bookmark) and listItem containers have no
          // valid inner text position — let the command decide placement.
          if (!resolved || resolved.node.isAtom || resolved.node.isLeaf || resolved.node.type.name === 'listItem') {
            return chain;
          }
          const setTextSelection = (chain as Record<string, unknown>).setTextSelection;
          if (typeof setTextSelection === 'function') {
            const inner = Math.max(0, Math.min(resolved.pos + 1, editor.state.doc.content.size));
            return (setTextSelection as (position: number) => typeof chain).call(chain, inner);
          }
          return chain;
        },
      });

      if (didRun) {
        onClose();
      }
    },
    [editor, onClose, resolveBlockPos],
  );

  const deleteBlock = useCallback(() => {
    if (!editor.isEditable) {
      onClose();
      return;
    }
    const resolved = resolveBlockPos();
    if (!editor || !resolved) {
      onClose();
      return;
    }

    const tr = editor.state.tr.delete(resolved.pos, resolved.pos + resolved.node.nodeSize);
    editor.view.dispatch(tr);
    onClose();
  }, [editor, onClose, resolveBlockPos]);

  const duplicateBlock = useCallback(() => {
    if (!editor.isEditable) {
      onClose();
      return;
    }
    const resolved = resolveBlockPos();
    if (!editor || !resolved) {
      onClose();
      return;
    }

    const insertPos = resolved.pos + resolved.node.nodeSize;
    const tr = editor.state.tr.insert(insertPos, resolved.node);
    try {
      tr.setSelection(NodeSelection.create(tr.doc, insertPos));
    } catch {
      // Leave selection where it is if the mapped position is invalid.
    }
    editor.view.dispatch(tr.scrollIntoView());
    onClose();
  }, [editor, onClose, resolveBlockPos]);

  const menuItems = useMemo<MenuItem[]>(() => {
    const labels = ui.messages.blockHandle;

    const icon = (id: BlockMenuIconId) => icons[id] ?? defaultBlockMenuIcons[id];

    return [
      {
        id: 'delete',
        icon: icon('delete'),
        label: labels.delete,
        danger: true,
        onSelect: deleteBlock,
      },
      {
        id: 'duplicate',
        icon: icon('duplicate'),
        label: labels.duplicate,
        onSelect: duplicateBlock,
      },
      {
        id: 'text',
        icon: icon('text'),
        label: labels.text,
        onSelect: () => turnInto('setParagraph'),
      },
      {
        id: 'heading1',
        icon: icon('heading1'),
        label: labels.heading1,
        onSelect: () => turnInto('setHeading', { level: 1 }),
      },
      {
        id: 'heading2',
        icon: icon('heading2'),
        label: labels.heading2,
        onSelect: () => turnInto('setHeading', { level: 2 }),
      },
      {
        id: 'heading3',
        icon: icon('heading3'),
        label: labels.heading3,
        onSelect: () => turnInto('setHeading', { level: 3 }),
      },
      {
        id: 'bulletList',
        icon: icon('bulletList'),
        label: labels.bulletList,
        onSelect: () => turnInto('toggleBulletList'),
      },
      {
        id: 'orderedList',
        icon: icon('orderedList'),
        label: labels.orderedList,
        onSelect: () => turnInto('toggleOrderedList'),
      },
      {
        id: 'callout',
        icon: icon('callout'),
        label: labels.callout,
        onSelect: () => turnInto('setCallout'),
      },
      {
        id: 'codeBlock',
        icon: icon('codeBlock'),
        label: labels.codeBlock,
        onSelect: () => turnInto('toggleCodeBlock'),
      },
    ];
  }, [deleteBlock, duplicateBlock, icons, turnInto, ui.messages.blockHandle]);

  // The menu root is reused across blocks (menuRoot.render reuses the mounted
  // component), so reset keyboard state whenever the target block changes.
  useEffect(() => {
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [blockPos]);

  const updatePosition = useCallback(() => {
    const anchor = resolveAnchorRect(anchorRect, anchorResolver);
    if (!anchor) {
      onClose();
      return;
    }

    const floatingRect = {
      width: menuRef.current?.offsetWidth ?? 220,
      height: menuRef.current?.offsetHeight ?? 320,
    };

    const next = computeOverlayPosition({
      anchorRect: anchor,
      floatingRect,
      placement: 'right',
      align: 'start',
      offset: 6,
      padding: 8,
      flip: true,
      shift: true,
    });

    setPosition({ top: next.top, left: next.left });
  }, [anchorRect, anchorResolver, onClose]);

  useEffect(() => {
    updatePosition();

    return autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [menuRef.current],
    });
  }, [updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const navigate = useCallback(
    (nextIndex: number) => {
      const clamped = (nextIndex + menuItems.length) % menuItems.length;
      setActiveIndex(clamped);
      itemRefs.current[clamped]?.focus();
    },
    [menuItems.length],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigate(activeIndex + 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigate(activeIndex - 1);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        navigate(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        navigate(menuItems.length - 1);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        menuItems[activeIndex]?.onSelect();
      }
    },
    [activeIndex, menuItems, navigate, onClose],
  );

  // The menu must never display on a read-only editor, even if opened
  // programmatically. Per-action guards above are defense in depth.
  if (!editor.isEditable) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="inkio-block-handle-action-menu"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label="Block actions"
      onKeyDown={handleKeyDown}
    >
      {menuItems.slice(0, 2).map((item, index) => (
        <MenuItemButton
          key={item.id}
          item={item}
          active={activeIndex === index}
          onSelect={item.onSelect}
          itemRef={(node) => {
            itemRefs.current[index] = node;
          }}
        />
      ))}

      <div className="inkio-block-handle-action-separator" />
      <div className="inkio-block-handle-action-section-label">{ui.messages.blockHandle.transformSection}</div>

      {menuItems.slice(2).map((item, offsetIndex) => {
        const index = offsetIndex + 2;
        const showDividerBefore = item.id === 'bulletList';

        return (
          <React.Fragment key={item.id}>
            {showDividerBefore && <div className="inkio-block-handle-action-separator" />}
            <MenuItemButton
              item={item}
              active={activeIndex === index}
              onSelect={item.onSelect}
              itemRef={(node) => {
                itemRefs.current[index] = node;
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
