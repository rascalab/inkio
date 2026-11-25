import { useState, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { Editor } from '@tiptap/react';
import type { InkioCoreMessages } from '../i18n/messages';
import { BubbleMenuLinkInputPopover } from './BubbleMenuLinkInputPopover';

interface EditorLinkPopoverProps {
  editor: Editor;
  messages: InkioCoreMessages['linkPopover'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  side?: 'top' | 'bottom';
  sideOffset: number;
  children: ReactElement;
}

export function EditorLinkPopover({
  editor, messages, open, onOpenChange, container, side, sideOffset, children,
}: EditorLinkPopoverProps) {
  const [initialUrl, setInitialUrl] = useState('');

  function closeToEditor() {
    onOpenChange(false);
    // Tiptap's focus command runs on a later frame, which can already belong
    // to the next toolbar button or a reopened URL field.
    editor.view.focus();
    editor.commands.scrollIntoView();
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => {
      if (next) setInitialUrl(String(editor.getAttributes('link').href ?? ''));
      onOpenChange(next);
    }}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal container={container}>
        <div className="inkio-link-portal">
          <Popover.Content
            side={side}
            sideOffset={sideOffset}
            collisionPadding={8}
            sticky="always"
            className={container ? 'inkio-popover-content' : 'inkio inkio-popover-content'}
            // Save/Cancel/Escape restore the selection themselves. Outside
            // interactions keep their destination; never queue trigger focus.
            onCloseAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (!event.isComposing) closeToEditor();
            }}
          >
            <BubbleMenuLinkInputPopover
              initialUrl={initialUrl}
              placeholder={messages.placeholder}
              cancelLabel={messages.cancel}
              saveLabel={messages.save}
              invalidUrlLabel={messages.invalidUrl}
              onSave={(href) => {
                const chain = editor.chain();
                if (initialUrl) chain.extendMarkRange('link');
                chain.setLink({ href }).run();
                closeToEditor();
              }}
              onCancel={closeToEditor}
            />
          </Popover.Content>
        </div>
      </Popover.Portal>
    </Popover.Root>
  );
}
