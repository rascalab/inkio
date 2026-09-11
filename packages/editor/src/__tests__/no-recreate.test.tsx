import { render, waitFor } from '@testing-library/react';
import type { TiptapEditor } from '@inkio/core';
import { Editor } from '../components/Editor';

/**
 * Regression test for the setOptions storm: a parent that re-renders with
 * new-but-identical inline option literals must not destroy/recreate the
 * tiptap instance (extensions stay referentially stable via useStableOptions).
 */
describe('@inkio/editor instance stability', () => {
  it('keeps a single tiptap instance across inline-literal re-renders', async () => {
    const instances: TiptapEditor[] = [];
    const onCreate = (editor: TiptapEditor) => {
      instances.push(editor);
    };
    const { rerender } = render(
      <Editor
        initialContent="<p>hi</p>"
        onCreate={onCreate}
        imageBlock={{}}
      />,
    );
    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });

    rerender(
      <Editor
        initialContent="<p>hi</p>"
        onCreate={onCreate}
        imageBlock={{}}
      />,
    );
    rerender(
      <Editor
        initialContent="<p>hi</p>"
        onCreate={onCreate}
        imageBlock={{}}
      />,
    );

    expect(instances).toHaveLength(1);
    expect(instances[0]!.isDestroyed).toBe(false);
  });
});
