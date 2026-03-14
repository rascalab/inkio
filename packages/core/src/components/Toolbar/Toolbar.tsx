import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import type { InkioIconRegistry } from '../../icons/registry';
import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from '../../menus/actions';
import type { InkioToolbarActionTransform } from '../../menus/actions';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../../i18n/messages';
import { useInkioCoreUi } from '../../context/useInkioUi';
import { LinkInputPopover } from '../BubbleMenu/LinkInputPopover';

const DEFAULT_TEXT_COLORS = [
  '#111827',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

function runTextColorCommand(editor: Editor, command: 'setColor' | 'unsetColor', value?: string) {
  const chain = editor.chain().focus() as Record<string, unknown>;
  const fn = chain[command];

  if (typeof fn !== 'function') {
    return;
  }

  const result =
    value !== undefined
      ? (fn as (nextValue: string) => unknown).call(chain, value)
      : (fn as () => unknown).call(chain);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    (result as { run: () => boolean }).run();
    return;
  }

  if (typeof (chain as { run?: unknown }).run === 'function') {
    (chain as { run: () => boolean }).run();
  }
}

export interface ToolbarProps {
  editor: Editor | null;
  className?: string;
  children?: ReactNode;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
  items?: InkioToolbarActionTransform;
}

export const Toolbar = ({
  editor,
  className,
  children,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
  items,
}: ToolbarProps) => {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');
  const [activeStateKey, setActiveStateKey] = useState('');
  const ui = useInkioCoreUi({
    locale,
    messages: messageOverrides,
    icons: iconOverrides,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateState = () => {
      queueMicrotask(() => {
        const actions = getToolbarActionsFor(editor, 'toolbar', items);
        const key = actions
          .map((action) => `${action.id}:${action.isActive?.(editor) ? '1' : '0'}:${action.isDisabled?.(editor) ? 'd' : 'e'}`)
          .join(',');
        setActiveStateKey(key);
      });
    };

    updateState();
    editor.on('selectionUpdate', updateState);
    editor.on('transaction', updateState);
    editor.on('focus', updateState);
    editor.on('blur', updateState);

    return () => {
      editor.off('selectionUpdate', updateState);
      editor.off('transaction', updateState);
      editor.off('focus', updateState);
      editor.off('blur', updateState);
    };
  }, [editor, items]);

  const actionGroups = useMemo(() => {
    if (!editor) {
      return [];
    }

    const actions = getToolbarActionsFor(editor, 'toolbar', items).filter((action) => {
      if (action.id === 'unlink') {
        return editor.isActive('link');
      }

      return true;
    });

    return splitToolbarActionGroups(actions);
  }, [editor, activeStateKey, items]);

  const requestComment = () => {
    if (!editor) {
      return;
    }

    const { selection } = editor.state;
    const { from, to, empty } = selection;
    if (empty) {
      return;
    }

    const commands = editor.commands as unknown as {
      openCommentComposer?: () => boolean;
    };

    if (typeof commands.openCommentComposer === 'function' && commands.openCommentComposer()) {
      return;
    }

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
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={`inkio-toolbar${className ? ` ${className}` : ''}`} role="toolbar" aria-label="Editor toolbar">
      {actionGroups.map((group, groupIndex) => (
        <Fragment key={`${group[0]?.group ?? 'group'}-${groupIndex}`}>
          {groupIndex > 0 && <div className="inkio-toolbar-divider" />}
          <div className="inkio-toolbar-group">
            {group.map((action) => {
              const Icon = ui.icons[action.iconId];
              const label =
                action.label
                ?? (action.labelKey ? ui.messages.actions[action.labelKey] : action.id);
              const isDisabled = action.isDisabled?.(editor) ?? false;
              const isActive = action.isActive?.(editor) ?? false;
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
                        type="button"
                        className={`inkio-bubble-btn${isActive ? ' is-active' : ''}`}
                        title={label}
                        aria-label={label}
                        disabled={isDisabled}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          const existingUrl = String(editor.getAttributes('link').href ?? '');
                          setCurrentLinkUrl(existingUrl);
                          setLinkPopoverOpen(true);
                        }}
                      >
                        {iconNode}
                      </button>
                    </Popover.Anchor>
                    <Popover.Portal>
                      <Popover.Content
                        sideOffset={8}
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

              if (action.id === 'textColor') {
                const currentColor = String(editor.getAttributes('textStyle').color ?? '');
                return (
                  <Popover.Root key={action.id} open={textColorOpen} onOpenChange={setTextColorOpen}>
                    <Popover.Anchor asChild>
                      <button
                        type="button"
                        className={`inkio-bubble-btn${isActive ? ' is-active' : ''}`}
                        title={label}
                        aria-label={label}
                        disabled={isDisabled}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setTextColorOpen((previous) => !previous);
                        }}
                      >
                        <span className="inkio-toolbar-color-icon">
                          {iconNode}
                          <span
                            className="inkio-toolbar-color-indicator"
                            style={{ backgroundColor: currentColor || 'currentColor' }}
                          />
                        </span>
                      </button>
                    </Popover.Anchor>
                    <Popover.Portal>
                      <Popover.Content
                        sideOffset={8}
                        className="inkio-popover-content"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                      >
                        <div className="inkio-color-popover">
                          <div className="inkio-color-popover-grid">
                            {DEFAULT_TEXT_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                  className={`inkio-color-swatch${currentColor === color ? ' is-active' : ''}`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`${label}: ${color}`}
                                  onClick={() => {
                                  runTextColorCommand(editor, 'setColor', color);
                                  setTextColorOpen(false);
                                }}
                              />
                            ))}
                            <button
                              type="button"
                              className={`inkio-color-swatch inkio-color-swatch--clear${!currentColor ? ' is-active' : ''}`}
                              aria-label={`${label}: clear`}
                              onClick={() => {
                                runTextColorCommand(editor, 'unsetColor');
                                setTextColorOpen(false);
                              }}
                            >
                              <span aria-hidden>×</span>
                            </button>
                          </div>
                          <label className="inkio-color-input-label">
                            <span>{label}</span>
                            <input
                              type="color"
                              className="inkio-color-input"
                              value={currentColor || '#111827'}
                              onChange={(event) => {
                                runTextColorCommand(editor, 'setColor', event.target.value);
                              }}
                            />
                          </label>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                );
              }

              return (
                <button
                  key={action.id}
                  type="button"
                  className={`inkio-bubble-btn${isActive ? ' is-active' : ''}${action.id === 'unlink' ? ' is-danger' : ''}`}
                  title={label}
                  aria-label={label}
                  disabled={isDisabled}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (isDisabled) {
                      return;
                    }

                    if (action.id === 'comment') {
                      requestComment();
                      return;
                    }

                    action.run(editor);
                  }}
                >
                  {iconNode}
                </button>
              );
            })}
          </div>
        </Fragment>
      ))}

      {children && (
        <>
          {actionGroups.length > 0 && <div className="inkio-toolbar-divider" />}
          <div className="inkio-toolbar-group">{children}</div>
        </>
      )}
    </div>
  );
};
