import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { getHeadingsFromDoc, getHeadingElements } from './ToC';
import type { HeadingItem } from './ToC';

export function useHeadings(source: Editor | null | undefined, maxLevel = 3) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const headingElsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!source) {
      setHeadings([]);
      return;
    }
    const update = () => {
      const next = getHeadingsFromDoc(source.state.doc);
      setHeadings(prev => {
        if (prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].level !== next[i].level || prev[i].text !== next[i].text || prev[i].id !== next[i].id) return next;
        }
        return prev;
      });
    };
    update();
    const onUpdate = ({ transaction }: { transaction?: { docChanged?: boolean } } = {}) => {
      if (transaction && !transaction.docChanged) return;
      update();
    };
    source.on('update', onUpdate);
    return () => { source.off('update', onUpdate); };
  }, [source]);

  const filtered = useMemo(() => headings.filter((h) => h.level <= maxLevel), [headings, maxLevel]);

  const minLevel = useMemo(
    () => (filtered.length > 0 ? Math.min(...filtered.map((h) => h.level)) : 1),
    [filtered],
  );

  // Cache heading DOM elements — refreshed when filtered changes
  useEffect(() => {
    headingElsRef.current = getHeadingElements(source, maxLevel);
  }, [filtered, source, maxLevel]);

  const handleClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      headingElsRef.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  return { headings, filtered, minLevel, headingElsRef, handleClick };
}
