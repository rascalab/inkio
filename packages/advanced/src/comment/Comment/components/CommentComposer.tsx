import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  InkioLocaleInput,
  InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import { autoUpdateOverlayPosition, computeOverlayPosition } from '@inkio/core';
import {
  useInkioCommentUi,
  type InkioCommentMessageOverrides,
} from '../../i18n';

const MAX_TEXTAREA_HEIGHT = 120;

export interface CommentComposerAnchorRect {
  top: number;
  left: number;
  bottom: number;
  right?: number;
  width?: number;
  height?: number;
}

export interface CommentComposerProps {
  /** Position to anchor the popover (selection bounding rect in viewport coords) */
  anchorRect: CommentComposerAnchorRect | null;
  /** Optional resolver for dynamic anchor updates during scroll/resize */
  anchorResolver?: () => CommentComposerAnchorRect | null;
  /** Called when user submits a comment */
  onSubmit: (text: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the composer is visible */
  open: boolean;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: InkioLocaleInput;
  /** Message overrides for extension comment labels */
  messages?: InkioCommentMessageOverrides | InkioMessageOverrides;
  /** Reserved icon overrides */
  icons?: Partial<InkioIconRegistry>;
}

/**
 * Inline popover for adding a comment to selected text.
 * Uses the shared overlay engine for viewport collision handling.
 */
export function CommentComposer({
  anchorRect,
  anchorResolver,
  onSubmit,
  onCancel,
  open,
  locale,
  messages,
  icons,
}: CommentComposerProps) {
  const [text, setText] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ui = useInkioCommentUi({
    locale,
    messages,
    icons,
  });

  const resolveAnchor = useCallback((): CommentComposerAnchorRect | null => {
    return anchorResolver?.() ?? anchorRect;
  }, [anchorRect, anchorResolver]);

  const updatePosition = useCallback(() => {
    const rect = resolveAnchor();
    if (!open || !rect) {
      return;
    }

    const right = rect.right ?? rect.left + (rect.width ?? 1);
    const width = rect.width ?? Math.max(1, right - rect.left);
    const height = rect.height ?? Math.max(1, rect.bottom - rect.top);

    const floatingRect = {
      width: containerRef.current?.offsetWidth ?? 320,
      height: containerRef.current?.offsetHeight ?? 120,
    };

    const nextPosition = computeOverlayPosition({
      anchorRect: {
        top: rect.top,
        left: rect.left,
        right,
        bottom: rect.bottom,
        width,
        height,
      },
      floatingRect,
      placement: 'bottom',
      align: 'start',
      offset: 8,
      padding: 8,
      flip: true,
      shift: true,
    });

    setPosition({ top: nextPosition.top, left: nextPosition.left });
  }, [open, resolveAnchor]);

  // Auto-focus on open
  useEffect(() => {
    if (open && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }

    if (!open) {
      setText('');
    }
  }, [open]);

  // Position updates for collision handling and viewport changes.
  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    return autoUpdateOverlayPosition({
      update: updatePosition,
      elements: [containerRef.current],
    });
  }, [open, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onCancel]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    onSubmit(trimmed);
    setText('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  const handleAutoResize = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
    target.style.overflowY = target.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  if (!open || !resolveAnchor()) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="inkio inkio-comment-composer"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 'var(--inkio-layer-popover, 150)',
      }}
    >
      <div className="inkio-comment-composer-inner" role="dialog" aria-modal={false}>
        <textarea
          ref={inputRef}
          className="inkio-comment-composer-input"
          placeholder={ui.messages.commentComposer.placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onInput={handleAutoResize}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="inkio-comment-composer-actions">
          <button
            type="button"
            className="inkio-comment-composer-cancel"
            onClick={onCancel}
          >
            {ui.messages.commentComposer.cancel}
          </button>
          <button
            type="button"
            className="inkio-comment-composer-submit"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            {ui.messages.commentComposer.submit}
          </button>
        </div>
      </div>
    </div>
  );
};
