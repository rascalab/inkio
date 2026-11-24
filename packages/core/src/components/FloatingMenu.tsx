import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type KeyboardEvent } from 'react';
import { Editor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from './toolbar-actions';
import type {
  InkioToolbarActionTransform,
} from './toolbar-actions';
import type { InkioIconRegistry } from '../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import { useInkioCoreUi } from '../context/use-inkio-ui';
import {
  buttonRefSetter,
  renderActionIcon,
  resolveActionLabel,
} from './menu-buttons';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  fixedOrigin,
  type InkioMenuPosition,
} from '../overlay/positioning';

export interface FloatingMenuProps {
  editor: Editor | null;
  className?: string;
  /** Locale tag or Accept-Language string. */
  locale?: InkioLocaleInput;
  /** Message overrides for core floating menu labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides by action id */
  icons?: Partial<InkioIconRegistry>;
  /** Transform the default toolbar actions for the floating surface. */
  items?: InkioToolbarActionTransform;
  /** Placement around the caret in an empty paragraph. */
  position?: InkioMenuPosition;
}

export const FloatingMenu = ({
  editor,
  className,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
  items,
  position: menuPosition,
}: FloatingMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const blurRafRef = useRef<number>(0);
  const dismissed = useRef(false);
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  const updateVisibility = useCallback(() => {
    const menu = menuRef.current;
    if (!editor || editor.isDestroyed || !editor.isEditable
      || (!editor.isFocused && !menu?.contains(menu.ownerDocument.activeElement))) {
      dismissed.current = false;
      setIsVisible(false);
      return;
    }

    const { selection, doc } = editor.state;
    const { from, empty } = selection;

    if (!empty || dismissed.current) {
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

    const boundaryRect = menuPosition?.boundary === 'viewport' ? undefined : editor.view.dom.getBoundingClientRect();

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
      ...menuPosition,
      boundaryRect,
    });

    const origin = fixedOrigin(editor.view.dom);
    setPosition({ top: nextPosition.top - origin.y, left: nextPosition.left - origin.x });
    setIsVisible(true);
  }, [editor, menuPosition]);

  const handleBlur = useCallback(() => {
    // Delay to check if focus moved to the floating menu itself.
    // Cancel any pending frame first: rapid blur/focus bursts would
    // otherwise queue redundant hides behind the latest focus.
    if (blurRafRef.current) {
      cancelAnimationFrame(blurRafRef.current);
    }
    blurRafRef.current = requestAnimationFrame(() => {
      blurRafRef.current = 0;
      updateVisibility();
    });
  }, [updateVisibility]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const onSelection = () => {
      dismissed.current = false;
      updateVisibility();
    };
    updateVisibility();
    editor.on('selectionUpdate', onSelection);
    editor.on('update', updateVisibility);
    editor.on('focus', updateVisibility);
    editor.on('blur', handleBlur);

    return () => {
      cancelAnimationFrame(blurRafRef.current);
      dismissed.current = false;
      editor.off('selectionUpdate', onSelection);
      editor.off('update', updateVisibility);
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
  const buttons = useRef<Map<number, HTMLButtonElement>>(new Map());
  // Reset focus index when menu hides
  useEffect(() => {
    if (!isVisible) setFocusedIndex(-1);
  }, [isVisible]);

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!editor || !isVisible || event.nativeEvent.isComposing || event.keyCode === 229) return;
    const { key } = event;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      const dir = key === 'ArrowRight' ? 1 : -1;
      for (let step = 1; step <= allActions.length; step++) {
        const next = buttons.current.get((index + dir * step + allActions.length) % allActions.length);
        if (next && !next.disabled) {
          next.focus();
          break;
        }
      }
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const { doc, selection: { $from } } = editor.state;
      const up = key === 'ArrowUp';
      const boundary = up ? $from.before(1) : $from.after(1);
      if (up ? boundary > 0 : boundary < doc.content.size) {
        const direction = up ? -1 : 1;
        const selection = Selection.near(doc.resolve(boundary + direction), direction);
        editor.chain().focus().setTextSelection(selection.from).run();
      } else {
        editor.commands.focus();
      }
    } else if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismissed.current = true;
      editor.view.focus();
      setIsVisible(false);
    }
  }

  if (!editor) {
    return null;
  }

  const tabStop = focusedIndex >= 0 && allActions[focusedIndex] && !allActions[focusedIndex].isDisabled?.(editor)
    ? focusedIndex : allActions.findIndex((action) => !action.isDisabled?.(editor));

  return (
    <div
      ref={menuRef}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocusedIndex(-1);
        handleBlur();
      }}
      className={`inkio-floating-overlay ${isVisible ? 'is-visible' : ''} ${className || ''}`}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div
        className="inkio-bubble-menu"
        role="toolbar"
        aria-label={ui.messages.editor.blockControls}
      >
        {actionGroups.map((group, groupIndex) => (
          <Fragment key={`${group[0]?.group ?? 'group'}-${groupIndex}`}>
            {groupIndex > 0 && <div className="inkio-bubble-divider" />}
            {group.map((action) => {
              const label = resolveActionLabel(action, ui.messages);
              const idx = allActions.indexOf(action);
              const isDisabled = action.isDisabled?.(editor) ?? false;
              const iconNode = renderActionIcon(action, ui.icons, label);

              return (
                <button
                  key={action.id}
                  ref={buttonRefSetter(buttons.current, idx)}
                  type="button"
                  tabIndex={isVisible && idx === tabStop ? 0 : -1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { if (editor.isEditable) action.run(editor); }}
                  onKeyDown={(event) => handleButtonKeyDown(event, idx)}
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
