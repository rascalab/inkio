import { Extension, InputRule } from '@tiptap/core';
import { Details } from '@tiptap/extension-details';
import { DetailsSummary } from '@tiptap/extension-details';
import { DetailsContent } from '@tiptap/extension-details';

export type { DetailsOptions, DetailsSummaryOptions, DetailsContentOptions } from '@tiptap/extension-details';

export interface ToggleListOptions {
  HTMLAttributes: Record<string, any>;
}

export const ToggleList = Extension.create<ToggleListOptions>({
  name: 'toggleListExtension',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addExtensions() {
    return [
      Details.configure({
        persist: true,
        HTMLAttributes: this.options.HTMLAttributes,
      }),
      DetailsSummary,
      DetailsContent,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^> $/,
        handler: ({ range, chain }) => {
          chain()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: 'details',
              content: [
                { type: 'detailsSummary' },
                { type: 'detailsContent', content: [{ type: 'paragraph' }] },
              ],
            })
            .setTextSelection(range.from + 2)
            .run();
        },
      }),
    ];
  },
});

export { Details, DetailsSummary, DetailsContent };
