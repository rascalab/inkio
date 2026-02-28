import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Check } from 'lucide-react';
import type { InkioIconComponent } from '../icons/registry';

export function TaskItemView({ node, updateAttributes, extension }: NodeViewProps) {
  const checked = node.attrs.checked as boolean;
  const CheckIcon: InkioIconComponent = extension.options.checkIcon || Check;

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
            // Prevent ProseMirror from intercepting the click event
            e.preventDefault();
            e.stopPropagation();
            updateAttributes({ checked: !checked });
          }}
        >
          {checked && <CheckIcon size={14} strokeWidth={2.5} />}
        </button>
      </label>
      <NodeViewContent as="div" className="inkio-task-content" />
    </NodeViewWrapper>
  );
}
