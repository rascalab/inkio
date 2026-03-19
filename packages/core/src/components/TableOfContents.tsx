'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { getHeadingsFromContent } from './ToC';
import type { HeadingItem } from './ToC';

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

function getHeadingElements(source?: TiptapEditor | null, maxLevel = 6): HTMLElement[] {
  const container = source?.view?.dom;
  if (!container) return [];
  const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(', ');
  return Array.from(container.querySelectorAll(selector));
}

export function ToC({
  source,
  maxLevel = 3,
  className,
  style,
}: ToCProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>(() =>
    getHeadingsFromContent(source?.getJSON() ?? null),
  );

  useEffect(() => {
    if (!source) {
      setHeadings([]);
      return;
    }

    // Recompute on initial mount in case source was already set.
    setHeadings(getHeadingsFromContent(source.getJSON()));

    const onUpdate = () => {
      setHeadings(getHeadingsFromContent(source.getJSON()));
    };

    source.on('update', onUpdate);
    return () => {
      source.off('update', onUpdate);
    };
  }, [source]);

  const filtered = useMemo(() => headings.filter((h) => h.level <= maxLevel), [headings, maxLevel]);
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (filtered.length === 0) return;

    const headingEls = getHeadingElements(source, maxLevel);
    if (headingEls.length === 0) return;

    const indexMap = new WeakMap<Element, number>();
    headingEls.forEach((el, i) => indexMap.set(el, i));

    observerRef.current = new IntersectionObserver(
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
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [filtered, source, maxLevel]);

  const handleClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      const headingEls = getHeadingElements(source, maxLevel);
      headingEls[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIndex(index);
    },
    [source, maxLevel],
  );

  if (filtered.length === 0) return null;

  const minLevel = Math.min(...filtered.map((h) => h.level));

  return (
    <nav
      className={`inkio-toc${className ? ` ${className}` : ''}`}
      style={style}
      aria-label="Table of contents"
    >
      <div className="inkio-toc-title">ON THIS PAGE</div>
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
              onClick={(e) => handleClick(e, i)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
