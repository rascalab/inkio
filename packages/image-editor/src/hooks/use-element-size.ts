import { useCallback, useEffect, useState } from 'react';

const ZERO_SIZE = { width: 0, height: 0 };

export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState(ZERO_SIZE);

  const ref = useCallback((nextNode: T | null) => {
    setNode(nextNode);
  }, []);

  useEffect(() => {
    if (!node) {
      setSize(ZERO_SIZE);
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        measure();
        return;
      }

      // Guard against no-op observations: setSize with a fresh object every
      // tick re-renders consumers even when nothing changed.
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [node]);

  return { ref, size };
}
