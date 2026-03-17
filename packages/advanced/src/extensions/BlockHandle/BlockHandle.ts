import { Extension } from '@tiptap/core';
import type { Plugin } from '@tiptap/pm/state';
import { createBlockHandlePlugin } from './block-drag-plugin';
import type { BlockMenuIcons } from './icons';
import type { InkioLocaleInput, InkioMessageOverrides, InkioCoreMessageOverrides } from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';

export interface BlockHandleOptions {
  HTMLAttributes: Record<string, any>;
  dragHandleWidth: number;
  icons?: BlockMenuIcons;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  coreIcons?: Partial<InkioIconRegistry>;
}

export const BlockHandle = Extension.create<BlockHandleOptions>({
  name: 'blockHandle',

  // Keep priority lower than Dropcursor so drag interactions do not conflict.
  priority: 50,

  addOptions() {
    return {
      HTMLAttributes: {},
      dragHandleWidth: 24,
      icons: undefined,
      locale: undefined,
      messages: undefined,
      coreIcons: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      createBlockHandlePlugin({
        handleWidth: this.options.dragHandleWidth,
        editor: this.editor,
        icons: this.options.icons,
        locale: this.options.locale,
        messages: this.options.messages,
        coreIcons: this.options.coreIcons,
      }),
    ] as Plugin[];
  },
});
