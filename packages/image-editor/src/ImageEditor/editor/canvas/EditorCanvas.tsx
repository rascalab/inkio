import { useRef, useCallback, useState, useEffect, type CSSProperties, type WheelEvent as ReactWheelEvent } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/useImageEditor';
import { DesignLayer } from './DesignLayer';
import { TextEditOverlay } from './TextEditOverlay';
import { TransformersLayer } from './TransformersLayer';
import { CropOverlay } from './CropOverlay';
import { AnnotationHtmlLayer } from './AnnotationHtmlLayer';
import { SelectedTextStylePopover } from './SelectedTextStylePopover';
import type { Annotation, FreeDrawAnnotation, RectAnnotation, EllipseAnnotation, ArrowAnnotation, LineAnnotation, TextAnnotationData } from '../types';
import { normalizeRect } from '../utils/geometry';
import { getTransformedDimensions } from '../utils/geometry';
import { getIEColors } from '../theme';

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ann-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface EditorCanvasProps {
  containerWidth: number;
  containerHeight: number;
  previewZoom: number;
  onPreviewZoomChange: (zoom: number) => void;
}

export function EditorCanvas({
  containerWidth,
  containerHeight,
  previewZoom,
  onPreviewZoomChange,
}: EditorCanvasProps) {
  const { state, dispatch } = useImageEditor();
  const stageRef = useRef<Konva.Stage>(null);

  const isDrawing = useRef(false);
  const currentAnnotationId = useRef<string | null>(null);
  const drawStartPos = useRef<{ x: number; y: number } | null>(null);
  const freedrawPoints = useRef<number[]>([]);
  const rafId = useRef<number>(0);
  // Keep a ref to latest annotations so the rAF callback doesn't read stale state
  const annotationsRef = useRef(state.annotations);
  annotationsRef.current = state.annotations;

  // Compute display dimensions
  const { width: imgW, height: imgH } = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );

  const [stageSize, setStageSize] = useState({ width: containerWidth, height: containerHeight });

  useEffect(() => {
    if (containerWidth > 0 && containerHeight > 0) {
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, [containerWidth, containerHeight]);

  // Cancel any pending rAF on unmount to avoid state updates on unmounted component
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Scale to fit
  const fitScale = imgW > 0 && imgH > 0
    ? Math.min(stageSize.width / imgW, stageSize.height / imgH, 1)
    : 1;
  const scaleToFit = fitScale * previewZoom;

  const displayWidth = imgW * scaleToFit;
  const displayHeight = imgH * scaleToFit;
  const cropX = state.transform.crop?.x ?? 0;
  const cropY = state.transform.crop?.y ?? 0;
  const sourceWidth = state.transform.crop?.width ?? state.originalWidth;
  const sourceHeight = state.transform.crop?.height ?? state.originalHeight;
  const annotationScale =
    imgW > 0 && sourceWidth > 0
      ? Math.min(imgW / sourceWidth, imgH / sourceHeight) * scaleToFit
      : scaleToFit;

  // Center the canvas
  const offsetX = (stageSize.width - displayWidth) / 2;
  const offsetY = (stageSize.height - displayHeight) / 2;

  const clampStagePoint = useCallback(
    (pos: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(pos.x, displayWidth)),
      y: Math.max(0, Math.min(pos.y, displayHeight)),
    }),
    [displayWidth, displayHeight],
  );

  const toAnnotationPoint = useCallback(
    (pos: { x: number; y: number }) => ({
      x: pos.x / scaleToFit,
      y: pos.y / scaleToFit,
    }),
    [scaleToFit],
  );

  const getRelativePos = useCallback((_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      ...toAnnotationPoint(clampStagePoint(pos)),
    };
  }, [clampStagePoint, toAnnotationPoint]);

  const getRelativePosFromClient = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return null;
    }

    const rect = stage.container().getBoundingClientRect();
    return toAnnotationPoint(
      clampStagePoint({
        x: clientX - rect.left,
        y: clientY - rect.top,
      }),
    );
  }, [clampStagePoint, toAnnotationPoint]);

  const updateDrawingPoint = useCallback((pos: { x: number; y: number }) => {
    if (!isDrawing.current || !currentAnnotationId.current || !drawStartPos.current) return;
    const id = currentAnnotationId.current;
    const { activeTool, shapeOptions } = state;

    if (activeTool === 'draw') {
      freedrawPoints.current.push(pos.x, pos.y);
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          const currentId = currentAnnotationId.current;
          if (currentId) {
            const ann = annotationsRef.current.find((a) => a.id === currentId);
            if (ann?.type === 'freedraw') {
              dispatch({
                type: 'UPDATE_ANNOTATION',
                id: currentId,
                updates: { points: [...ann.points, ...freedrawPoints.current] },
              });
              freedrawPoints.current = [];
            }
          }
          rafId.current = 0;
        });
      }
      return;
    }

    if (activeTool === 'shape') {
      const start = drawStartPos.current;
      const { shapeType } = shapeOptions;
      if (shapeType === 'rect') {
        const normalized = normalizeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
        dispatch({ type: 'UPDATE_ANNOTATION', id, updates: normalized });
      } else if (shapeType === 'ellipse') {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          id,
          updates: {
            x: (start.x + pos.x) / 2,
            y: (start.y + pos.y) / 2,
            radiusX: Math.abs(pos.x - start.x) / 2,
            radiusY: Math.abs(pos.y - start.y) / 2,
          },
        });
      } else if (shapeType === 'arrow' || shapeType === 'line') {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          id,
          updates: { points: [start.x, start.y, pos.x, pos.y] },
        });
      }
    }
  }, [dispatch, state]);

  const finishDrawing = useCallback((pos: { x: number; y: number } | null) => {
    if (state.editingTextId !== null) return;

    if (state.activeTool === 'text' && drawStartPos.current && pos) {
      const start = drawStartPos.current;
      const dragWidth = Math.abs(pos.x - start.x);
      const width = dragWidth > 10 ? dragWidth : 120;
      const x = dragWidth > 10 ? Math.min(start.x, pos.x) : start.x;
      const y = dragWidth > 10 ? Math.min(start.y, pos.y) : start.y;

      const id = generateId();
      const ann: TextAnnotationData = {
        id,
        type: 'text',
        x,
        y,
        text: '',
        fontSize: state.textOptions.fontSize,
        fill: state.textOptions.color,
        fontStyle: state.textOptions.fontStyle,
        rotation: 0,
        width,
      };
      dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
      dispatch({ type: 'SELECT_ANNOTATION', id });
      dispatch({ type: 'SET_EDITING_TEXT', id });

      isDrawing.current = false;
      currentAnnotationId.current = null;
      drawStartPos.current = null;
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    if (freedrawPoints.current.length > 0 && currentAnnotationId.current) {
      const flushId = currentAnnotationId.current;
      const ann = annotationsRef.current.find((a) => a.id === flushId);
      if (ann?.type === 'freedraw') {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          id: flushId,
          updates: { points: [...ann.points, ...freedrawPoints.current] },
        });
      }
      freedrawPoints.current = [];
    }

    const id = currentAnnotationId.current;
    if (id) {
      const ann = annotationsRef.current.find((a) => a.id === id);
      if (ann) {
        let tooSmall = false;
        if (ann.type === 'rect' && ann.width < 3 && ann.height < 3) tooSmall = true;
        if (ann.type === 'ellipse' && ann.radiusX < 2 && ann.radiusY < 2) tooSmall = true;
        if (tooSmall) dispatch({ type: 'DELETE_ANNOTATION', id });
      }
    }

    currentAnnotationId.current = null;
    drawStartPos.current = null;
  }, [dispatch, state.activeTool, state.editingTextId, state.textOptions]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (state.editingTextId !== null) return;
    const { activeTool, shapeOptions, drawOptions } = state;

    // If clicking on empty area in non-drawing mode, deselect
    if (!activeTool || activeTool === 'rotate' || activeTool === 'resize' || activeTool === 'crop') {
      if (e.target === e.target.getStage() || e.target.getLayer()?.name() === 'crop') return;
      if (activeTool !== 'crop') dispatch({ type: 'SELECT_ANNOTATION', id: null });
      return;
    }

    // If clicking on existing annotation, let it handle selection/edit
    const clickedNode = e.target as Konva.Node;
    const targetId = clickedNode.id?.() || clickedNode.parent?.id?.();
    if (targetId && state.annotations.some((a) => a.id === targetId)) return;

    const pos = getRelativePos(e);
    isDrawing.current = true;
    drawStartPos.current = pos;
    const id = generateId();
    currentAnnotationId.current = id;

    if (activeTool === 'text') {
      // Don't create immediately — wait for mouseUp to determine final size
      return;
    }

    if (activeTool === 'draw') {
      const ann: FreeDrawAnnotation = {
        id,
        type: 'freedraw',
        points: [pos.x, pos.y],
        stroke: drawOptions.color,
        strokeWidth: drawOptions.strokeWidth,
        opacity: drawOptions.opacity,
      };
      dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
    } else if (activeTool === 'shape') {
      const { shapeType } = shapeOptions;
      if (shapeType === 'rect') {
        const ann: RectAnnotation = {
          id,
          type: 'rect',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          fill: shapeOptions.fill,
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
          rotation: 0,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
      } else if (shapeType === 'ellipse') {
        const ann: EllipseAnnotation = {
          id,
          type: 'ellipse',
          x: pos.x,
          y: pos.y,
          radiusX: 0,
          radiusY: 0,
          fill: shapeOptions.fill,
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
          rotation: 0,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
      } else if (shapeType === 'arrow') {
        const ann: ArrowAnnotation = {
          id,
          type: 'arrow',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
      } else if (shapeType === 'line') {
        const ann: LineAnnotation = {
          id,
          type: 'line',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation: ann });
      }
    }
  }, [state, dispatch, getRelativePos]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    updateDrawingPoint(getRelativePos(e));
  }, [getRelativePos, updateDrawingPoint]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    finishDrawing(getRelativePos(e));
  }, [finishDrawing, getRelativePos]);

  useEffect(() => {
    const handleDocumentMove = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) {
        return;
      }

      const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') {
        return;
      }

      const pos = getRelativePosFromClient(clientX, clientY);
      if (!pos) {
        return;
      }

      updateDrawingPoint(pos);
    };

    const handleDocumentUp = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) {
        return;
      }

      const changedTouch = 'changedTouches' in event ? event.changedTouches[0] : undefined;
      const clientX = changedTouch?.clientX ?? ('clientX' in event ? event.clientX : undefined);
      const clientY = changedTouch?.clientY ?? ('clientY' in event ? event.clientY : undefined);
      const pos =
        typeof clientX === 'number' && typeof clientY === 'number'
          ? getRelativePosFromClient(clientX, clientY)
          : null;

      finishDrawing(pos);
    };

    document.addEventListener('mousemove', handleDocumentMove);
    document.addEventListener('mouseup', handleDocumentUp);
    document.addEventListener('touchmove', handleDocumentMove);
    document.addEventListener('touchend', handleDocumentUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMove);
      document.removeEventListener('mouseup', handleDocumentUp);
      document.removeEventListener('touchmove', handleDocumentMove);
      document.removeEventListener('touchend', handleDocumentUp);
    };
  }, [finishDrawing, getRelativePosFromClient, updateDrawingPoint]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (state.editingTextId !== null) {
      return;
    }

    if (e.target === stageRef.current) {
      dispatch({ type: 'SELECT_ANNOTATION', id: null });
    }
  }, [dispatch, state.editingTextId]);

  const canvasStyle: CSSProperties = {
    position: 'absolute',
    left: `${offsetX}px`,
    top: `${offsetY}px`,
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
    cursor: state.activeTool === 'draw' || state.activeTool === 'shape'
      ? 'crosshair'
      : state.activeTool === 'text'
        ? 'text'
        : 'default',
  };

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    onPreviewZoomChange(previewZoom * delta);
  }, [onPreviewZoomChange, previewZoom]);

  return (
    <div
      className="inkio-ie-canvas-workspace"
      style={{
        position: 'relative',
        width: stageSize.width,
        height: stageSize.height,
        overflow: 'hidden',
        backgroundColor: getIEColors().canvasBg,
      }}
      onWheel={handleWheel}
    >
      <div className="inkio-ie-stage-shell" style={canvasStyle}>
        <div className="inkio-ie-stage-frame">
          <div className="inkio-ie-stage-checkerboard" />
          <Stage
            ref={stageRef}
            width={displayWidth}
            height={displayHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <DesignLayer
              state={state}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              scale={scaleToFit}
              onSelectAnnotation={(id) => dispatch({ type: 'SELECT_ANNOTATION', id })}
              onStartTextEdit={(id) => dispatch({ type: 'SET_EDITING_TEXT', id })}
              onChangeAnnotation={(id, updates) =>
                dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id, updates: updates as Partial<Annotation> })
              }
            />
            {state.activeTool === 'crop' && (
              <CropOverlay
                displayWidth={displayWidth}
                displayHeight={displayHeight}
                pendingCrop={state.pendingCrop}
                scale={scaleToFit}
                aspectRatio={state.cropOptions.aspectRatio}
                onCropChange={(crop) => dispatch({ type: 'SET_PENDING_CROP', crop })}
              />
            )}
            <TransformersLayer
              selectedAnnotationId={state.selectedAnnotationId}
              stageRef={stageRef}
            />
          </Stage>
          <AnnotationHtmlLayer
            displayWidth={displayWidth}
            displayHeight={displayHeight}
            annotationScale={annotationScale}
            cropX={cropX}
            cropY={cropY}
            rotation={state.transform.rotation}
            flipX={state.transform.flipX}
            flipY={state.transform.flipY}
          >
            <TextEditOverlay annotationScale={annotationScale} />
          </AnnotationHtmlLayer>
          <SelectedTextStylePopover stageRef={stageRef} />
        </div>
      </div>
    </div>
  );
};
