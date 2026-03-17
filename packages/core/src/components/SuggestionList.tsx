import React, {
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  resolveCoreMessages,
  toCoreMessageOverrides,
  type InkioCoreMessageOverrides,
  type InkioMessageOverrides,
} from '../i18n/messages';

export interface SuggestionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  [key: string]: unknown;
}

export interface SuggestionListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
  /** Custom render function for each item */
  renderItem?: (item: SuggestionItem, isSelected: boolean) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Header text */
  header?: string;
  /** Locale input (string, array, accept-language, Intl.Locale, etc.) */
  locale?: unknown;
  /** Message overrides for core suggestion labels */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
}

export interface SuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

// Inline Styles removed: using classes from styles-full.css

export function SuggestionList({
  items,
  command,
  renderItem,
  emptyMessage,
  header,
  locale,
  messages,
  ref,
}: SuggestionListProps & { ref?: React.Ref<SuggestionListRef> }) {
  const resolvedEmptyMessage = emptyMessage
    ?? resolveCoreMessages(locale, toCoreMessageOverrides(messages)).suggestion.empty;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<HTMLButtonElement[]>([]);

  /**
   * Check if an element is visible within the container's viewport
   * @param element - The element to check visibility for
   * @param container - The scroll container
   * @returns true if element is at least partially visible, false otherwise
   */
  const isElementVisible = (
    element: HTMLElement,
    container: HTMLElement
  ): boolean => {
    if (!element || !container) {
      return false;
    }

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Check if element is at least partially visible within container
    const isVisibleVertically =
      elementRect.bottom > containerRect.top &&
      elementRect.top < containerRect.bottom;

    const isVisibleHorizontally =
      elementRect.right > containerRect.left &&
      elementRect.left < containerRect.right;

    return isVisibleVertically && isVisibleHorizontally;
  };

  /**
   * Scroll container to bring element into view with smooth behavior
   * @param element - The element to scroll into view
   * @param container - The scroll container
   */
  const scrollToElement = (
    element: HTMLElement,
    container: HTMLElement
  ): void => {
    if (!element || !container) {
      return;
    }

    try {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } catch (error) {
      // Fallback to instant scroll if smooth scrolling fails
      console.warn('Smooth scroll failed, falling back to instant scroll:', error);
      element.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  };

  /**
   * Helper to get the scroll container from listContainerRef
   * @returns The scroll container element or null if not available
   */
  const getScrollContainer = (): HTMLElement | null => {
    return listContainerRef.current;
  };

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command]
  );

  const upHandler = useCallback(() => {
    setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
  }, [items.length]);

  const downHandler = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);

  useEffect(() => {
    const scrollToSelectedItem = () => {
      const selectedItem = itemRefs.current[selectedIndex];
      const scrollContainer = getScrollContainer();

      if (selectedItem && scrollContainer) {
        if (!isElementVisible(selectedItem, scrollContainer)) {
          scrollToElement(selectedItem, scrollContainer);
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM is updated
    const rafId = requestAnimationFrame(scrollToSelectedItem);
    return () => cancelAnimationFrame(rafId);
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  const defaultRenderItem = (item: SuggestionItem, isSelected: boolean) => (
    <div className={`inkio-suggestion-item-content ${isSelected ? 'is-selected' : ''}`}>
      {item.icon && <span className="inkio-suggestion-icon">{item.icon}</span>}
      <div className="inkio-suggestion-text-wrap">
        <div className="inkio-suggestion-label">{item.label}</div>
        {item.description && <div className="inkio-suggestion-description">{item.description}</div>}
      </div>
    </div>
  );

  const listboxId = 'inkio-suggestion-listbox';

  return (
    <div className="inkio-suggestion-container">
      {header && <div className="inkio-suggestion-header">{header}</div>}
      <div
        ref={listContainerRef}
        id={listboxId}
        role="listbox"
        aria-label="Suggestions"
        className="inkio-suggestion-list"
      >
        {items.length > 0 ? (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              ref={(el) => {
                if (el) {
                  itemRefs.current[index] = el;
                }
              }}
              className="inkio-suggestion-item"
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {renderItem
                ? renderItem(item, index === selectedIndex)
                : defaultRenderItem(item, index === selectedIndex)}
            </button>
          ))
        ) : (
          <div className="inkio-suggestion-empty">{resolvedEmptyMessage}</div>
        )}
      </div>
    </div>
  );
}

SuggestionList.displayName = 'SuggestionList';
