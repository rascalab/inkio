import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { useHeadings } from '../../components/useHeadings';

export function TocBlockView({ editor, node }: NodeViewProps) {
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
