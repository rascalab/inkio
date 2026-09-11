import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isSafeUrl } from '../utils/url-safety';

export interface LinkClickHandlerOptions {
  /**
   * Custom handler for link clicks. Default: open in new tab.
   *
   * NOTE: `href` is the raw attribute value from the document — it is NOT
   * validated before this callback runs. A custom handler MUST validate it
   * (e.g. with `isSafeUrl` from `@inkio/core`) before navigating, opening a
   * window, or rendering it, otherwise `javascript:`/malicious `data:` URLs
   * can execute. The built-in default handler rejects unsafe URLs and opens
   * safe ones with `noopener,noreferrer`.
   */
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
    // The default opener validates before opening. A custom `onLinkClick`
    // intentionally receives the raw href (documented above) so consumers can
    // implement their own policy — they must validate it themselves.
    const handler = this.options.onLinkClick
      ?? ((href: string) => {
        if (!isSafeUrl(href)) return;
        window.open(href, '_blank', 'noopener,noreferrer');
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
