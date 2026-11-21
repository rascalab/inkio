'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStableOptions } from '@inkio/core';
import { ImageEditorWorkbench } from './ImageEditor';
import type { ImageEditorLocale, ImageEditorModalProps } from './types';
import { useInkioImageEditorUi } from './i18n';

export type { ImageEditorModalProps };

function resolvePortalTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'light';
  }

  // Standalone fallback only: the editor passes its own resolved `theme`.
  const inkioRoot = document.querySelector('.inkio');
  if (inkioRoot?.classList.contains('dark')) {
    return 'dark';
  }
  if (inkioRoot?.classList.contains('light')) {
    return 'light';
  }
  return document.querySelector('html.dark, html.dark-theme, body.dark, body.dark-theme') ? 'dark' : 'light';
}

function isImageEditorLocaleOverrides(value: unknown): value is Partial<ImageEditorLocale> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ImageEditorModal({
  isOpen,
  imageSrc,
  onSave,
  onSaveBlob,
  savePreview,
  onClose,
  theme,
  imageQuality = 0.92,
  imageFormat = 'png',
  tools,
  defaultTool,
  toolPlacement,
  locale,
  messages,
  icons,
}: ImageEditorModalProps) {
  const localeInput = typeof locale === 'string' ? locale : undefined;
  const ui = useInkioImageEditorUi({
    locale: localeInput,
    messages,
    icons,
  });

  // Stabilize by structure: an inline locale object from the parent would
  // otherwise rebuild the resolved locale (and the whole editor) per render.
  const localeOverrides = useStableOptions(
    isImageEditorLocaleOverrides(locale) ? (locale as Partial<ImageEditorLocale>) : undefined,
  );
  const resolvedImageEditorLocale: Partial<ImageEditorLocale> = useMemo(
    () => ({
      ...ui.messages.imageEditor,
      ...(localeOverrides ?? {}),
    }),
    [localeOverrides, ui.messages.imageEditor],
  );
  const [isDirty, setIsDirty] = useState(false);
  const savingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Non-blocking close confirmation: when there are unsaved edits, closing
  // surfaces an inline confirm card instead of window.confirm (which blocks
  // the main thread and is suppressed in some embedded contexts).
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const portalTheme = theme ?? resolvePortalTheme();

  useEffect(() => {
    if (isOpen) return;
    setIsDirty(false);
    setConfirmDiscard(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (savingRef.current || contentRef.current?.querySelector('.inkio-ie-root[aria-busy="true"]')) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }

    setConfirmDiscard(false);
    onClose();
  }, [isDirty, confirmDiscard, onClose]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    // Radix receives Escape before the editor's popover listener. Let that
    // listener dismiss the nested control without closing the image editor.
    if (contentRef.current?.querySelector('.inkio-ie-option-popover, .inkio-ie-canvas-text-editor')) return;
    // While the confirm card is open, Escape dismisses it — not the modal.
    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }
    requestClose();
  }, [confirmDiscard, requestClose]);

  async function saveAndClose(save: () => void | Promise<void>) {
    if (savingRef.current) return;
    setConfirmDiscard(false);
    savingRef.current = true;
    try {
      await save();
      onClose();
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) requestClose(); }}>
      <Dialog.Portal>
        {/* Always mark the theme: an unmarked `.inkio` picks up a `.dark` page (tokens.css). */}
        <div className={`inkio inkio-ie-portal-theme ${portalTheme}`} style={{ colorScheme: portalTheme }}>
          <Dialog.Overlay className="inkio-ie-modal-overlay" data-testid="inkio-ie-modal-overlay" />
          <Dialog.Content
            ref={contentRef}
            className={`inkio-ie-modal-content${portalTheme === 'dark' ? ' dark' : ''}`}
            data-testid="inkio-ie-modal-content"
            aria-describedby={undefined}
            onEscapeKeyDown={handleEscape}
          >
            <Dialog.Title asChild>
              <span className="inkio-ie-sr-only">{resolvedImageEditorLocale.dialogTitle ?? 'Image editor'}</span>
            </Dialog.Title>
            {confirmDiscard && (
              <div
                className="inkio-ie-discard-confirm"
                role="alertdialog"
                aria-modal="false"
                aria-label={resolvedImageEditorLocale.closeConfirm ?? 'Discard your image edits?'}
                data-testid="inkio-ie-discard-confirm"
              >
                <p className="inkio-ie-discard-confirm-text">
                  {resolvedImageEditorLocale.closeConfirm ?? 'Discard your image edits?'}
                </p>
                <div className="inkio-ie-discard-confirm-actions">
                  <button
                    type="button"
                    className="inkio-ie-discard-confirm-btn is-danger"
                    data-testid="inkio-ie-discard-confirm-ok"
                    onClick={() => {
                      setConfirmDiscard(false);
                      onClose();
                    }}
                  >
                    {resolvedImageEditorLocale.discardChanges ?? 'Discard changes'}
                  </button>
                  <button
                    type="button"
                    className="inkio-ie-discard-confirm-btn"
                    data-testid="inkio-ie-discard-confirm-cancel"
                    onClick={() => setConfirmDiscard(false)}
                    autoFocus
                  >
                    {resolvedImageEditorLocale.cancel ?? 'Cancel'}
                  </button>
                </div>
              </div>
            )}
            <ImageEditorWorkbench
              src={imageSrc}
              onUnchangedSave={() => {
                setConfirmDiscard(false);
                onClose();
              }}
              onSave={(dataUrl) => saveAndClose(() => onSave(dataUrl))}
              onSaveBlob={onSaveBlob && ((...output) => saveAndClose(() => onSaveBlob(...output)))}
              savePreview={savePreview}
              onCancel={requestClose}
              outputFormat={imageFormat}
              outputQuality={imageQuality}
              tools={tools}
              defaultTool={defaultTool}
              toolPlacement={toolPlacement}
              locale={resolvedImageEditorLocale}
              className="inkio-ie-modal-editor"
              onDirtyChange={setIsDirty}
            />
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
