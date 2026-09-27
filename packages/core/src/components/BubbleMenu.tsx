import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type KeyboardEvent } from 'react';
import { Editor, useEditorState } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { BubbleMenuLinkInputPopover } from './BubbleMenuLinkInputPopover';
import {
  buttonRefSetter,
  renderActionIcon,
  resolveActionLabel,
  rovingTabIndex,
  selectionRect,
  snapshotActionStates,
} from './menu-buttons';
import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from './toolbar-actions';
import type { InkioToolbarActionTransform } from './toolbar-actions';
import type { InkioIconRegistry } from '../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import { useInkioCoreUi } from '../context/use-inkio-ui';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
} from '../overlay/positioning';

export interface BubbleMenuProps {
  editor: Editor | null;
  className?: string;
  children?: React.ReactNode;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: InkioLocaleInput;
  /** Message overrides for core bubble menu labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides by action id */
  icons?: Partial<InkioIconRegistry>;
  /** Transform the default toolbar actions for the bubble surface. */
  items?: InkioToolbarActionTransform;
}

export const BubbleMenu = ({
  editor,
  className,
  children,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
  items,
}: BubbleMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const linkPopoverOpenRef = useRef(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');
  const linkPopoverContentRef = useRef<HTMLDivElement | null>(null);
  // Resolved after every render (not just on mount): an `.inkio` ancestor
  // remount leaves a mount-time ref pointing at detached DOM, and the
  // portal would silently fall back to document.body without token scoping.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  useEffect(() => {
    linkPopoverOpenRef.current = linkPopoverOpen;
  }, [linkPopoverOpen]);

  useEffect(() => {
    const next = menuRef.current?.closest('.inkio') as HTMLElement | null;
    setPortalContainer((prev) => (prev === next ? prev : next));
  });

  const updatePosition = useCallback(() => {
    if (!editor) {
      return;
    }

    const { selection } = editor.state;
    const { empty } = selection;

    if (empty) {
      if (!linkPopoverOpenRef.current) {
        setIsVisible(false);
      }
      return;
    }

    if ('node' in selection && selection.node) {
      setIsVisible(false);
      return;
    }

    const floatingRect = {
      width: menuRef.current?.offsetWidth ?? 240,
      height: menuRef.current?.offsetHeight ?? 40,
    };

    const boundaryRect = editor.view.dom.getBoundingClientRect();

    const nextPosition = computeOverlayPosition({
      anchorRect: selectionRect(editor),
      floatingRect,
      placement: 'top',
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

  const requestComment = useCallback(() => {
    if (!editor) {
      return;
    }

    const { selection } = editor.state;
    const { from, to, empty } = selection;

    if (empty) {
      return;
    }

    // Try the auto-managed composer command first
    const cmds = editor.commands as unknown as {
      openCommentComposer?: () => boolean;
    };

    if (typeof cmds.openCommentComposer === 'function') {
      const opened = cmds.openCommentComposer();
      if (opened) {
        return;
      }
    }

    // Legacy fallback: dispatch event for consumer-managed composer
    window.dispatchEvent(
      new CustomEvent('inkio:comment-request', {
        detail: { from, to, rect: selectionRect(editor) },
      }),
    );
  }, [editor]);

  const handleBlur = useCallback(() => {
    if (linkPopoverOpenRef.current) {
      return;
    }

    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on('selectionUpdate', updatePosition);
    editor.on('focus', updatePosition);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', updatePosition);
      editor.off('focus', updatePosition);
      editor.off('blur', handleBlur);
    };
  }, [editor, updatePosition, handleBlur]);

  useEffect(() => {
    if (!editor || (!isVisible && !linkPopoverOpen)) {
      return;
    }

    return autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [editor.view.dom, menuRef.current],
    });
  }, [editor, isVisible, linkPopoverOpen, updatePosition]);

  useEffect(() => {
    if (linkPopoverOpen) {
      updatePosition();
    }
  }, [linkPopoverOpen, updatePosition]);

  // Re-render only when an action's active/disabled state changes. The
  // selector closes over `editor`: the snapshot keeps the previous (null)
  // editor until the first transaction after it attaches.
  const actionStates = useEditorState({
    editor,
    selector: () => (editor ? snapshotActionStates(editor, getToolbarActionsFor(editor, 'bubble', items)) : null),
  });

  const actionGroups = useMemo(() => {
    if (!editor || !actionStates) {
      return [];
    }

    const actions = getToolbarActionsFor(editor, 'bubble', items).filter((action) => {
      if (action.id === 'unlink') {
        return editor.isActive('link');
      }

      return true;
    });

    return splitToolbarActionGroups(actions);
  }, [editor, actionStates, items]);

  const stateById = useMemo(
    () => new Map((actionStates ?? []).map((entry) => [entry.id, entry])),
    [actionStates],
  );

  const allActions = useMemo(() => actionGroups.flat(), [actionGroups]);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!isVisible) setFocusedIndex(-1);
  }, [isVisible]);

  const handleToolbarKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(document.activeElement)) return;

    const count = allActions.length;
    if (count === 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setFocusedIndex((prev) => {
        const next =
          prev === -1
            ? (dir === 1 ? 0 : count - 1)
            : (prev + dir + count) % count;
        buttonRefs.current.get(next)?.focus();
        return next;
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
      buttonRefs.current.get(0)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(count - 1);
      buttonRefs.current.get(count - 1)?.focus();
    }
  }, [allActions]);

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
      <div className="inkio-bubble-menu" role="toolbar" aria-label="Formatting controls" onKeyDown={handleToolbarKeyDown}>
        {actionGroups.map((group, groupIndex) => (
          <Fragment key={`${group[0]?.group ?? 'group'}-${groupIndex}`}>
            {groupIndex > 0 && <div className="inkio-bubble-divider" />}
            {group.map((action) => {
              const label = resolveActionLabel(action, ui.messages);
              const idx = allActions.indexOf(action);
              const state = stateById.get(action.id);
              const isDisabled = state?.disabled ?? false;
              const isActive = state?.active ?? false;
              const iconNode = renderActionIcon(action, ui.icons, label);

              if (action.id === 'link') {
                return (
                  <Popover.Root
                    key={action.id}
                    open={linkPopoverOpen}
                    onOpenChange={(open) => {
                      setLinkPopoverOpen(open);
                      if (!open) {
                        setCurrentLinkUrl('');
                        const active = document.activeElement as HTMLElement | null;
                        if (
                          !active ||
                          active === document.body ||
                          linkPopoverContentRef.current?.contains(active)
                        ) {
                          editor.chain().focus().run();
                        }
                      }
                    }}
                  >
                    <Popover.Anchor asChild>
                      <button
                        ref={buttonRefSetter(buttonRefs.current, idx)}
                        type="button"
                        tabIndex={rovingTabIndex(idx, focusedIndex)}
                        onFocus={() => setFocusedIndex(idx)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isDisabled) {
                            return;
                          }
                          const existingUrl = String(editor.getAttributes('link').href ?? '');
                          setCurrentLinkUrl(existingUrl);
                          setLinkPopoverOpen(true);
                        }}
                        className={`inkio-bubble-btn ${isActive ? 'is-active' : ''}`}
                        title={label}
                        aria-label={label}
                        disabled={isDisabled}
                      >
                        {iconNode}
                      </button>
                    </Popover.Anchor>
                    <Popover.Portal container={portalContainer}>
                      <Popover.Content
                        ref={linkPopoverContentRef}
                        sideOffset={6}
                        className="inkio-popover-content"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                      >
                        <BubbleMenuLinkInputPopover
                          initialUrl={currentLinkUrl}
                          placeholder={ui.messages.linkPopover.placeholder}
                          cancelLabel={ui.messages.linkPopover.cancel}
                          saveLabel={ui.messages.linkPopover.save}
                          invalidUrlLabel={ui.messages.linkPopover.invalidUrl}
                          onSave={(url) => {
                            if (currentLinkUrl) {
                              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                            } else {
                              editor.chain().focus().setLink({ href: url }).run();
                            }
                            setLinkPopoverOpen(false);
                            setCurrentLinkUrl('');
                          }}
                          onCancel={() => {
                            setLinkPopoverOpen(false);
                            setCurrentLinkUrl('');
                            editor.chain().focus().run();
                          }}
                        />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                );
              }

              const buttonClass =
                action.id === 'unlink'
                  ? 'inkio-bubble-btn is-danger'
                  : `inkio-bubble-btn ${isActive ? 'is-active' : ''}`;

              const onMouseDown: React.MouseEventHandler<HTMLButtonElement> = (event) => {
                event.preventDefault();
                if (isDisabled) {
                  return;
                }

                if (action.id === 'comment') {
                  requestComment();
                  return;
                }

                action.run(editor);
              };

              return (
                <button
                  key={action.id}
                  ref={buttonRefSetter(buttonRefs.current, idx)}
                  type="button"
                  tabIndex={rovingTabIndex(idx, focusedIndex)}
                  onFocus={() => setFocusedIndex(idx)}
                  onMouseDown={onMouseDown}
                  className={buttonClass}
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

        {children && (
          <>
            {actionGroups.length > 0 && <div className="inkio-bubble-divider" />}
            {children}
          </>
        )}
      </div>
    </div>
  );
};
