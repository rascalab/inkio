import { act, fireEvent, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { expect, it, vi } from 'vitest';
import { Comment } from '../Comment';

it.each(['Enter', 'Escape'])('restores the selection on %s without taking focus back from a reply', async (key) => {
  const mount = document.body.appendChild(document.createElement('div'));
  const reply = document.body.appendChild(document.createElement('input'));
  const editor = new Editor({
    element: mount,
    extensions: [Document, Paragraph, Text, Comment.configure({ onCommentSubmit: vi.fn(), locale: 'en' })],
    content: '<p>First paragraph</p>',
  });
  vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 0, right: 1, top: 0, bottom: 1 });
  try {
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      editor.commands.openCommentComposer();
    });
    const input = await screen.findByPlaceholderText('Add a comment…');
    input.focus();
    fireEvent.change(input, { target: { value: 'Thread root' } });

    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    fireEvent.keyDown(input, { key });
    expect(document.activeElement).toBe(editor.view.dom);
    expect(window.getSelection()?.toString()).toBe('First');

    reply.focus();
    act(() => { vi.advanceTimersToNextFrame(); });
    expect(document.activeElement).toBe(reply);
  } finally {
    await act(async () => { editor.destroy(); });
    vi.useRealTimers();
    reply.remove();
    mount.remove();
  }
});
