import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { Editor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from '../../menus/actions';
import type {
  InkioToolbarActionTransform,
} from '../../menus/actions';
import type { InkioIconRegistry } from '../../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../../i18n/messages';
import { useInkioCoreUi } from '../../context/useInkioUi';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
} from '../../overlay/positioning';


export interface FloatingMenuProps {
  editor: Editor | null;
  className?: string;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: InkioLocaleInput;
  /** Message overrides for core floating menu labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides by action id */
  icons?: Partial<InkioIconRegistry>;
  /** Transform the default toolbar actions for the floating surface. */
  items?: InkioToolbarActionTransform;
}

export const FloatingMenu = ({
  editor,
  className,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
  items,
}: FloatingMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const blurRafRef = useRef<number>(0);
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  const updateVisibility = useCallback(() => {
    if (!editor) {
      return;
    }

    const { selection, doc } = editor.state;
    const { from, empty } = selection;

    if (!empty) {
      setIsVisible(false);
      return;
    }

    const $from = doc.resolve(from);
    const isEmptyParagraph =
      $from.parent.type.name === 'paragraph' && $from.parent.textContent === '';

    if (!isEmptyParagraph) {
      setIsVisible(false);
      return;
    }

    // Don't show inside lists, task lists, toggle lists, etc.
    for (let d = $from.depth - 1; d >= 0; d--) {
      const name = $from.node(d).type.name;
      if (name === 'bulletList' || name === 'orderedList' || name === 'taskList' || name === 'details') {
        setIsVisible(false);
        return;
      }
    }

    const coords = editor.view.coordsAtPos(from);
    const floatingRect = {
      width: menuRef.current?.offsetWidth ?? 220,
      height: menuRef.current?.offsetHeight ?? 40,
    };

    // Use the editor DOM rect as boundary so the menu stays within the editor area
    const editorDomRect = editor.view.dom.getBoundingClientRect();
    const boundaryRect = {
      top: editorDomRect.top,
      left: editorDomRect.left,
      right: editorDomRect.right,
      bottom: editorDomRect.bottom,
      width: editorDomRect.width,
      height: editorDomRect.height,
    };

    const nextPosition = computeOverlayPosition({
      anchorRect: {
        top: coords.top,
        left: coords.left,
        right: coords.right,
        bottom: coords.bottom,
        width: Math.max(1, coords.right - coords.left),
        height: Math.max(1, coords.bottom - coords.top),
      },
      floatingRect,
      placement: 'left',
      align: 'center',
      offset: 10,
      padding: 8,
      flip: true,
      shift: true,
      boundaryRect,
    });

    setPosition({ top: nextPosition.top, left: nextPosition.left });
    setIsVisible(true);
  }, [editor]);

  const handleBlur = useCallback(() => {
    // Delay to check if focus moved to the floating menu itself
    blurRafRef.current = requestAnimationFrame(() => {
      if (menuRef.current?.contains(document.activeElement)) return;
      setIsVisible(false);
    });
  }, []);

  // Cancel pending blur rAF on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(blurRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on('selectionUpdate', updateVisibility);
    editor.on('focus', updateVisibility);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', updateVisibility);
      editor.off('focus', updateVisibility);
      editor.off('blur', handleBlur);
    };
  }, [editor, updateVisibility, handleBlur]);

  useEffect(() => {
    if (!editor || !isVisible) {
      return;
    }

    return autoUpdateOverlayPosition({
      update: updateVisibility,
      elements: [editor.view.dom, menuRef.current],
    });
  }, [editor, isVisible, updateVisibility]);

  const actionGroups = useMemo(() => {
    if (!editor) {
      return [];
    }

    return splitToolbarActionGroups(getToolbarActionsFor(editor, 'floating', items));
  }, [editor, items]);

  const allActions = useMemo(
    () => actionGroups.flat(),
    [actionGroups],
  );

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(-1);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Keep focusedIndexRef in sync with state
  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // Reset focus index when menu hides
  useEffect(() => {
    if (!isVisible) setFocusedIndex(-1);
  }, [isVisible]);

  // Document-level keydown: capture arrow keys when menu is visible
  useEffect(() => {
    if (!isVisible || allActions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when the editor or menu has focus
      if (!editor?.isFocused && !menuRef.current?.contains(document.activeElement)) return;

      // Arrow left/right: always control menu focus when floating menu is visible
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndexRef.current === -1) {
          // Enter the menu
          const startIdx = e.key === 'ArrowLeft' ? allActions.length - 1 : 0;
          setFocusedIndex(startIdx);
          buttonRefs.current.get(startIdx)?.focus();
        } else {
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          setFocusedIndex((prev) => {
            const next = (prev + dir + allActions.length) % allActions.length;
            buttonRefs.current.get(next)?.focus();
            return next;
          });
        }
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && focusedIndexRef.current !== -1) {
        e.preventDefault();
        setFocusedIndex(-1);
        if (editor) {
          const { state } = editor;
          const { from } = state.selection;
          const $pos = state.doc.resolve(from);
          if (e.key === 'ArrowUp') {
            const before = $pos.before(1);
            if (before > 0) {
              const targetPos = Math.max(0, before - 1);
              const $target = state.doc.resolve(targetPos);
              const sel = Selection.near($target, -1);
              editor.chain().focus().setTextSelection(sel.from).run();
            } else {
              editor.commands.focus();
            }
          } else {
            const after = $pos.after(1);
            if (after < state.doc.content.size) {
              const targetPos = Math.min(state.doc.content.size, after + 1);
              const $target = state.doc.resolve(targetPos);
              const sel = Selection.near($target, 1);
              editor.chain().focus().setTextSelection(sel.from).run();
            } else {
              editor.commands.focus();
            }
          }
        }
      } else if (e.key === 'Escape' && focusedIndexRef.current !== -1) {
        e.preventDefault();
        setFocusedIndex(-1);
        editor?.commands.focus();
      } else if (e.key === 'Enter' && focusedIndexRef.current !== -1) {
        e.preventDefault();
        const action = allActions[focusedIndexRef.current];
        if (action && editor) {
          action.run(editor);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isVisible, allActions, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={`inkio-floating-overlay ${isVisible ? 'is-visible' : ''} ${className || ''}`}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div
        className="inkio-bubble-menu"
        role="toolbar"
        aria-label="Block controls"
      >
        {actionGroups.map((group, groupIndex) => (
          <Fragment key={`${group[0]?.group ?? 'group'}-${groupIndex}`}>
            {groupIndex > 0 && <div className="inkio-bubble-divider" />}
            {group.map((action) => {
              const Icon = ui.icons[action.iconId];
              const label =
                action.label
                ?? (action.labelKey ? ui.messages.actions[action.labelKey] : action.id);
              const idx = allActions.indexOf(action);
              const isDisabled = action.isDisabled?.(editor) ?? false;
              const iconNode = Icon
                ? <Icon size={16} strokeWidth={1.8} />
                : <span aria-hidden>{label.slice(0, 1).toUpperCase()}</span>;

              return (
                <button
                  key={action.id}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  tabIndex={focusedIndex === -1 ? (idx === 0 ? 0 : -1) : (focusedIndex === idx ? 0 : -1)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (isDisabled) {
                      return;
                    }
                    action.run(editor);
                  }}
                  onFocus={() => setFocusedIndex(idx)}
                  className={`inkio-bubble-btn ${action.isActive?.(editor) ? 'is-active' : ''}${focusedIndex === idx ? ' is-focused' : ''}`}
                  title={label}
                  aria-label={label}
                  disabled={isDisabled}
                >
                  {iconNode}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
