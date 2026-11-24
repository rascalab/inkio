import { InputRule, PasteRule, type Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import {
  createLatestWinsItems,
  createSuggestionRenderer,
  isSafeUrl,
} from '@inkio/core';

import { WikiLinkDisplay, type WikiLinkItem } from './wiki-link-display';
export type { WikiLinkOptions, WikiLinkItem } from './wiki-link-display';

export const WikiLinkPluginKey = new PluginKey('wikiLink');

// WikiLink 패턴 정규식
// PasteRule은 /g 정규식의 lastIndex 상태를 공유하므로, 매 호출마다 새 인스턴스를
// 생성하기 위해 소스 문자열로 보관한다.
const WIKI_LINK_PATTERN = '\\[\\[([^\\]]+)\\]\\]';
const WIKI_LINK_INPUT_REGEX = /\[\[([^\]]+)\]\]$/;

export const WikiLink = WikiLinkDisplay.extend({
  addProseMirrorPlugins() {
    if (!this.options.items) return [];
    const type = this.type;
    const items = createLatestWinsItems<{ query: string; editor: Editor }, WikiLinkItem>({
      debounceMs: 150,
      source: ({ query }) => this.options.items?.({ query }),
      onError: (error) => {
        this.options.onError?.(error, { source: 'wikiLink.suggestion', recoverable: true });
      },
    });

    return [
      Suggestion<WikiLinkItem, WikiLinkItem>({
        editor: this.editor,
        char: '[[',
        pluginKey: WikiLinkPluginKey,
        // Page names usually contain spaces.
        allowSpaces: true,
        items: ({ query, editor, signal }) => items({ query, editor }, signal),
        allow: ({ state, range }) => !!state.doc.resolve(range.from).parent.type.contentMatch.matchType(type),
        command: ({ editor, range, props }) => {
          const href = typeof props.id === 'string' ? props.id.trim() : '';
          if (!href || !isSafeUrl(href)) return;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: type.name, attrs: { href } },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        render: createSuggestionRenderer<WikiLinkItem>({
          pluginKey: WikiLinkPluginKey,
          header: (said) => said.pages,
          locale: this.options.locale,
          messages: this.options.messages,
        }),
      }),
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: WIKI_LINK_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const text = (match[1] ?? '').trim();
          if (!text) return;
          // Reject javascript:/data:/vbscript: targets typed by the user.
          if (!isSafeUrl(text)) return;

          tr.replaceWith(start, end, this.type.create({ href: text }));
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: new RegExp(WIKI_LINK_PATTERN, 'g'),
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const text = (match[1] ?? '').trim();
          if (!text) return;
          // Reject javascript:/data:/vbscript: targets from pasted content.
          if (!isSafeUrl(text)) return;

          tr.replaceWith(start, end, this.type.create({ href: text }));
        },
      }),
    ];
  },
});
