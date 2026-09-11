// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { CommentThreadPopover } from '../comment/components/CommentThreadPopover';

const baseProps = {
  threadId: 't1',
  quotedText: 'quoted',
  thread: {
    id: 't1',
    messages: [{ id: 'm1', author: 'Ada', text: 'hi', createdAt: new Date() }],
    resolved: false,
  },
  currentUser: 'Tester',
  onReply: vi.fn(),
  onResolve: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

describe('CommentThreadPopover frozen view', () => {
  it('renders messages with no actions when callbacks are omitted', () => {
    const { onReply, onResolve, onDelete, ...frozenProps } = baseProps;
    render(<CommentThreadPopover {...frozenProps} />);
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/reply/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /resolve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});

describe('CommentThreadPopover focus', () => {
  it('does not steal focus on mount by default', () => {
    render(<CommentThreadPopover {...baseProps} />);
    const input = screen.getByPlaceholderText(/reply/i);
    expect(document.activeElement).not.toBe(input);
  });

  it('focuses the reply field only when explicitly opted in', async () => {
    render(<CommentThreadPopover {...baseProps} autoFocusReply />);
    const input = screen.getByPlaceholderText(/reply/i);
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});
