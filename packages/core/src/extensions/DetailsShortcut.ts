import { Extension, InputRule } from '@tiptap/core';
import { runOptionalPreparedChainCommand } from './optional-commands';

export const DetailsShortcut = Extension.create({
  name: 'detailsShortcut',

  addInputRules() {
    return [
      new InputRule({
        find: /^> $/,
        handler: ({ range, chain }) => {
          runOptionalPreparedChainCommand(chain().deleteRange(range), 'setDetails');
        },
      }),
    ];
  },
});
