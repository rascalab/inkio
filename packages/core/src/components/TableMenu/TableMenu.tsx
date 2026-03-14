import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioIconRegistry } from '../../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../../i18n/messages';
import { useInkioCoreUi } from '../../context/useInkioUi';
import { ChevronRightIcon } from '../../icons/icon';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  toRectLike,
} from '../../overlay/positioning';
import {
  canExecuteTableAction,
  defaultTableMenuActions,
  executeTableAction,
  isTableActive,
} from '../../table/actions';

export interface TableMenuProps {
  editor: Editor | null;
  className?: string;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

function resolveActiveTableElement(editor: Editor): HTMLTableElement | null {
  const selection = editor.state.selection;
  const nodeDom = editor.view.nodeDOM(selection.from);

  if (nodeDom instanceof HTMLTableElement) {
    return nodeDom;
  }

  const domAtPos = editor.view.domAtPos(selection.from);
  const element = domAtPos.node instanceof Element
    ? domAtPos.node
    : domAtPos.node.parentElement;

  return element?.closest('table') as HTMLTableElement | null;
}

export const TableMenu = ({
  editor,
  className,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
}: TableMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [panelAlign, setPanelAlign] = useState<'start' | 'end'>('start');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tableElementRef = useRef<HTMLTableElement | null>(null);
  const blurRafRef = useRef(0);
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  const updatePosition = useCallback(() => {
    if (!editor || !isTableActive(editor)) {
      tableElementRef.current = null;
      setIsVisible(false);
      setIsOpen(false);
      return;
    }

    const tableElement = resolveActiveTableElement(editor);
    if (!tableElement) {
      tableElementRef.current = null;
      setIsVisible(false);
      setIsOpen(false);
      return;
    }

    tableElementRef.current = tableElement;

    const floatingRect = {
      width: triggerRef.current?.offsetWidth ?? 40,
      height: triggerRef.current?.offsetHeight ?? 32,
    };
    const tableRect = toRectLike(tableElement.getBoundingClientRect());
    const boundaryRect = toRectLike(editor.view.dom.getBoundingClientRect());
    const nextPosition = computeOverlayPosition({
      anchorRect: tableRect,
      floatingRect,
      placement: 'top',
      align: 'start',
      offset: 8,
      padding: 8,
      boundaryRect,
    });

    const projectedPanelRight = nextPosition.left + 208;
    setPanelAlign(projectedPanelRight > boundaryRect.right - 8 ? 'end' : 'start');
    setPosition({ top: nextPosition.top, left: nextPosition.left });
    setIsVisible(true);
  }, [editor]);

  const handleBlur = useCallback(() => {
    blurRafRef.current = requestAnimationFrame(() => {
      if (containerRef.current?.contains(document.activeElement)) {
        return;
      }

      if (!editor?.isFocused) {
        setIsOpen(false);
        if (!isTableActive(editor)) {
          setIsVisible(false);
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(blurRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on('selectionUpdate', updatePosition);
    editor.on('focus', updatePosition);
    editor.on('blur', handleBlur);
    editor.on('transaction', updatePosition);

    return () => {
      editor.off('selectionUpdate', updatePosition);
      editor.off('focus', updatePosition);
      editor.off('blur', handleBlur);
      editor.off('transaction', updatePosition);
    };
  }, [editor, handleBlur, updatePosition]);

  useEffect(() => {
    if (!editor || !isVisible) {
      return;
    }

    return autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [editor.view.dom, triggerRef.current, tableElementRef.current],
    });
  }, [editor, isVisible, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (containerRef.current?.contains(target) || editor?.view.dom.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
    };
  }, [editor, isOpen]);

  if (!editor || (!isVisible && !isOpen)) {
    return null;
  }

  const TriggerIcon = ui.icons.table;

  return (
    <div
      ref={containerRef}
      className={`inkio-floating-overlay inkio-table-anchor ${isVisible ? 'is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`inkio-table-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ui.messages.actions.table}
        title={ui.messages.actions.table}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          setIsOpen((previous) => !previous);
        }}
      >
        <TriggerIcon size={16} strokeWidth={1.8} />
        <ChevronRightIcon size={12} strokeWidth={2} className="inkio-table-trigger-chevron" />
      </button>

      {isOpen && (
        <div
          className={`inkio-table-panel inkio-table-panel--${panelAlign}`}
          role="toolbar"
          aria-label={ui.messages.actions.table}
        >
          {defaultTableMenuActions.map((action) => {
            const Icon = ui.icons[action.iconId];
            const label = ui.messages.tableMenu[action.id];
            const isDisabled = !canExecuteTableAction(editor, action.id);

            return (
              <button
                key={action.id}
                type="button"
                className={`inkio-bubble-btn inkio-table-action${action.group === 'delete' ? ' is-danger' : ''}`}
                title={label}
                aria-label={label}
                disabled={isDisabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (isDisabled) {
                    return;
                  }

                  executeTableAction(editor, action.id);
                }}
              >
                <Icon size={16} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
