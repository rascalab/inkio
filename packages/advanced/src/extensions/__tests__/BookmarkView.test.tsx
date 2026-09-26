// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BookmarkView } from '../BookmarkView';

// NodeViewWrapper only provides editor drag/selection context for real
// tiptap mounts; it contributes nothing to the resolve effect under test.
vi.mock('@tiptap/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tiptap/react')>()),
  NodeViewWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function Harness({ calls }: { calls: string[] }) {
  const [attrs, setAttrs] = useState<Record<string, unknown>>({ url: 'https://x.test' });
  return (
      <BookmarkView
        node={{ attrs } as never}
        selected={false}
        editor={{} as never}
        extension={{
          options: {
            onResolveBookmark: (url: string) => {
              calls.push(url);
              return Promise.resolve({ title: '' });
            },
          },
        } as never}
        updateAttributes={(next: Record<string, string | null>) =>
          setAttrs((current) => ({ ...current, ...next }))
        }
        getPos={() => 0}
      />
  );
}

describe('BookmarkView empty preview', () => {
  it('resolves an empty preview exactly once instead of refetching', async () => {
    const calls: string[] = [];
    const { unmount } = render(<Harness calls={calls} />);
    try {
      // One tight fetch→write→rerender loop finishes in milliseconds; 300ms
      // gives the old code ample room to refetch, while the fixed code can
      // never issue a second call (guarded synchronously).
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      expect(calls).toEqual(['https://x.test']);
    } finally {
      unmount();
    }
  });
});
