
import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useMemo, useState } from 'react';
import type { InkioLocaleInput, InkioMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import { ImageEditor } from './editor';
import type { ImageEditorLocale, ImageEditorModalProps } from './editor/types';
import {
  useInkioImageEditorUi,
  type InkioImageEditorMessageOverrides,
} from '../i18n';

export type { ImageEditorModalProps };

function isImageEditorLocaleOverrides(value: unknown): value is Partial<ImageEditorLocale> {
  return (
    typeof value === 'object'
    && value !== null
    && (
      'crop' in (value as Record<string, unknown>)
      || 'save' in (value as Record<string, unknown>)
      || 'cancel' in (value as Record<string, unknown>)
    )
  );
}

interface ImageEditorModalComponentProps extends ImageEditorModalProps {
  locale?: InkioLocaleInput;
  messages?: InkioImageEditorMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export function ImageEditorModal({
  isOpen,
  imageSrc,
  onSave,
  onClose,
  imageQuality = 0.92,
  imageFormat = 'png',
  tools,
  locale,
  messages,
  icons,
}: ImageEditorModalComponentProps) {
  const ui = useInkioImageEditorUi({
    locale,
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

  const requestClose = useCallback(() => {
    if (isDirty && !window.confirm(resolvedImageEditorLocale.closeConfirm ?? 'Discard your image edits?')) {
      return;
    }

    onClose();
  }, [isDirty, onClose, resolvedImageEditorLocale.closeConfirm]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) requestClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="inkio-ie-modal-overlay" />
        <Dialog.Content
          className="inkio-ie-modal-content"
          aria-describedby={undefined}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
        >
          <Dialog.Title className="inkio-ie-sr-only">Image editor</Dialog.Title>
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
      </Dialog.Portal>
    </Dialog.Root>
  );
};
