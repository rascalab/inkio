import { act, render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { commentThreadPopoverPluginKey, type CommentData } from '@inkio/advanced';
import { Editor } from '../components/Editor';

/**
 * Comment data lives in host state (docs recipe: `getComments` reads a Map
 * held in useState). Tiptap never re-applies extension options after
 * creation, so the editor must forward to the newest `getComments` and an
 * open thread popover must pick up new data without the host doing
 * anything beyond re-rendering.
 */
const CONTENT = '<p><span data-comment-id="t1">quoted</span> text</p>';

function thread(...texts: string[]): CommentData {
  return {
    id: 't1',
    resolved: false,
    messages: texts.map((text, index) => ({
      id: `m${index}`,
      author: 'Ada',
      text,
      createdAt: new Date(0),
    })),
  };
}

function Host({ threads, onCreate }: { threads: Map<string, CommentData>; onCreate: (e: TiptapEditor) => void }) {
  return (
    <Editor
      content={CONTENT}
      onCreate={onCreate}
      comment={{ getComments: (id) => threads.get(id) ?? null, onReply: () => {} }}
    />
  );
}

function openPopover(editor: TiptapEditor) {
  act(() => {
    editor.view.dispatch(
      editor.view.state.tr.setMeta(commentThreadPopoverPluginKey, { active: true, threadId: 't1' }),
    );
  });
}

describe('@inkio/editor comment data updates', () => {
  it('reads the newest getComments without recreating the editor', async () => {
    const instances: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => instances.push(editor);
    const { rerender } = render(<Host threads={new Map([['t1', thread('first')]])} onCreate={onCreate} />);
    await waitFor(() => expect(instances).toHaveLength(1));

    rerender(<Host threads={new Map([['t1', thread('first', 'second')]])} onCreate={onCreate} />);

    const comment = instances[0]!.extensionManager.extensions.find((ext) => ext.name === 'comment');
    expect(comment?.options.getThread?.('t1')?.messages).toHaveLength(2);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.isDestroyed).toBe(false);
  });

  it('refreshes an open popover when the host re-renders with new data', async () => {
    const instances: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => instances.push(editor);
    const { rerender } = render(<Host threads={new Map([['t1', thread('first')]])} onCreate={onCreate} />);
    await waitFor(() => expect(instances).toHaveLength(1));
    openPopover(instances[0]!);
    await waitFor(() => expect(document.body.textContent).toContain('first'));

    // No transaction, no manual notify: just the host's state update.
    rerender(<Host threads={new Map([['t1', thread('first', 'a reply')]])} onCreate={onCreate} />);
    await waitFor(() => expect(document.body.textContent).toContain('a reply'));
  });

  it('picks up threads mutated in place on the next transaction', async () => {
    const instances: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => instances.push(editor);
    const data = thread('first');
    render(<Host threads={new Map([['t1', data]])} onCreate={onCreate} />);
    await waitFor(() => expect(instances).toHaveLength(1));
    const editor = instances[0]!;
    openPopover(editor);
    await waitFor(() => expect(document.body.textContent).toContain('first'));

    data.messages.push({ id: 'm1', author: 'Ada', text: 'pushed in place', createdAt: new Date(0) });
    act(() => {
      editor.view.dispatch(editor.view.state.tr.setMeta('noop', true));
    });
    await waitFor(() => expect(document.body.textContent).toContain('pushed in place'));
  });
});
