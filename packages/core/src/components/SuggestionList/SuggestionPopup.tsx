import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SuggestionProps, SuggestionKeyDownProps, type SuggestionOptions } from '@tiptap/suggestion';
import { SuggestionList, SuggestionItem, SuggestionListRef } from './SuggestionList';
import {
  toCoreMessageOverrides,
  resolveCoreMessages,
  type InkioCoreMessageOverrides,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '../../i18n/messages';
import {
  autoUpdateOverlayPosition,
  computeOverlayPosition,
  toRectLike,
} from '../../overlay/positioning';

export interface CreateSuggestionRendererOptions {
  /** Custom header text */
  header?: string;
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
  const resolvedMessages = resolveCoreMessages(
    options.locale,
    toCoreMessageOverrides(options.messages),
  );

  return () => {
    let popup: HTMLDivElement | null = null;
    let root: Root | null = null;
    let component: SuggestionListRef | null = null;
    let cleanupAutoUpdate: (() => void) | null = null;
    let latestProps: SuggestionProps<any, I> | null = null;

    const updatePopupPosition = () => {
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

      if (!root) {
        return;
      }

      root.render(
        <SuggestionList
          ref={(ref) => {
            component = ref;
          }}
          items={props.items as SuggestionItem[]}
          command={props.command as unknown as (item: SuggestionItem) => void}
          header={options.header}
          emptyMessage={options.emptyMessage ?? resolvedMessages.suggestion.empty}
          renderItem={options.renderItem}
        />,
      );

      requestAnimationFrame(updatePopupPosition);
    };

    return {
      onStart: (props: SuggestionProps<any, I>) => {
        latestProps = props;

        popup = document.createElement('div');
        popup.className = 'inkio';
        popup.style.position = 'fixed';
        popup.style.zIndex = 'var(--inkio-layer-suggestion, 130)';

        const editorEl = props.editor.view.dom.closest('.inkio');
        if (editorEl) {
          const theme = editorEl.getAttribute('data-theme');
          if (theme) {
            popup.setAttribute('data-theme', theme);
          }
        }

        document.body.appendChild(popup);

        cleanupAutoUpdate = autoUpdateOverlayPosition({
          update: updatePopupPosition,
          elements: [props.editor.view.dom, popup],
        });

        root = createRoot(popup);
        renderList(props);
      },

      onUpdate: (props: SuggestionProps<any, I>) => {
        latestProps = props;

        if (root) {
          renderList(props);
          return;
        }

      },

      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        if (props.event.key === 'Escape') {
          return false;
        }

        return component?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        const popupToRemove = popup;
        const rootToUnmount = root;

        cleanupAutoUpdate?.();
        cleanupAutoUpdate = null;

        popup = null;
        root = null;
        component = null;
        latestProps = null;

        queueMicrotask(() => {
          rootToUnmount?.unmount();
          popupToRemove?.remove();
        });
      },
    };
  };
}
