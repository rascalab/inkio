
import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useMemo, useState } from 'react';
import { ImageEditor } from './ImageEditor';
import type { ImageEditorLocale, ImageEditorModalProps } from './types';
import { useInkioImageEditorUi } from './i18n';

export type { ImageEditorModalProps };

function resolvePortalTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const inkioRoot = document.querySelector('.inkio');
  const explicitTheme = inkioRoot?.getAttribute('data-theme');
  if (explicitTheme === 'light' || explicitTheme === 'dark') {
    return explicitTheme;
  }

  if (
    explicitTheme === 'auto'
    && typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

function isImageEditorLocaleOverrides(value: unknown): value is Partial<ImageEditorLocale> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ImageEditorModal({
  isOpen,
  imageSrc,
  onSave,
  onClose,
  theme,
  imageQuality = 0.92,
  imageFormat = 'png',
  tools,
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

  const localeOverrides: Partial<ImageEditorLocale> | undefined =
    isImageEditorLocaleOverrides(locale) ? (locale as Partial<ImageEditorLocale>) : undefined;
  const resolvedImageEditorLocale: Partial<ImageEditorLocale> = useMemo(
    () => ({
      ...ui.messages.imageEditor,
      ...(localeOverrides ?? {}),
    }),
    [localeOverrides, ui.messages.imageEditor],
  );
  const [isDirty, setIsDirty] = useState(false);
  const portalTheme = theme ?? resolvePortalTheme();

  const requestClose = useCallback(() => {
    if (isDirty && !window.confirm(resolvedImageEditorLocale.closeConfirm ?? 'Discard your image edits?')) {
      return;
    }

    onClose();
  }, [isDirty, onClose, resolvedImageEditorLocale.closeConfirm]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) requestClose(); }}>
      <Dialog.Portal>
        <div className="inkio inkio-ie-portal-theme" data-theme={portalTheme} style={{ colorScheme: portalTheme }}>
          <Dialog.Overlay className="inkio-ie-modal-overlay" data-testid="inkio-ie-modal-overlay" />
          <Dialog.Content
            className="inkio-ie-modal-content"
            data-testid="inkio-ie-modal-content"
            data-theme={portalTheme}
            aria-describedby={undefined}
            onPointerDownOutside={(event) => {
              event.preventDefault();
            }}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              requestClose();
            }}
          >
            <Dialog.Title asChild>
              <span className="inkio-ie-sr-only">Image editor</span>
            </Dialog.Title>
            <ImageEditor
              src={imageSrc}
              onSave={(dataUrl) => {
                onSave(dataUrl);
                onClose();
              }}
              onCancel={requestClose}
              outputFormat={imageFormat}
              outputQuality={imageQuality}
              tools={tools}
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
