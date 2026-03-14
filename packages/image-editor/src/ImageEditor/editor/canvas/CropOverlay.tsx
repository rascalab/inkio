import { useRef, useCallback, useEffect } from 'react';
import { Layer, Rect, Group } from 'react-konva';
import type Konva from 'konva';
import type { CropRect } from '../types';
import { getIEColors } from '../theme';

interface CropOverlayProps {
  displayWidth: number;
  displayHeight: number;
  pendingCrop: CropRect | null;
  scale: number;
  aspectRatio: number | null;
  onCropChange: (crop: CropRect) => void;
}

const HANDLE_SIZE = 8;
const MIN_CROP = 20;

type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'r' | 'b' | 'l';

export function CropOverlay({
  displayWidth,
  displayHeight,
  pendingCrop,
  scale,
  aspectRatio,
  onCropChange,
}: CropOverlayProps) {
  const colors = getIEColors();
  const dragRef = useRef<{
    id: HandleId | 'move';
    startX: number;
    startY: number;
    origCrop: CropRect;
  } | null>(null);

  const maxW = displayWidth / scale;
  const maxH = displayHeight / scale;

  const getDefaultCrop = (): CropRect => {
    if (aspectRatio) {
      const imgRatio = maxW / maxH;
      let w: number;
      let h: number;
      if (aspectRatio > imgRatio) {
        w = maxW * 0.8;
        h = w / aspectRatio;
      } else {
        h = maxH * 0.8;
        w = h * aspectRatio;
      }
      return {
        x: (maxW - w) / 2,
        y: (maxH - h) / 2,
        width: w,
        height: h,
      };
    }
    return {
      x: maxW * 0.1,
      y: maxH * 0.1,
      width: maxW * 0.8,
      height: maxH * 0.8,
    };
  };

  const crop = pendingCrop ?? getDefaultCrop();

  const cx = crop.x * scale;
  const cy = crop.y * scale;
  const cw = crop.width * scale;
  const ch = crop.height * scale;

  const clamp = useCallback(
    (c: CropRect): CropRect => {
      let { x, y, width, height } = c;
      width = Math.max(MIN_CROP, Math.min(width, maxW));
      height = Math.max(MIN_CROP, Math.min(height, maxH));
      x = Math.max(0, Math.min(x, maxW - width));
      y = Math.max(0, Math.min(y, maxH - height));
      return { x, y, width, height };
    },
    [scale, maxW, maxH],
  );

  const getPointer = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    return stage?.getPointerPosition() ?? null;
  };

  const startDrag = useCallback(
    (id: HandleId | 'move', e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      const pos = getPointer(e);
      if (!pos) return;
      stageRef.current = e.target.getStage();
      dragRef.current = { id, startX: pos.x, startY: pos.y, origCrop: { ...crop } };
    },
    [crop],
  );

  const onMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pos = getPointer(e);
      if (!pos) return;

      const dx = (pos.x - drag.startX) / scale;
      const dy = (pos.y - drag.startY) / scale;
      const o = drag.origCrop;
      let next: CropRect;

      if (drag.id === 'move') {
        next = { x: o.x + dx, y: o.y + dy, width: o.width, height: o.height };
        onCropChange(clamp(next));
        return;
      }

      // Calculate raw new crop based on handle
      let nx = o.x;
      let ny = o.y;
      let nw = o.width;
      let nh = o.height;

      const affectsLeft = drag.id === 'tl' || drag.id === 'bl' || drag.id === 'l';
      const affectsRight = drag.id === 'tr' || drag.id === 'br' || drag.id === 'r';
      const affectsTop = drag.id === 'tl' || drag.id === 'tr' || drag.id === 't';
      const affectsBottom = drag.id === 'bl' || drag.id === 'br' || drag.id === 'b';

      if (affectsLeft) {
        nx = o.x + dx;
        nw = o.width - dx;
      }
      if (affectsRight) {
        nw = o.width + dx;
      }
      if (affectsTop) {
        ny = o.y + dy;
        nh = o.height - dy;
      }
      if (affectsBottom) {
        nh = o.height + dy;
      }

      // Enforce minimum size
      if (nw < MIN_CROP) {
        if (affectsLeft) nx = o.x + o.width - MIN_CROP;
        nw = Math.max(MIN_CROP, nw);
      }
      if (nh < MIN_CROP) {
        if (affectsTop) ny = o.y + o.height - MIN_CROP;
        nh = Math.max(MIN_CROP, nh);
      }

      // Enforce aspect ratio
      if (aspectRatio) {
        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(drag.id);
        const isHorizontalEdge = drag.id === 't' || drag.id === 'b';

        if (isCorner || !isHorizontalEdge) {
          // Width drives height
          nh = nw / aspectRatio;
          if (affectsTop) {
            ny = o.y + o.height - nh;
          }
        } else {
          // Height drives width
          nw = nh * aspectRatio;
          // Center horizontally
          nx = o.x + (o.width - nw) / 2;
        }
      }

      next = clamp({ x: nx, y: ny, width: nw, height: nh });
      onCropChange(next);
    },
    [scale, aspectRatio, clamp, onCropChange],
  );

  const stageRef = useRef<Konva.Stage | null>(null);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Track mouse outside Stage so crop handles can be dragged to the image edge
  useEffect(() => {
    const onDocMove = (e: MouseEvent | TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || !stageRef.current) return;
      const container = stageRef.current.container().getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const px = Math.max(0, Math.min(clientX - container.left, displayWidth));
      const py = Math.max(0, Math.min(clientY - container.top, displayHeight));

      const dx = (px - drag.startX) / scale;
      const dy = (py - drag.startY) / scale;
      const o = drag.origCrop;
      let next: CropRect;

      if (drag.id === 'move') {
        next = { x: o.x + dx, y: o.y + dy, width: o.width, height: o.height };
        onCropChange(clamp(next));
        return;
      }

      let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
      const affectsLeft = drag.id === 'tl' || drag.id === 'bl' || drag.id === 'l';
      const affectsRight = drag.id === 'tr' || drag.id === 'br' || drag.id === 'r';
      const affectsTop = drag.id === 'tl' || drag.id === 'tr' || drag.id === 't';
      const affectsBottom = drag.id === 'bl' || drag.id === 'br' || drag.id === 'b';

      if (affectsLeft) { nx = o.x + dx; nw = o.width - dx; }
      if (affectsRight) { nw = o.width + dx; }
      if (affectsTop) { ny = o.y + dy; nh = o.height - dy; }
      if (affectsBottom) { nh = o.height + dy; }
      if (nw < MIN_CROP) { if (affectsLeft) nx = o.x + o.width - MIN_CROP; nw = Math.max(MIN_CROP, nw); }
      if (nh < MIN_CROP) { if (affectsTop) ny = o.y + o.height - MIN_CROP; nh = Math.max(MIN_CROP, nh); }

      if (aspectRatio) {
        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(drag.id);
        const isHorizontalEdge = drag.id === 't' || drag.id === 'b';
        if (isCorner || !isHorizontalEdge) {
          nh = nw / aspectRatio;
          if (affectsTop) ny = o.y + o.height - nh;
        } else {
          nw = nh * aspectRatio;
          nx = o.x + (o.width - nw) / 2;
        }
      }

      onCropChange(clamp({ x: nx, y: ny, width: nw, height: nh }));
    };

    const onDocUp = () => { dragRef.current = null; };

    document.addEventListener('mousemove', onDocMove);
    document.addEventListener('mouseup', onDocUp);
    document.addEventListener('touchmove', onDocMove);
    document.addEventListener('touchend', onDocUp);
    return () => {
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('mouseup', onDocUp);
      document.removeEventListener('touchmove', onDocMove);
      document.removeEventListener('touchend', onDocUp);
    };
  }, [displayWidth, displayHeight, scale, aspectRatio, clamp, onCropChange]);

  const handleStyle = (hx: number, hy: number, cursor: string) => ({
    x: hx - HANDLE_SIZE / 2,
    y: hy - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    fill: colors.handle,
    cornerRadius: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style: { cursor } as any,
  });

  const handles: { id: HandleId; x: number; y: number; cursor: string }[] = [
    { id: 'tl', x: cx, y: cy, cursor: 'nwse-resize' },
    { id: 'tr', x: cx + cw, y: cy, cursor: 'nesw-resize' },
    { id: 'bl', x: cx, y: cy + ch, cursor: 'nesw-resize' },
    { id: 'br', x: cx + cw, y: cy + ch, cursor: 'nwse-resize' },
    { id: 't', x: cx + cw / 2, y: cy, cursor: 'ns-resize' },
    { id: 'b', x: cx + cw / 2, y: cy + ch, cursor: 'ns-resize' },
    { id: 'l', x: cx, y: cy + ch / 2, cursor: 'ew-resize' },
    { id: 'r', x: cx + cw, y: cy + ch / 2, cursor: 'ew-resize' },
  ];

  return (
    <Layer
      name="crop"
      onMouseMove={onMove}
      onMouseUp={endDrag}
      onTouchMove={onMove}
      onTouchEnd={endDrag}
    >
      {/* Darkened overlay — four rects around the crop area */}
      <Rect x={0} y={0} width={displayWidth} height={cy} fill={colors.cropOverlay} />
      <Rect x={0} y={cy + ch} width={displayWidth} height={displayHeight - cy - ch} fill={colors.cropOverlay} />
      <Rect x={0} y={cy} width={cx} height={ch} fill={colors.cropOverlay} />
      <Rect x={cx + cw} y={cy} width={displayWidth - cx - cw} height={ch} fill={colors.cropOverlay} />

      {/* Crop rect border */}
      <Rect
        x={cx}
        y={cy}
        width={cw}
        height={ch}
        stroke={colors.handle}
        strokeWidth={1.5}
        dash={[6, 3]}
        fill="transparent"
      />

      {/* Rule of thirds guides */}
      {cw > 60 && ch > 60 && (
        <Group listening={false}>
          {[1, 2].map((i) => (
            <Rect
              key={`v${i}`}
              x={cx + (cw * i) / 3}
              y={cy}
              width={0.5}
              height={ch}
              fill={colors.handle}
              opacity={0.3}
            />
          ))}
          {[1, 2].map((i) => (
            <Rect
              key={`h${i}`}
              x={cx}
              y={cy + (ch * i) / 3}
              width={cw}
              height={0.5}
              fill={colors.handle}
              opacity={0.3}
            />
          ))}
        </Group>
      )}

      {/* Draggable center area for moving */}
      <Rect
        x={cx}
        y={cy}
        width={cw}
        height={ch}
        fill="transparent"
        onMouseDown={(e) => startDrag('move', e)}
        onTouchStart={(e) => startDrag('move', e)}
      />

      {/* Resize handles */}
      {handles.map((h) => (
        <Rect
          key={h.id}
          {...handleStyle(h.x, h.y, h.cursor)}
          onMouseDown={(e) => startDrag(h.id, e)}
          onTouchStart={(e) => startDrag(h.id, e)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = h.cursor;
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
        />
      ))}
    </Layer>
  );
}
