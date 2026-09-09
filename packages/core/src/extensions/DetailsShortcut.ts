import { Extension, InputRule } from '@tiptap/core';
import { runOptionalPreparedChainCommand } from './optional-commands';

export const DetailsShortcut = Extension.create({
  name: 'detailsShortcut',

  addInputRules() {
    return [
      // NOTE: `> ` is owned by the blockquote input rule and would collide,
      // so the toggle-list shortcut uses `>>> ` (typed at an empty line start).
      new InputRule({
        find: /^>>> $/,
        handler: ({ range, chain }) => {
          runOptionalPreparedChainCommand(chain().deleteRange(range), 'setDetails');
        },
      }),
    ];
  },
});
