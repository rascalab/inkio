import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type {
  InkioIconRegistry,
  InkioLocaleInput,
  InkioMessageOverrides,
  InkioCoreMessageOverrides,
} from '@inkio/editor';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  useInkioCoreUi,
} from '@inkio/editor';
import { NodeSelection } from '@tiptap/pm/state';
import { defaultBlockMenuIcons, type BlockMenuIcons, type BlockMenuIconId } from './icons';
import { runOptionalChainCommand, type InkioOptionalChainCommand } from '../optionalCommands';

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

  const turnInto = useCallback(
    (command: InkioOptionalChainCommand, attrs?: Record<string, unknown>) => {
      const didRun = runOptionalChainCommand(editor, command, {
        args: attrs,
        prepare: (chain) => {
          const setTextSelection = (chain as Record<string, unknown>).setTextSelection;
          if (typeof setTextSelection === 'function') {
            return (setTextSelection as (position: number) => typeof chain).call(chain, Math.max(1, blockPos + 1));
          }
          return chain;
        },
      });

      if (didRun) {
        onClose();
      }
    },
    [blockPos, editor, onClose],
  );

  const deleteBlock = useCallback(() => {
    const node = editor?.state?.doc?.nodeAt(blockPos);
    if (!node) return;

    const tr = editor.state.tr.delete(blockPos, blockPos + node.nodeSize);
    editor.view.dispatch(tr);
    onClose();
  }, [blockPos, editor, onClose]);

  const duplicateBlock = useCallback(() => {
    const node = editor?.state?.doc?.nodeAt(blockPos);
    if (!node) return;

    const insertPos = blockPos + node.nodeSize;
    const tr = editor.state.tr.insert(insertPos, node);
    tr.setSelection(NodeSelection.create(tr.doc, insertPos));
    editor.view.dispatch(tr.scrollIntoView());
    onClose();
  }, [blockPos, editor, onClose]);

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

  useEffect(() => {
    setActiveIndex(0);
    requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
  }, []);

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
