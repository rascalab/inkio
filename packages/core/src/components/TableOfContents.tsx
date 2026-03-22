'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useHeadings } from './useHeadings';

export interface ToCProps {
  /** Editor or Viewer instance — used to find heading elements and extract content. */
  source?: TiptapEditor | null;
  /** Maximum heading level to include (default: 3 → h1-h3). */
  maxLevel?: number;
  /** Class name for the root element. */
  className?: string;
  /** Style for the root element. */
  style?: React.CSSProperties;
}

/**
 * CSS custom property: `--inkio-scroll-offset`
 *
 * Set this property (in px) on the editor's parent element to account for
 * sticky headers or other fixed chrome that offsets the visible viewport top.
 *
 * @example
 * ```css
 * .my-editor-wrapper {
 *   --inkio-scroll-offset: 64px; /* height of your sticky nav *\/
 * }
 * ```
 *
 * The ToC scroll-tracking effect reads this value via `getComputedStyle` and
 * passes it to `calcTocTop` so the floating nav stays within the editor bounds
 * even when a portion of the viewport is occupied by fixed UI.
 */

/** Bar width by heading depth (0 = top-level). */
const BAR_WIDTHS = [1.25, 0.875, 0.625, 0.5, 0.375, 0.375];

const MARGIN = 48; // px margin from editor top/bottom

/**
 * Calculate the top offset (px) for the ToC within an editor container.
 * - Editor top visible → pin to MARGIN from editor top
 * - Editor bottom close → pin to editor bottom minus nav height
 * - Otherwise → float with viewport scroll
 */
export function calcTocTop(
  editorTop: number,
  editorBottom: number,
  navHeight: number,
  scrollOffset = 0,
): number {
  const viewportTop = scrollOffset + MARGIN;
  const editorHeight = editorBottom - editorTop;

  if (editorTop >= viewportTop) {
    return MARGIN;
  }
  if (editorBottom - navHeight - MARGIN < viewportTop) {
    return Math.max(MARGIN, editorHeight - navHeight - MARGIN);
  }
  return viewportTop - editorTop;
}

export function ToC({
  source,
  maxLevel = 3,
  className,
  style,
}: ToCProps) {
  const navRef = useRef<HTMLElement>(null);
  const { filtered, minLevel, headingElsRef, handleClick } = useHeadings(source, maxLevel);

  // Track scroll to keep ToC within editor bounds.
  // Debounced: waits until scroll stops, then smoothly transitions via CSS.
  useEffect(() => {
    const editorDom = source?.view?.dom?.parentElement;
    const nav = navRef.current;
    if (!editorDom || !nav) return;

    let timerId = 0;

    const apply = () => {
      const navHeight = nav.offsetHeight;
      const scrollOffset = parseInt(
        getComputedStyle(editorDom).getPropertyValue('--inkio-scroll-offset') || '0',
        10,
      ) || 0;
      const { top, bottom } = editorDom.getBoundingClientRect();
      const nextY = calcTocTop(top, bottom, navHeight, scrollOffset);
      nav.style.transform = `translateY(${nextY}px)`;
    };

    const onScroll = () => {
      clearTimeout(timerId);
      timerId = window.setTimeout(apply, 120);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [source, filtered]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (filtered.length === 0) return;
    const headingEls = headingElsRef.current;
    if (headingEls.length === 0) return;

    const indexMap = new WeakMap<Element, number>();
    headingEls.forEach((el, i) => indexMap.set(el, i));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const idx = indexMap.get(visible[0].target);
          if (idx !== undefined) setActiveIndex(idx);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    for (const el of headingEls) {
      observer.observe(el);
    }
    return () => { observer.disconnect(); };
  }, [filtered, headingElsRef]);

  const onLinkClick = (e: React.MouseEvent, i: number) => {
    handleClick(e, i);
    setActiveIndex(i);
  };

  if (filtered.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className={`inkio-toc${className ? ` ${className}` : ''}`}
      style={style}
      aria-label="Table of contents"
    >
      {/* Minimap bars (default) */}
      <div className="inkio-toc-minimap">
        {filtered.map((heading, i) => (
          <div
            key={`bar-${heading.id}-${i}`}
            className={`inkio-toc-bar${activeIndex === i ? ' is-active' : ''}`}
            style={{ width: `${BAR_WIDTHS[heading.level - minLevel] ?? 0.375}rem` }}
          />
        ))}
      </div>

      {/* Expanded panel (on hover) */}
      <div className="inkio-toc-panel">
        <ul className="inkio-toc-list">
          {filtered.map((heading, i) => (
            <li
              key={`${heading.id}-${i}`}
              className={`inkio-toc-item${activeIndex === i ? ' is-active' : ''}`}
              style={{ '--inkio-toc-depth': heading.level - minLevel } as React.CSSProperties}
            >
              <a
                href={`#${heading.id}`}
                className="inkio-toc-link"
                onClick={(e) => onLinkClick(e, i)}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
