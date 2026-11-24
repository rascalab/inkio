import { Markdown } from '@inkio/core/markdown';
import { useInkioCollaborativeEditor, type UseInkioCollaborativeEditorOptions } from '../hooks';

// Typechecked, not mounted: collaboration installs its own extensions after the user's list.
export function useCollabRegistrationTypes(options: UseInkioCollaborativeEditorOptions) {
  const registered = useInkioCollaborativeEditor({ ...options, extensions: [Markdown.configure({})],
    onCreate(editor) { editor.markdown = 'Created'; },
    onChange(editor) { editor.markdown.toUpperCase(); },
  });
  if (registered.editor) registered.editor.markdown = 'Updated';
  const removed = Markdown.extend({ name: 'history' });
  const conflicted = useInkioCollaborativeEditor({ ...options, extensions: [removed] });
  // @ts-expect-error Collaboration excludes the history extension even if it is branded.
  conflicted.editor?.markdown;
}
