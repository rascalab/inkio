import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { getCreateRoot } from './create-root';

type WritableStyle = Partial<
  Pick<
    CSSStyleDeclaration,
    'position' | 'zIndex' | 'top' | 'left' | 'display' | 'pointerEvents'
  >
>;

export interface OverlayHostOptions {
  /**
   * The editor's DOM node (usually `view.dom`). Used to mirror the `dark`
   * class from the nearest `.inkio` ancestor onto the host element.
   */
  editorDom?: Element | null;
  /** Host element class name. Defaults to `'inkio'`. */
  className?: string;
  /** Inline styles applied to the host element on creation. */
  style?: WritableStyle;
  /** Element the host is appended to. Defaults to `document.body`. */
  parent?: HTMLElement | null;
  /**
   * Human-readable name used in the error logged when the React root cannot
   * be created, e.g. `'comment composer'`. Defaults to `'overlay'`.
   */
  label?: string;
}

export interface OverlayHost {
  /** The host element the React root is mounted into. */
  readonly element: HTMLDivElement;
  /**
   * Render `node` into the host's React root. Calls made before the lazily
   * created root is ready are coalesced: only the latest node is rendered
   * once the root mounts. No-op after `destroy()`.
   */
  render(node: ReactNode): void;
  /**
   * Resolves `true` once the React root is mounted, or `false` if the host
   * was destroyed (or root creation failed) first.
   */
  ready(): Promise<boolean>;
  /** Whether the React root is mounted and the host is still alive. */
  isMounted(): boolean;
  /** Whether `destroy()` has been called. */
  isDestroyed(): boolean;
  /** Re-mirror the `dark` class from the editor's `.inkio` ancestor. */
  syncTheme(): void;
  /**
   * Tear down the host. Unmount + element removal are deferred to a
   * microtask so a host destroyed from inside a React render/commit (e.g. a
   * ProseMirror view update triggered by a React event) never unmounts a
   * root synchronously mid-render. Idempotent.
   */
  destroy(): void;
}

/**
 * Creates a detached-from-React DOM host for a popup rendered by a
 * ProseMirror plugin (or any imperative owner): creates the element, mirrors
 * the editor's dark theme, appends it, lazily creates a React root, guards
 * against resolving after destroy, cleans up on failure, and defers unmount.
 */
export function createOverlayHost(options: OverlayHostOptions = {}): OverlayHost {
  const {
    editorDom = null,
    className = 'inkio',
    style,
    parent,
    label = 'overlay',
  } = options;

  const element = document.createElement('div');
  element.className = className;
  if (style) {
    Object.assign(element.style, style);
  }

  const syncTheme = () => {
    const editorEl = editorDom?.closest('.inkio');
    if (editorEl) {
      element.classList.toggle('dark', editorEl.classList.contains('dark'));
    }
  };
  syncTheme();

  (parent ?? document.body).appendChild(element);

  let root: Root | null = null;
  let destroyed = false;
  let hasPending = false;
  let pendingNode: ReactNode = null;

  const readyPromise: Promise<boolean> = getCreateRoot().then(
    (createRootFn) => {
      // Generation guard: the host was torn down while react-dom loaded.
      if (destroyed) return false;
      root = createRootFn(element);
      if (hasPending) {
        hasPending = false;
        const node = pendingNode;
        pendingNode = null;
        root.render(node);
      }
      return true;
    },
    (error: unknown) => {
      // react-dom/client failed to load: do not leak an empty host element.
      console.error(`[inkio] ${label} failed to initialize:`, error);
      if (!destroyed) {
        destroyed = true;
        element.remove();
      }
      return false;
    },
  );

  return {
    element,
    render(node) {
      if (destroyed) return;
      if (root) {
        root.render(node);
        return;
      }
      hasPending = true;
      pendingNode = node;
    },
    ready: () => readyPromise,
    isMounted: () => !destroyed && root !== null,
    isDestroyed: () => destroyed,
    syncTheme,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hasPending = false;
      pendingNode = null;
      const rootToUnmount = root;
      root = null;
      queueMicrotask(() => {
        rootToUnmount?.unmount();
        element.remove();
      });
    },
  };
}
