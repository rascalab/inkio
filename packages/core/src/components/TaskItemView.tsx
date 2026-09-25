import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { memo } from 'react';
import { CheckIcon as DefaultCheckIcon } from '../icons';
import type { InkioIconComponent } from '../icons';

function TaskItemViewInner({ node, updateAttributes, extension, editor }: NodeViewProps) {
  const checked = node.attrs.checked as boolean;
  const CheckIcon: InkioIconComponent = extension.options.checkIcon || DefaultCheckIcon;

  const toggleChecked = () => {
    // Read-only surfaces (Viewer) render the state statically.
    if (!editor.isEditable) {
      return;
    }
    updateAttributes({ checked: !checked });
  };

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={checked}
      className="inkio-task-item"
    >
      <label className="inkio-task-checkbox" contentEditable={false}>
        <button
          type="button"
          className={`inkio-task-checkbox-btn${checked ? ' is-checked' : ''}`}
          onMouseDown={(e) => {
            // Prevent ProseMirror from intercepting the pointer event. The
            // toggle itself runs on click so keyboard (Enter/Space), touch,
            // and assistive tech activate it — mousedown alone never toggles.
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={toggleChecked}
        >
          {checked && <CheckIcon size={14} strokeWidth={2.5} />}
        </button>
      </label>
      <NodeViewContent as="div" className="inkio-task-content" />
    </NodeViewWrapper>
  );
}

// Same per-transaction re-invocation issue as CodeBlockView: ProseMirror
// keeps node identity for untouched subtrees, so bail out unless our node,
// selection, or the extension config changed. `updateAttributes`/`getPos`
// are excluded — tiptap rebinds them on every update.
export const TaskItemView = memo(
  TaskItemViewInner,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.editor === next.editor &&
    prev.extension === next.extension,
);
