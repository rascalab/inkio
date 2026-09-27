import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createRootSpy = vi.fn();
let failLoad = false;

vi.mock('../create-root', async () => {
  const actual = await vi.importActual<typeof import('react-dom/client')>('react-dom/client');
  return {
    getCreateRoot: () => {
      if (failLoad) return Promise.reject(new Error('load failed'));
      return Promise.resolve((container: Element) => {
        createRootSpy(container);
        return actual.createRoot(container);
      });
    },
  };
});

import { createOverlayHost } from '../overlay-host';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  createRootSpy.mockClear();
  failLoad = false;
  document.body.innerHTML = '';
});

describe('createOverlayHost', () => {
  it('appends a host with class/style to body and renders into it', async () => {
    const host = createOverlayHost({
      className: 'inkio custom',
      style: { position: 'fixed', zIndex: '7' },
    });
    expect(host.element.parentElement).toBe(document.body);
    expect(host.element.className).toBe('inkio custom');
    expect(host.element.style.position).toBe('fixed');
    expect(host.element.style.zIndex).toBe('7');

    // Render before ready is coalesced to the latest node.
    host.render(<span>first</span>);
    host.render(<span>second</span>);
    expect(host.isMounted()).toBe(false);

    await act(async () => {
      expect(await host.ready()).toBe(true);
    });
    expect(host.isMounted()).toBe(true);
    expect(host.element.textContent).toBe('second');

    await act(async () => {
      host.render(<span>third</span>);
    });
    expect(host.element.textContent).toBe('third');

    await act(async () => {
      host.destroy();
      await flushMicrotasks();
    });
  });

  it('appends to a custom parent', () => {
    const parent = document.createElement('section');
    document.body.appendChild(parent);
    const host = createOverlayHost({ parent });
    expect(host.element.parentElement).toBe(parent);
    host.destroy();
  });

  it('never mounts a root when destroyed before react-dom resolves (stale mount)', async () => {
    const host = createOverlayHost();
    host.render(<span>late</span>);
    host.destroy();

    expect(await host.ready()).toBe(false);
    expect(createRootSpy).not.toHaveBeenCalled();
    expect(host.isMounted()).toBe(false);
    expect(host.isDestroyed()).toBe(true);
    await flushMicrotasks();
    expect(host.element.isConnected).toBe(false);
  });

  it('mirrors the dark class from the editor .inkio ancestor and resyncs', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'inkio dark';
    const editorDom = document.createElement('div');
    wrapper.appendChild(editorDom);
    document.body.appendChild(wrapper);

    const host = createOverlayHost({ editorDom });
    expect(host.element.classList.contains('dark')).toBe(true);

    wrapper.classList.remove('dark');
    host.syncTheme();
    expect(host.element.classList.contains('dark')).toBe(false);
    host.destroy();
  });

  it('does not add dark without an .inkio ancestor', () => {
    const editorDom = document.createElement('div');
    document.body.appendChild(editorDom);
    const host = createOverlayHost({ editorDom });
    expect(host.element.classList.contains('dark')).toBe(false);
    host.destroy();
  });

  it('defers unmount and element removal to a microtask', async () => {
    const host = createOverlayHost();
    await act(async () => {
      host.render(<span>content</span>);
      await host.ready();
    });
    expect(host.element.textContent).toBe('content');

    await act(async () => {
      host.destroy();
      // Synchronously after destroy the element is still attached/populated.
      expect(host.element.isConnected).toBe(true);
      expect(host.element.textContent).toBe('content');
      await flushMicrotasks();
    });
    expect(host.element.isConnected).toBe(false);
    expect(host.element.textContent).toBe('');

    // Idempotent and inert after destroy.
    host.destroy();
    host.render(<span>ignored</span>);
    expect(host.element.textContent).toBe('');
  });

  it('removes the element when react-dom fails to load', async () => {
    failLoad = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createOverlayHost({ label: 'test popup' });
    expect(await host.ready()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      '[inkio] test popup failed to initialize:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
    expect(host.element.isConnected).toBe(false);
    expect(host.isDestroyed()).toBe(true);
  });
});
