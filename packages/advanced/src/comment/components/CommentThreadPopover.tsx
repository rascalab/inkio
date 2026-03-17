import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  formatRelativeTime,
  useInkioCommentUi,
  type InkioCommentMessageOverrides,
} from '../i18n';
import type { CommentThreadData } from './CommentPanel';
import { getInitials } from '../utils';

export interface CommentThreadPopoverProps {
  threadId: string;
  quotedText: string;
  thread: CommentThreadData | null;
  currentUser: string;
  onReply: (threadId: string, text: string) => void;
  onResolve: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onClose: () => void;
  locale?: InkioLocaleInput;
  messages?: InkioCommentMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}


export function CommentThreadPopover({
  threadId,
  quotedText,
  thread,
  currentUser,
  onReply,
  onResolve,
  onDelete,
  onClose,
  locale,
  messages,
  icons,
}: CommentThreadPopoverProps) {
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ui = useInkioCommentUi({ locale, messages, icons });

  const formatTimeAgo = useCallback(
    (value: Date): string => {
      const diff = Date.now() - value.getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return ui.messages.commentPanel.time.justNow;

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) {
        return formatRelativeTime(ui.messages.commentPanel.time.minutesAgo, minutes);
      }

      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return formatRelativeTime(ui.messages.commentPanel.time.hoursAgo, hours);
      }

      const days = Math.floor(hours / 24);
      return formatRelativeTime(ui.messages.commentPanel.time.daysAgo, days);
    },
    [
      ui.messages.commentPanel.time.justNow,
      ui.messages.commentPanel.time.minutesAgo,
      ui.messages.commentPanel.time.hoursAgo,
      ui.messages.commentPanel.time.daysAgo,
    ],
  );

  // Focus reply input on mount
  useEffect(() => {
    requestAnimationFrame(() => replyInputRef.current?.focus());
  }, []);

  // Close on Escape — only when focus is within the popover
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key !== 'Escape') return;
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) return;
      event.stopPropagation();
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    onReply(threadId, trimmed);
    setReplyText('');
  };

  const isResolved = thread?.resolved ?? false;
  const truncatedQuote =
    quotedText.length > 100 ? `${quotedText.slice(0, 100)}\u2026` : quotedText;

  return (
    <div ref={containerRef} className="inkio-thread-popover">
      {/* Quoted text */}
      <div className="inkio-thread-popover-quote">
        <div className="inkio-thread-popover-quote-bar" />
        <span className="inkio-thread-popover-quote-text">{truncatedQuote}</span>
      </div>

      {/* Messages */}
      <div className="inkio-thread-popover-messages">
        {thread && thread.messages.length > 0 ? (
          thread.messages.map((msg) => (
            <div key={msg.id} className="inkio-thread-popover-msg">
              <div className="inkio-thread-popover-msg-avatar">
                {getInitials(msg.author || currentUser)}
              </div>
              <div className="inkio-thread-popover-msg-body">
                <div className="inkio-thread-popover-msg-header">
                  <span className="inkio-thread-popover-msg-author">
                    {msg.author || currentUser}
                  </span>
                  <span className="inkio-thread-popover-msg-time">
                    {formatTimeAgo(msg.createdAt)}
                  </span>
                </div>
                <div className="inkio-thread-popover-msg-text">{msg.text}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="inkio-thread-popover-empty">
            {ui.messages.commentPanel.noMessages}
          </div>
        )}
      </div>

      {/* Reply input */}
      {!isResolved && (
        <div className="inkio-thread-popover-reply">
          <textarea
            ref={replyInputRef}
            className="inkio-thread-popover-reply-input"
            placeholder={ui.messages.commentPanel.replyPlaceholder}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleReply();
              }
            }}
            rows={1}
          />
        </div>
      )}

      {/* Actions */}
      <div className="inkio-thread-popover-actions">
        {!isResolved && (
          <button
            type="button"
            className="inkio-thread-popover-action-btn resolve"
            onClick={() => onResolve(threadId)}
          >
            {'\u2713'} {ui.messages.commentPanel.resolve}
          </button>
        )}
        <button
          type="button"
          className="inkio-thread-popover-action-btn delete"
          onClick={() => onDelete(threadId)}
        >
          {'\u2715'} {ui.messages.commentPanel.delete}
        </button>
      </div>
    </div>
  );
}
