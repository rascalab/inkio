'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Playground upload helper: blob URLs are revoked when the pane unmounts so
 * demo uploads stop leaking one URL per image. URLs live as long as the
 * pane; revoking earlier would break images still referenced by the doc.
 */
export function useObjectUrlRegistry() {
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  return useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    urlsRef.current.add(url);
    return url;
  }, []);
}
