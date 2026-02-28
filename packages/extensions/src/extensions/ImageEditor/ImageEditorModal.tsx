
import * as Dialog from '@radix-ui/react-dialog';
import type { InkioIconRegistry, InkioLocaleInput, InkioMessageOverrides } from '@inkio/editor';
import { ImageEditor } from './editor';
import type { ImageEditorLocale, ImageEditorModalProps } from './editor/types';
import {
  useInkioExtensionsUi,
  type InkioExtensionsMessageOverrides,
} from '../../i18n';

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
  messages?: InkioExtensionsMessageOverrides | InkioMessageOverrides;
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
  const ui = useInkioExtensionsUi({
    locale,
    messages,
    icons,
  });

  const localeOverrides: Partial<ImageEditorLocale> | undefined =
    isImageEditorLocaleOverrides(locale) ? (locale as Partial<ImageEditorLocale>) : undefined;
  const resolvedImageEditorLocale: Partial<ImageEditorLocale> = {
    ...ui.messages.imageEditor,
    ...(localeOverrides ?? {}),
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="inkio-ie-modal-overlay" />
        <Dialog.Content
          className="inkio-ie-modal-content"
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={onClose}
        >
          <Dialog.Title className="inkio-ie-sr-only">Image editor</Dialog.Title>
          <ImageEditor
            src={imageSrc}
            onSave={(dataUrl) => {
              onSave(dataUrl);
              onClose();
            }}
            onCancel={onClose}
            outputFormat={imageFormat}
            outputQuality={imageQuality}
            tools={tools}
            locale={resolvedImageEditorLocale}
            className="inkio-ie-modal-editor"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
