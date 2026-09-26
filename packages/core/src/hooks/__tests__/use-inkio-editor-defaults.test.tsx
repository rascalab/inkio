import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInkioEditor } from '../use-inkio-editor';

describe('useInkioEditor default extensions', () => {
  it('falls back to the default schema when extensions are omitted', async () => {
    const { result, unmount } = renderHook(() =>
      useInkioEditor({ content: '<p>hi</p>' }),
    );
    try {
      await waitFor(() => {
        expect(result.current?.getHTML()).toBe('<p>hi</p>');
      });
      expect(result.current?.schema.nodes.paragraph).toBeTruthy();
      expect(result.current?.schema.nodes.text).toBeTruthy();
    } finally {
      unmount();
    }
  });

  // An explicit [] is a programming error (Tiptap cannot build a schema
  // without a top node) and must stay loud: it must never be conflated
  // with omission, which means "defaults".
  it('fails loud on an explicit empty array instead of defaulting', () => {
    const originalError = console.error;
    console.error = vi.fn();
    try {
      expect(() => renderHook(() => useInkioEditor({ extensions: [] }))).toThrow(RangeError);
    } finally {
      console.error = originalError;
    }
  });
});
