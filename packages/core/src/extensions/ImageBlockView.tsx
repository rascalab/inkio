import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  Loader2Icon,
  PencilIcon,
} from '../icons';
import type { ImageEditorComponentProps } from './ImageBlock';

function parseWidthPercent(w: unknown): number {
  return parseFloat(String(w).replace('%', '')) || 100;
}

export function ImageBlockView(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor, extension } = props;
  const ImageEditorComponent = (extension?.options as any)?.imageEditor as React.ComponentType<ImageEditorComponentProps> | undefined;
  const isEditable = editor.isEditable;
  const imageRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(parseWidthPercent(node.attrs.width));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);

      const startX = e.clientX;
      const startWidth = imageRef.current ? imageRef.current.offsetWidth : 0;
      const parentWidth = imageRef.current?.parentElement?.offsetWidth || 1;
      let latestPercent = parseWidthPercent(node.attrs.width);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const diff = moveEvent.clientX - startX;
        const newPixelWidth = startWidth + diff;
        const newPercent = Math.min(100, Math.max(10, (newPixelWidth / parentWidth) * 100));
        latestPercent = newPercent;
        setCurrentWidth(newPercent);
      };

      const onMouseUp = () => {
        setResizing(false);
        updateAttributes({ width: `${latestPercent}%` });
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        cleanupRef.current = null;
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      cleanupRef.current = cleanup;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [node.attrs.width, updateAttributes],
  );

  useEffect(() => {
    setCurrentWidth(parseWidthPercent(node.attrs.width));
  }, [node.attrs.width]);

  const showControls = isEditable && (selected || isHovered || resizing);
  const align = node.attrs.align === 'left' ? 'left' : node.attrs.align === 'right' ? 'right' : 'center';

  return (
    <NodeViewWrapper
      style={{ textAlign: align }}
      onMouseEnter={() => isEditable && setIsHovered(true)}
      onMouseLeave={() => isEditable && setIsHovered(false)}
    >
      <div
        className={`inkio-image-block-container${isEditable && selected ? ' is-selected' : ''}`}
        style={{ width: `${currentWidth}%` }}
      >
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt}
          className="inkio-image-block-img"
        />

        {/* Resize Handle - Editor only, hidden when image editor is open */}
        {isEditable && !isEditorOpen && (
          <div
            className={`inkio-image-block-resize-handle${showControls ? ' is-visible' : ''}`}
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Caption */}
        {isEditable ? (
          <input
            type="text"
            placeholder="Write a caption..."
            className="inkio-image-block-caption"
            value={node.attrs.caption || ''}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        ) : node.attrs.caption ? (
          <div className="inkio-image-block-caption">{node.attrs.caption}</div>
        ) : null}

        {/* Floating Toolbar - Editor only, hidden when image editor is open */}
        {isEditable && !isEditorOpen && (
          <div className={`inkio-image-block-toolbar${showControls ? ' is-visible' : ''}`}>
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'left' })}
              className={`inkio-image-block-toolbar-btn${node.attrs.align === 'left' ? ' is-active' : ''}`}
              title="Align left"
            >
              <AlignLeftIcon size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'center' })}
              className={`inkio-image-block-toolbar-btn${node.attrs.align === 'center' ? ' is-active' : ''}`}
              title="Align center"
            >
              <AlignCenterIcon size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'right' })}
              className={`inkio-image-block-toolbar-btn${node.attrs.align === 'right' ? ' is-active' : ''}`}
              title="Align right"
            >
              <AlignRightIcon size={14} strokeWidth={1.8} />
            </button>
            <div className="inkio-image-block-toolbar-divider" />
            {ImageEditorComponent && (
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="inkio-image-block-toolbar-btn"
                title="Edit image"
                data-testid="inkio-image-block-edit"
              >
                <PencilIcon size={14} strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Editor Component - Editor only, Client-side only */}
      {ImageEditorComponent && isEditable && isMounted && isEditorOpen && (
        <Suspense
          fallback={
            <div className="inkio-image-block-editor-loading">
              <Loader2Icon size={20} className="inkio-image-block-editor-spinner" />
              <span>Loading...</span>
            </div>
          }
        >
          <ImageEditorComponent
            isOpen={isEditorOpen}
            imageSrc={node.attrs.src}
            onSave={(editedImageData: string) => {
              updateAttributes({ src: editedImageData });
              setIsEditorOpen(false);
            }}
            onClose={() => setIsEditorOpen(false)}
          />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
