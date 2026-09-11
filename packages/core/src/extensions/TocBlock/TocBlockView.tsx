import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { memo } from 'react';
import { useHeadings } from '../../components/useHeadings';

function TocBlockViewInner({ editor, node }: NodeViewProps) {
  const maxLevel = (node.attrs.maxLevel as number) || 3;
  const { filtered, minLevel, handleClick } = useHeadings(editor, maxLevel);

  if (filtered.length === 0) {
    return (
      <NodeViewWrapper className="inkio-toc-block" contentEditable={false} data-drag-handle="">
        <p className="inkio-toc-block-empty">Add headings to see the table of contents.</p>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="inkio-toc-block" contentEditable={false} data-drag-handle="">
      <ul className="inkio-toc-block-list">
        {filtered.map((heading, i) => (
          <li
            key={`${heading.id}-${i}`}
            className="inkio-toc-block-item"
            style={{ '--inkio-toc-depth': heading.level - minLevel } as React.CSSProperties}
          >
            <a
              href={`#${heading.id}`}
              className="inkio-toc-block-link"
              onClick={(e) => handleClick(e, i)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </NodeViewWrapper>
  );
}

// Same per-transaction re-invocation issue as CodeBlockView. Safe here:
// heading changes elsewhere flow through the internal useHeadings state,
// which still re-renders despite the memo (memo only skips parent-driven
// re-renders with unchanged props).
export const TocBlockView = memo(
  TocBlockViewInner,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.editor === next.editor &&
    prev.extension === next.extension,
);
