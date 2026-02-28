import type { Editor, JSONContent } from '@tiptap/core';

export interface InkioAdapter {
  onUpdate?: (content: JSONContent) => void;
  onCreate?: (editor: Editor) => void;
  onError?: (error: Error, context: { source: string; recoverable: boolean }) => void;
  locale?: 'ko' | 'en' | Record<string, string>;
}

export function isInkioAdapter(value: unknown): value is InkioAdapter {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const adapterKeys = ['onUpdate', 'onCreate', 'onError', 'locale'] as const;

  const hasAdapterKey = adapterKeys.some((key) => key in candidate);
  if (!hasAdapterKey) {
    return false;
  }

  if (candidate.onUpdate !== undefined && typeof candidate.onUpdate !== 'function') {
    return false;
  }

  if (candidate.onCreate !== undefined && typeof candidate.onCreate !== 'function') {
    return false;
  }

  if (candidate.onError !== undefined && typeof candidate.onError !== 'function') {
    return false;
  }

  if (
    candidate.locale !== undefined &&
    typeof candidate.locale !== 'string' &&
    typeof candidate.locale !== 'object'
  ) {
    return false;
  }

  return true;
}
