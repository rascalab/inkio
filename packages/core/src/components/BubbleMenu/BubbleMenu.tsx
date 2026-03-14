import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type KeyboardEvent } from 'react';
import { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { LinkInputPopover } from './LinkInputPopover';
import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from '../../menus/actions';
import type { InkioToolbarActionTransform } from '../../menus/actions';
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
  const portalContainerRef = useRef<HTMLElement | null>(null);
  const [activeStateKey, setActiveStateKey] = useState('');
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  useEffect(() => {
    linkPopoverOpenRef.current = linkPopoverOpen;
  }, [linkPopoverOpen]);

  useEffect(() => {
    if (menuRef.current) {
      portalContainerRef.current = menuRef.current.closest('.inkio') as HTMLElement | null;
    }
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handler = () => {
      queueMicrotask(() => {
        const actions = getToolbarActionsFor(editor, 'bubble', items);
        const key = actions
          .map((a) => `${a.id}:${a.isActive?.(editor) ? '1' : '0'}`)
          .join(',');
        setActiveStateKey(key);
      });
    };
    editor.on('selectionUpdate', handler);

    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, items]);

  const updatePosition = useCallback(() => {
    if (!editor) {
      return;
    }

    const { selection } = editor.state;
    const { from, to, empty } = selection;

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

    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);

    const anchorLeft = Math.min(start.left, end.left);
    const anchorRight = Math.max(start.right, end.right);
    const anchorTop = Math.min(start.top, end.top);
    const anchorBottom = Math.max(start.bottom, end.bottom);

    const floatingRect = {
      width: menuRef.current?.offsetWidth ?? 240,
      height: menuRef.current?.offsetHeight ?? 40,
    };

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
        top: anchorTop,
        left: anchorLeft,
        right: anchorRight,
        bottom: anchorBottom,
        width: Math.max(1, anchorRight - anchorLeft),
        height: Math.max(1, anchorBottom - anchorTop),
      },
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
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);

    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);

    window.dispatchEvent(
      new CustomEvent('inkio:comment-request', {
        detail: {
          from,
          to,
          rect: {
            top,
            left,
            right,
            bottom,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top),
          },
        },
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

  const actionGroups = useMemo(() => {
    if (!editor) {
      return [];
    }

    const actions = getToolbarActionsFor(editor, 'bubble', items).filter((action) => {
      if (action.id === 'unlink') {
        return editor.isActive('link');
      }

      return true;
    });

    return splitToolbarActionGroups(actions);
  }, [editor, activeStateKey, items]);

  const allActions = useMemo(() => actionGroups.flat(), [actionGroups]);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(-1);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

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
              const Icon = ui.icons[action.iconId];
              const label =
                action.label
                ?? (action.labelKey ? ui.messages.actions[action.labelKey] : action.id);
              const idx = allActions.indexOf(action);
              const isDisabled = action.isDisabled?.(editor) ?? false;
              const iconNode = Icon
                ? <Icon size={16} strokeWidth={1.8} />
                : <span aria-hidden>{label.slice(0, 1).toUpperCase()}</span>;

              if (action.id === 'link') {
                return (
                  <Popover.Root
                    key={action.id}
                    open={linkPopoverOpen}
                    onOpenChange={(open) => {
                      setLinkPopoverOpen(open);
                      if (!open) {
                        setCurrentLinkUrl('');
                        editor.chain().focus().run();
                      }
                    }}
                  >
                    <Popover.Anchor asChild>
                      <button
                        ref={(el) => {
                          if (el) buttonRefs.current.set(idx, el);
                          else buttonRefs.current.delete(idx);
                        }}
                        type="button"
                        tabIndex={focusedIndex === idx ? 0 : -1}
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
                        className={`inkio-bubble-btn ${editor.isActive('link') ? 'is-active' : ''}`}
                        title={label}
                        aria-label={label}
                        disabled={isDisabled}
                      >
                        {iconNode}
                      </button>
                    </Popover.Anchor>
                    <Popover.Portal container={portalContainerRef.current}>
                      <Popover.Content
                        sideOffset={6}
                        className="inkio-popover-content"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                      >
                        <LinkInputPopover
                          initialUrl={currentLinkUrl}
                          placeholder={ui.messages.linkPopover.placeholder}
                          cancelLabel={ui.messages.linkPopover.cancel}
                          saveLabel={ui.messages.linkPopover.save}
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
                  : `inkio-bubble-btn ${action.isActive?.(editor) ? 'is-active' : ''}`;

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
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  tabIndex={focusedIndex === idx ? 0 : -1}
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
