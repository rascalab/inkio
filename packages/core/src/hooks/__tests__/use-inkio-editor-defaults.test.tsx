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

  it('does not report an update on mount or when only editable changes', async () => {
    const onUpdate = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ editable }) => useInkioEditor({ content: '<p>hi</p>', editable, onUpdate }),
      { initialProps: { editable: true } },
    );
    try {
      await waitFor(() => {
        expect(result.current?.getHTML()).toBe('<p>hi</p>');
      });
      rerender({ editable: false });
      await waitFor(() => {
        expect(result.current?.isEditable).toBe(false);
      });
      await Promise.resolve();
      expect(onUpdate).not.toHaveBeenCalled();

      // A real document change still reports.
      result.current!.commands.insertContent('!');
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
    } finally {
      unmount();
    }
  });

  it('coalesces changes and only serializes when a JSON listener exists', async () => {
    const onChange = vi.fn();
    const onUpdate = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ json }) => useInkioEditor({ onChange, onUpdate: json ? onUpdate : undefined }),
      { initialProps: { json: false } },
    );
    try {
      await waitFor(() => expect(result.current).not.toBeNull());
      const editor = result.current!;
      const serialize = vi.spyOn(editor, 'getJSON');
      editor.commands.insertContent('a');
      editor.commands.insertContent('b');
      await Promise.resolve();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(editor);
      expect(editor.text).toBe('ab');
      expect(serialize).not.toHaveBeenCalled();
      rerender({ json: true });
      editor.commands.insertContent('c');
      await Promise.resolve();
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(serialize).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  // A replacement without a top node is invalid, not a request for defaults.
  it('does not silently restore defaults for an empty replacement', () => {
    const originalError = console.error;
    console.error = vi.fn();
    try {
      expect(() => renderHook(() => useInkioEditor({ extensions: { items: [], replace: true } }))).toThrow(RangeError);
    } finally {
      console.error = originalError;
    }
  });
});
