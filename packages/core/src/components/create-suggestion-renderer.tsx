import React from 'react';
import { SuggestionProps, SuggestionKeyDownProps, type SuggestionOptions } from '@tiptap/suggestion';
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
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  toRectLike,
} from '../overlay/positioning';
import { createOverlayHost, type OverlayHost } from '../utils/overlay-host';

export interface CreateSuggestionRendererOptions {
  /** Custom header text, or a pick from the locale's suggestion messages */
  header?: string | ((messages: InkioCoreMessages['suggestion']) => string);
  /** Empty state message */
  emptyMessage?: string;
  /** Custom render function for items */
  renderItem?: (item: SuggestionItem, isSelected: boolean) => React.ReactNode;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
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
    let component: SuggestionListRef | null = null;
    let cleanupAutoUpdate: (() => void) | null = null;
    let latestProps: SuggestionProps<any, I> | null = null;
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

    const renderList = (props: SuggestionProps<any, I>) => {
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
      if (!settledItems) {
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
            component = ref;
          }}
          items={settledItems as SuggestionItem[]}
          command={props.command as unknown as (item: SuggestionItem) => void}
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
      onStart: (props: SuggestionProps<any, I>) => {
        latestProps = props;

        host = createOverlayHost({
          editorDom: props.editor.view.dom,
          label: 'suggestion popup',
          style: {
            position: 'fixed',
            zIndex: 'var(--inkio-layer-suggestion, 130)',
          },
        });

        cleanupAutoUpdate = autoUpdateOverlayPosition({
          update: updatePopupPosition,
          elements: [props.editor.view.dom, host.element],
        });

        renderList(props);
      },

      onUpdate: (props: SuggestionProps<any, I>) => {
        latestProps = props;

        if (host) {
          renderList(props);
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        if (props.event.key === 'Escape') {
          return false;
        }

        return component?.onKeyDown(props) ?? false;
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
