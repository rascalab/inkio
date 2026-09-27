import { describe, expect, it, vi } from 'vitest';
import { StrictMode, createElement, type ReactNode } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import {
  CollabPresence,
  createCollabProvider,
  useCollabProvider,
  useCollabStatus,
  useInkioCollaborativeEditor,
} from '../index';
import { WebSocket as NodeWebSocket } from 'ws';
import { onCleanup, startServer } from './helpers';

// jsdom swaps the global Event class, which Node's built-in WebSocket
// rejects when dispatching; the `ws` client is realm-agnostic. Unlike the
// browser, `ws` also emits an error for close-while-connecting (StrictMode's
// double mount), so give it a listener.
class TestWebSocket extends NodeWebSocket {
  constructor(...args: ConstructorParameters<typeof NodeWebSocket>) {
    super(...args);
    this.on('error', () => {});
  }
}
globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

// jsdom has no layout; ProseMirror's scroll-into-view on focus needs these.
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
Range.prototype.getClientRects ??= emptyRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
Element.prototype.getClientRects ??= emptyRects;

const BASE = [Document, Paragraph, Text];

function mountEditor(options: Parameters<typeof useInkioCollaborativeEditor>[0]) {
  const hook = renderHook((props) => useInkioCollaborativeEditor(props), { initialProps: options });
  onCleanup(hook.unmount);
  return hook;
}

describe('useInkioCollaborativeEditor', () => {
  it('syncs two editors and adds remote carets', async () => {
    const { url } = await startServer();
    const a = mountEditor({ docId: 'editors', url, extensions: BASE, user: { name: 'A', color: '#f00' } });
    const b = mountEditor({ docId: 'editors', url, extensions: BASE, user: { name: 'B', color: '#0f0' } });
    await waitFor(() => expect(a.result.current.status).toBe('synced'));
    await waitFor(() => expect(b.result.current.status).toBe('synced'));
    const names = a.result.current.editor!.extensionManager.extensions.map((ext) => ext.name);
    expect(names).toEqual(expect.arrayContaining(['collaboration', 'collaborationCaret']));
    act(() => {
      a.result.current.editor!.commands.setContent('<p>shared</p>');
    });
    await waitFor(() => expect(b.result.current.editor?.getHTML()).toBe('<p>shared</p>'));
    // Carets are only broadcast from a focused view, which needs a live DOM.
    const host = document.body.appendChild(a.result.current.editor!.view.dom);
    onCleanup(() => host.remove());
    act(() => {
      a.result.current.editor!.commands.focus();
      a.result.current.editor!.commands.setTextSelection(3);
    });
    await waitFor(() => {
      const label = b.result.current.editor!.view.dom.querySelector('.collaboration-carets__label');
      expect(label?.textContent).toBe('A');
    });
  });

  it('coalesces a burst of updates into one onUpdate with the latest doc', async () => {
    const { url } = await startServer();
    const onUpdate = vi.fn();
    const a = mountEditor({ docId: 'coalesce', url, extensions: BASE, onUpdate });
    await waitFor(() => expect(a.result.current.status).toBe('synced'));
    await act(async () => {
      await Promise.resolve();
    });
    onUpdate.mockClear();
    await act(async () => {
      const editor = a.result.current.editor!;
      editor.commands.setContent('<p>one</p>');
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' two');
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' three');
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onUpdate.mock.calls[0][0])).toContain('one two three');
  });

  it('never duplicates a seed when clients join at the same time', async () => {
    for (let round = 0; round < 5; round += 1) {
      const { url } = await startServer();
      const options = { docId: `seed-${round}`, url, extensions: BASE, content: '<p>seed</p>' };
      const a = mountEditor(options);
      const b = mountEditor(options);
      await waitFor(() => expect(a.result.current.editor?.getHTML()).toBe('<p>seed</p>'));
      await waitFor(() => expect(b.result.current.editor?.getHTML()).toBe('<p>seed</p>'));
    }
  });

  it('keeps the editor instance when a string token rotates', async () => {
    const { url } = await startServer();
    const hook = mountEditor({ docId: 'rotate', url, extensions: BASE, token: 'one' });
    await waitFor(() => expect(hook.result.current.status).toBe('synced'));
    const editor = hook.result.current.editor;
    hook.rerender({ docId: 'rotate', url, extensions: BASE, token: 'two' });
    expect(hook.result.current.editor).toBe(editor);
  });

  it('switches documents by rebuilding the provider', async () => {
    const { url } = await startServer();
    const hook = mountEditor({ docId: 'first', url, extensions: BASE });
    await waitFor(() => expect(hook.result.current.status).toBe('synced'));
    const first = hook.result.current.provider;
    hook.rerender({ docId: 'second', url, extensions: BASE });
    await waitFor(() => expect(hook.result.current.provider).not.toBe(first));
    expect(hook.result.current.provider?.configuration.name).toBe('second');
  });

  it('turns the editor read-only for a read-only scope', async () => {
    const { url } = await startServer({
      async onAuthenticate({ connectionConfig }) {
        connectionConfig.readOnly = true;
      },
    });
    const hook = mountEditor({ docId: 'readonly', url, extensions: BASE });
    await waitFor(() => expect(hook.result.current.readOnly).toBe(true));
    await waitFor(() => expect(hook.result.current.editor?.isEditable).toBe(false));
  });
});

describe('useCollabProvider', () => {
  it('reaches synced under StrictMode', async () => {
    const { url } = await startServer();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const hook = renderHook(() => useCollabStatus(useCollabProvider({ docId: 'strict', url })), { wrapper });
    onCleanup(hook.unmount);
    await waitFor(() => expect(hook.result.current).toBe('synced'));
  });
});

describe('CollabPresence', () => {
  it('lists remote users and renders nothing alone', async () => {
    const { url } = await startServer();
    const local = createCollabProvider({ docId: 'presence', url, user: { name: 'Me', color: '#000' } });
    onCleanup(() => local.destroy());
    const view = render(<CollabPresence provider={local} />);
    onCleanup(view.unmount);
    expect(view.container.innerHTML).toBe('');
    const remote = createCollabProvider({ docId: 'presence', url, user: { name: 'Ada', color: '#f00' } });
    onCleanup(() => remote.destroy());
    await waitFor(() => expect(view.getByTitle('Ada')).toBeTruthy());
    expect(render(<CollabPresence provider={null} />).container.innerHTML).toBe('');
  });
});
