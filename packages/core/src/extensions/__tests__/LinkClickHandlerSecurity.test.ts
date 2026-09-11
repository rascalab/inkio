import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from '@tiptap/pm/state';
import { LinkClickHandler } from '../LinkClickHandler';

function buildPlugin(onLinkClick?: (href: string, event: MouseEvent) => void): Plugin {
  const plugins = LinkClickHandler.config.addProseMirrorPlugins!.call(
    { options: { onLinkClick } } as never,
  ) as unknown as Plugin[];
  expect(plugins).toHaveLength(1);
  return plugins[0]!;
}

function anchorTarget(href: string): HTMLElement {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  anchor.textContent = 'x';
  return anchor;
}

function clickEvent(target: HTMLElement | null, ctrlKey = true): MouseEvent {
  return { ctrlKey, metaKey: false, button: 0, target } as unknown as MouseEvent;
}

function handleClick(plugin: Plugin, event: MouseEvent): boolean {
  const handler = plugin.spec.props?.handleClick as
    | ((view: unknown, pos: number, event: MouseEvent) => boolean)
    | undefined;
  expect(handler).toBeDefined();
  return handler!(undefined, 1, event);
}

/**
 * The plugin validates (default opener) or passes the raw href through
 * (custom onLinkClick — the consumer's documented responsibility).
 * The plugin prop is invoked directly: Tiptap Link blanks javascript: hrefs
 * at render, so no real editor DOM can carry one.
 */
describe('LinkClickHandler', () => {
  it('opens safe URLs with noopener,noreferrer', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      const handled = handleClick(buildPlugin(), clickEvent(anchorTarget('https://example.com')));
      expect(handled).toBe(true);
      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    } finally {
      openSpy.mockRestore();
    }
  });

  it('does not open javascript:/data: URLs by default', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      for (const href of ['javascript:alert(1)', 'data:text/html,<i>x</i>', 'vbscript:msgbox(1)']) {
        handleClick(buildPlugin(), clickEvent(anchorTarget(href)));
      }
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
    }
  });

  it('passes the raw href to a custom onLinkClick (consumer must validate)', () => {
    const onLinkClick = vi.fn();
    const handled = handleClick(
      buildPlugin(onLinkClick),
      clickEvent(anchorTarget('javascript:alert(1)')),
    );
    expect(handled).toBe(true);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick.mock.calls[0]?.[0]).toBe('javascript:alert(1)');
  });

  it('ignores clicks without a modifier key', () => {
    const onLinkClick = vi.fn();
    const handled = handleClick(
      buildPlugin(onLinkClick),
      clickEvent(anchorTarget('https://example.com'), false),
    );
    expect(handled).toBe(false);
    expect(onLinkClick).not.toHaveBeenCalled();
  });
});
