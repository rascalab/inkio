'use client';

import { useEffect } from 'react';
import type { HeadingItem } from './ToC';

type ViewerHeadingsBridgeProps = {
  headings: HeadingItem[];
  onHeadingsReady: (headings: HeadingItem[], scrollToIndex: (index: number) => void) => void;
};

export function ViewerHeadingsBridge({
  headings,
  onHeadingsReady,
}: ViewerHeadingsBridgeProps) {
  useEffect(() => {
    onHeadingsReady(headings, (index) => {
      const heading = headings[index];
      if (!heading) {
        return;
      }

      const element = document.getElementById(heading.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [headings, onHeadingsReady]);

  return null;
}
