import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isSafeUrl } from '../utils/url-safety';

export interface LinkClickHandlerOptions {
  /** Custom handler for link clicks. Default: open in new tab */
  onLinkClick?: (href: string, event: MouseEvent) => void;
}

export const LinkClickHandler = Extension.create<LinkClickHandlerOptions>({
  name: 'linkClickHandler',

  addOptions() {
    return {
      onLinkClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const handler = this.options.onLinkClick
      ?? ((href: string) => {
        if (!isSafeUrl(href)) return;
        window.open(href, '_blank', 'noopener');
      });

    return [
      new Plugin({
        key: new PluginKey('linkClickHandler'),
        props: {
          handleClick(_view, _pos, event) {
            if (!event.metaKey && !event.ctrlKey) return false;
            const link = (event.target as HTMLElement).closest('a[href]');
            if (!link) return false;
            const href = link.getAttribute('href');
            if (href) {
              handler(href, event);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
