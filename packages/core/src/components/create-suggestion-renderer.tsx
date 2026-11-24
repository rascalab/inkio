import React from 'react';
import { exitSuggestion, type SuggestionProps, type SuggestionKeyDownProps, type SuggestionOptions } from '@tiptap/suggestion';
import { SuggestionList, SuggestionItem, SuggestionListRef } from './SuggestionList';
import { editorUi } from '../context/editor-ui';
import {
  toCoreMessageOverrides,
  resolveCoreMessages,
  type InkioCoreMessageOverrides,
  type InkioCoreMessages,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '../i18n/messages';
import {
  computeOverlayPosition,
  toRectLike,
} from '../overlay/positioning';
import { createOverlayHost, type OverlayHost } from '../utils/overlay-host';

export interface CreateSuggestionRendererOptions {
  /** Match the Suggestion plugin's key so keyboard dismissal exits the right popup. */
  pluginKey?: SuggestionOptions['pluginKey'];
  /** Custom header text, or a pick from the locale's suggestion messages */
  header?: string | ((messages: InkioCoreMessages['suggestion']) => string);
  /** Empty state message */
  emptyMessage?: string;
  /** Custom render function for items */
  renderItem?: (item: SuggestionItem, isSelected: boolean) => React.ReactNode;
  /** Locale tag or Accept-Language string. */
  locale?: InkioLocaleInput;
  /** Message overrides for core suggestion labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
}

/**
 * Creates a suggestion popup renderer for Tiptap's Suggestion plugin.
 * Uses a dedicated React root attached to `document.body`.
 */
export function createSuggestionRenderer<I extends SuggestionItem = SuggestionItem>(
  options: CreateSuggestionRendererOptions = {}
): NonNullable<SuggestionOptions<I>['render']> {
  return () => {
    let host: OverlayHost | null = null;
    let component: { ref: SuggestionListRef; props: SuggestionProps<I, I> } | null = null;
    let cleanupAutoUpdate: (() => void) | null = null;
    let latestProps: SuggestionProps<I, I> | null = null;
    let settledItems: I[] | null = null;

    const updatePopupPosition = () => {
      const popup = host?.element;
      if (!popup || !latestProps) {
        return;
      }

      const rect = latestProps.clientRect?.();
      if (!rect) {
        return;
      }

      const next = computeOverlayPosition({
        anchorRect: toRectLike(rect),
        floatingRect: {
          width: popup.offsetWidth || 220,
          height: popup.offsetHeight || 120,
        },
        placement: 'bottom',
        align: 'start',
        offset: 8,
        padding: 8,
        flip: true,
        shift: true,
      });

      popup.style.left = `${next.left}px`;
      popup.style.top = `${next.top}px`;
    };

    const renderList = (props: SuggestionProps<I, I>) => {
      latestProps = props;

      if (!host) {
        return;
      }

      // Tiptap >= 3.31 reports every query twice: first with `loading: true`
      // and no items, then with the result. Rendering the loading pass would
      // flash the empty state on each keystroke, so the previous list stays
      // up until the result arrives and nothing shows before the first one.
      if (!props.loading) {
        settledItems = props.items;
      }
      const stale = props.loading && !props.items.length;
      const visibleItems = stale ? settledItems : props.items;
      host.element.inert = stale;
      if (!visibleItems) {
        return;
      }

      const { locale, messages } = editorUi(props.editor, {
        locale: options.locale,
        messages: options.messages,
      });
      const header = typeof options.header === 'function'
        ? options.header(resolveCoreMessages(locale, toCoreMessageOverrides(messages)).suggestion)
        : options.header;

      host.render(
        <SuggestionList
          ref={(ref) => {
            if (ref) component = { ref, props };
            else if (component?.props === props) component = null;
          }}
          items={visibleItems}
          command={(item) => {
            // React may not have committed the new rows (or unmounted the old
            // root) yet. Never apply an item against an obsolete editor range.
            if (!stale && latestProps === props && !props.editor.isDestroyed && props.editor.isEditable) {
              props.command(item as I);
            }
          }}
          header={header}
          emptyMessage={options.emptyMessage}
          renderItem={options.renderItem}
          locale={locale}
          messages={messages}
        />,
      );

      requestAnimationFrame(updatePopupPosition);
    };

    return {
      onStart: (props: SuggestionProps<I, I>) => {
        latestProps = props;

        host = createOverlayHost({
          editorDom: props.editor.view.dom,
          label: 'suggestion popup',
          style: {
            position: 'fixed',
            zIndex: 'var(--inkio-layer-suggestion, 130)',
          },
        });

        // Let the plugin own outside-pointer dismissal and observer cleanup;
        // retain Inkio's fixed, viewport-clamped positioning.
        cleanupAutoUpdate = props.mount(host.element, { onPosition: updatePopupPosition });

        renderList(props);
      },

      onUpdate: (props: SuggestionProps<I, I>) => {
        if (host) {
          renderList(props);
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        if (host && props.event.key === 'Tab' && !props.event.isComposing && !props.view.composing) {
          const currentHost = host;
          // Tab can also indent a list or move between cells. Let the editor
          // handle it; dismiss only if the browser actually moved focus out.
          requestAnimationFrame(() => {
            if (host === currentHost && !props.view.hasFocus()
              && !host.element.contains(props.view.dom.ownerDocument.activeElement)) {
              exitSuggestion(props.view, options.pluginKey);
            }
          });
          return false;
        }
        if (!component || component.props !== latestProps || host?.element.inert
          || !component.props.editor.isEditable || props.view.composing || props.event.key === 'Escape') {
          return false;
        }

        return component.ref.onKeyDown(props);
      },

      onExit: () => {
        cleanupAutoUpdate?.();
        cleanupAutoUpdate = null;

        host?.destroy();
        host = null;
        component = null;
        latestProps = null;
        settledItems = null;
      },
    };
  };
}
