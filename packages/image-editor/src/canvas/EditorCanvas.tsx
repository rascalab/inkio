import {
  startTransition,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/use-image-editor';
import { DesignLayer } from './DesignLayer';
import { TransformersLayer } from './TransformersLayer';
import { CropOverlay } from './CropOverlay';
import { SelectionActionsOverlay } from './SelectionActionsOverlay';
import type {
  Annotation,
  CropRect,
  FreeDrawAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  ArrowAnnotation,
  LineAnnotation,
  TextAnnotationData,
} from '../types';
import { normalizeRect, getTransformedDimensions, canvasSpaceToImageSpace, transformRect } from '../utils/geometry';
import { getDefaultCropRect } from '../utils/crop';
import { isTransformerInteraction } from '../utils/konva-targets';
import { TEXT_MIN_WIDTH } from '../utils/text-metrics';
import { clampNumber } from '../utils/math';

const PREVIEW_ZOOM_WHEEL_FACTOR = 1.12;
const CROP_ZOOM_MAX = 6;

const STAGE_SHELL_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

interface EditorCanvasProps {
  containerWidth: number;
  containerHeight: number;
  previewZoom: number;
  onPreviewZoomChange: (zoom: number) => void;
}

interface CropViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ann-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const cropPanStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const cropPendingSignatureRef = useRef<string | null>(null);
  const annotationsRef = useRef(state.annotations);
  annotationsRef.current = state.annotations;

  const [stageSize, setStageSize] = useState({ width: containerWidth, height: containerHeight });
  const [cropViewport, setCropViewport] = useState<CropViewportState>({ zoom: 1, panX: 0, panY: 0 });

  const isCropMode = state.activeTool === 'resize' || state.activeTool === 'crop';
  const renderedTransform = useMemo(
    () => (isCropMode ? { ...state.transform, crop: null } : state.transform),
    [isCropMode, state.transform],
  );

  const workingDimensions = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    renderedTransform,
    state.outputSize,
  );

  const cropSessionBounds = useMemo(() => {
    if (state.transform.crop) {
      return transformRect(
        state.transform.crop,
        state.originalWidth,
        state.originalHeight,
        state.transform.rotation,
        state.transform.flipX,
        state.transform.flipY,
      );
    }
    return {
      x: 0,
      y: 0,
      width: workingDimensions.width,
      height: workingDimensions.height,
    };
  }, [state.transform, state.originalWidth, state.originalHeight, workingDimensions]);

  const cropAspectRatio =
    state.cropOptions.aspectRatio
    ?? (state.pendingCrop && state.pendingCrop.height > 0
      ? state.pendingCrop.width / state.pendingCrop.height
      : cropSessionBounds.width > 0 && cropSessionBounds.height > 0
        ? cropSessionBounds.width / cropSessionBounds.height
        : 1);

  const cropFitScale =
    cropSessionBounds.width > 0 && cropSessionBounds.height > 0
      ? Math.min(stageSize.width / cropSessionBounds.width, stageSize.height / cropSessionBounds.height)
      : 1;

  const cropFitBounds = useMemo(
    () => ({
      x: (stageSize.width - cropSessionBounds.width * cropFitScale) / 2,
      y: (stageSize.height - cropSessionBounds.height * cropFitScale) / 2,
      width: cropSessionBounds.width * cropFitScale,
      height: cropSessionBounds.height * cropFitScale,
    }),
    [cropFitScale, cropSessionBounds, stageSize],
  );

  const cropFrame = useMemo(
    () => (isCropMode && stageSize.width > 0 && stageSize.height > 0
      ? getCropFrameRect(cropFitBounds, cropAspectRatio)
      : null),
    [cropAspectRatio, cropFitBounds, isCropMode, stageSize.height, stageSize.width],
  );

  const cropMinZoom = cropFrame
    ? Math.max(
      cropFrame.width / Math.max(1, cropSessionBounds.width * cropFitScale),
      cropFrame.height / Math.max(1, cropSessionBounds.height * cropFitScale),
      0.35,
    )
    : 1;

  const resolvedCropViewport = cropFrame
    ? clampCropViewport(cropViewport, cropFrame, cropSessionBounds, stageSize.width, stageSize.height, cropFitScale, cropMinZoom)
    : cropViewport;
  const scaleToFit = isCropMode
    ? cropFitScale * resolvedCropViewport.zoom
    : (
      workingDimensions.width > 0 && workingDimensions.height > 0
        ? Math.min(stageSize.width / workingDimensions.width, stageSize.height / workingDimensions.height)
        : 1
    ) * previewZoom;

  const displayBaseWidth = isCropMode ? cropSessionBounds.width : workingDimensions.width;
  const displayBaseHeight = isCropMode ? cropSessionBounds.height : workingDimensions.height;
  const displayWidth = displayBaseWidth * scaleToFit;
  const displayHeight = displayBaseHeight * scaleToFit;

  const centeredOffsetX = (stageSize.width - displayWidth) / 2;
  const centeredOffsetY = (stageSize.height - displayHeight) / 2;
  const offsetX = centeredOffsetX + (isCropMode ? resolvedCropViewport.panX : 0);
  const offsetY = centeredOffsetY + (isCropMode ? resolvedCropViewport.panY : 0);

  const annotationScale = scaleToFit;
  const cropX = isCropMode ? cropSessionBounds.x : (state.transform.crop?.x ?? 0);
  const cropY = isCropMode ? cropSessionBounds.y : (state.transform.crop?.y ?? 0);
  const visibleSelectedAnnotationId = isCropMode ? null : state.selectedAnnotationId;

  useEffect(() => {
    if (containerWidth > 0 && containerHeight > 0) {
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, [containerHeight, containerWidth]);

  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCropMode || !cropFrame || cropSessionBounds.width <= 0 || cropSessionBounds.height <= 0) {
      return;
    }

    const targetCrop = state.pendingCrop ?? getDefaultCropRect(
      cropSessionBounds.width,
      cropSessionBounds.height,
      state.cropOptions.aspectRatio,
    );
    const targetSignature = serializeCrop(targetCrop);
    if (cropPendingSignatureRef.current === targetSignature) {
      return;
    }

    cropPendingSignatureRef.current = targetSignature;

    setCropViewport((previous) => {
      const nextViewport = buildCropViewportFromCrop(
        cropSessionBounds,
        targetCrop,
        cropFrame,
        stageSize.width,
        stageSize.height,
        cropFitScale,
        cropMinZoom,
      );

      return areCropViewportsEqual(previous, nextViewport) ? previous : nextViewport;
    });
  }, [
    cropFitScale,
    cropFrame,
    cropMinZoom,
    cropSessionBounds.height,
    cropSessionBounds.width,
    cropSessionBounds.x,
    cropSessionBounds.y,
    isCropMode,
    stageSize.height,
    stageSize.width,
    state.cropOptions.aspectRatio,
    state.pendingCrop,
  ]);

  const updateCropViewport = useCallback((recipe: (previous: CropViewportState) => CropViewportState) => {
    setCropViewport((previous) => {
      if (!cropFrame) {
        return previous;
      }

      const next = clampCropViewport(
        recipe(previous),
        cropFrame,
        cropSessionBounds,
        stageSize.width,
        stageSize.height,
        cropFitScale,
        cropMinZoom,
      );

      return areCropViewportsEqual(previous, next) ? previous : next;
    });
  }, [
    cropFitScale,
    cropFrame,
    cropMinZoom,
    cropSessionBounds,
    stageSize.height,
    stageSize.width,
  ]);

  useEffect(() => {
    if (!isCropMode || !cropFrame) {
      return;
    }

    const nextCrop = getCropRectFromViewport(
      cropSessionBounds,
      cropFrame,
      stageSize.width,
      stageSize.height,
      cropFitScale,
      resolvedCropViewport,
    );
    const nextSignature = serializeCrop(nextCrop);
    if (cropPendingSignatureRef.current === nextSignature) {
      return;
    }

    cropPendingSignatureRef.current = nextSignature;
    const originalSpaceCrop = transformRect(
      nextCrop,
      state.originalWidth,
      state.originalHeight,
      state.transform.rotation,
      state.transform.flipX,
      state.transform.flipY,
      true, // inverse
    );
    dispatch({ type: 'SET_PENDING_CROP', crop: originalSpaceCrop });
  }, [
    cropFitScale,
    cropFrame,
    cropSessionBounds,
    dispatch,
    isCropMode,
    resolvedCropViewport,
    state.originalWidth,
    state.originalHeight,
    state.transform.rotation,
    state.transform.flipX,
    state.transform.flipY,
    stageSize.height,
    stageSize.width,
  ]);

  const zoomCropViewportAt = useCallback((factor: number, anchorX: number, anchorY: number) => {
    if (!cropFrame) {
      return;
    }

    updateCropViewport((previous) => {
      const current = clampCropViewport(
        previous,
        cropFrame,
        cropSessionBounds,
        stageSize.width,
        stageSize.height,
        cropFitScale,
        cropMinZoom,
      );

      const currentScale = cropFitScale * current.zoom;
      const currentDisplayWidth = cropSessionBounds.width * currentScale;
      const currentDisplayHeight = cropSessionBounds.height * currentScale;
      const currentLeft = ((stageSize.width - currentDisplayWidth) / 2) + current.panX;
      const currentTop = ((stageSize.height - currentDisplayHeight) / 2) + current.panY;
      const imageX = (anchorX - currentLeft) / currentScale;
      const imageY = (anchorY - currentTop) / currentScale;

      const nextZoom = clampNumber(current.zoom * factor, cropMinZoom, CROP_ZOOM_MAX);
      const nextScale = cropFitScale * nextZoom;
      const nextDisplayWidth = cropSessionBounds.width * nextScale;
      const nextDisplayHeight = cropSessionBounds.height * nextScale;
      const nextLeft = anchorX - (imageX * nextScale);
      const nextTop = anchorY - (imageY * nextScale);

      return {
        zoom: nextZoom,
        panX: nextLeft - ((stageSize.width - nextDisplayWidth) / 2),
        panY: nextTop - ((stageSize.height - nextDisplayHeight) / 2),
      };
    });
  }, [
    cropFitScale,
    cropFrame,
    cropMinZoom,
    cropSessionBounds.height,
    cropSessionBounds.width,
    stageSize.height,
    stageSize.width,
    updateCropViewport,
  ]);

  const clampStagePoint = useCallback(
    (pos: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(pos.x, displayWidth)),
      y: Math.max(0, Math.min(pos.y, displayHeight)),
    }),
    [displayHeight, displayWidth],
  );

  const toAnnotationPoint = useCallback(
    (pos: { x: number; y: number }) =>
      canvasSpaceToImageSpace(
        pos.x, pos.y,
        displayWidth, displayHeight,
        state.originalWidth, state.originalHeight,
        state.transform,
      ),
    [displayWidth, displayHeight, state.originalWidth, state.originalHeight, state.transform],
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
            const ann = annotationsRef.current.find((annotation) => annotation.id === currentId);
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
  }, [dispatch, state.activeTool, state.shapeOptions]);

  const finishDrawing = useCallback((pos: { x: number; y: number } | null) => {
    if (state.activeTool === 'text' && drawStartPos.current && pos) {
      const start = drawStartPos.current;
      const dragWidth = Math.abs(pos.x - start.x);
      const dragHeight = Math.abs(pos.y - start.y);
      const width = dragWidth > 10 ? Math.max(TEXT_MIN_WIDTH, dragWidth) : state.textOptions.width;
      const height = dragHeight > 10 ? Math.max(state.textOptions.height, dragHeight) : state.textOptions.height;
      const x = dragWidth > 10 ? Math.min(start.x, pos.x) : start.x;
      const y = dragHeight > 10 ? Math.min(start.y, pos.y) : start.y;

      const id = generateId();
      const annotation: TextAnnotationData = {
        id,
        type: 'text',
        x,
        y,
        text: '',
        fontSize: state.textOptions.fontSize,
        fontFamily: state.textOptions.fontFamily,
        fill: state.textOptions.color,
        fontStyle: state.textOptions.fontStyle,
        rotation: 0,
        width,
        height,
      };
      dispatch({ type: 'ADD_ANNOTATION', annotation });
      dispatch({ type: 'SELECT_ANNOTATION', id });
      dispatch({ type: 'SET_TOOL', tool: 'text', preserveSelection: true });

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
      const annotation = annotationsRef.current.find((item) => item.id === flushId);
      if (annotation?.type === 'freedraw') {
        dispatch({
          type: 'UPDATE_ANNOTATION',
          id: flushId,
          updates: { points: [...annotation.points, ...freedrawPoints.current] },
        });
      }
      freedrawPoints.current = [];
    }

    const id = currentAnnotationId.current;
    if (id) {
      const annotation = annotationsRef.current.find((item) => item.id === id);
      let tooSmall = false;
      if (annotation) {
        if (annotation.type === 'rect' && annotation.width < 3 && annotation.height < 3) tooSmall = true;
        if (annotation.type === 'ellipse' && annotation.radiusX < 2 && annotation.radiusY < 2) tooSmall = true;
      }

      if (tooSmall) {
        dispatch({ type: 'DELETE_ANNOTATION', id });
      } else {
        dispatch({ type: 'SELECT_ANNOTATION', id });
      }
    }

    currentAnnotationId.current = null;
    drawStartPos.current = null;
  }, [dispatch, state.activeTool, state.textOptions]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isCropMode) {
      const nativeEvent = e.evt;
      const clientX = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientX : nativeEvent.clientX;
      const clientY = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientY : nativeEvent.clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        cropPanStartRef.current = {
          clientX,
          clientY,
          panX: resolvedCropViewport.panX,
          panY: resolvedCropViewport.panY,
        };
      }
      return;
    }

    const { activeTool, shapeOptions, drawOptions } = state;

    if (!activeTool || activeTool === 'rotate') {
      if (e.target === e.target.getStage()) {
        dispatch({ type: 'SELECT_ANNOTATION', id: null });
      }
      return;
    }

    const clickedNode = e.target as Konva.Node;
    if (isTransformerInteraction(clickedNode)) {
      return;
    }
    const targetId = clickedNode.id?.() || clickedNode.parent?.id?.();
    if (targetId && state.annotations.some((annotation) => annotation.id === targetId)) return;

    if (state.selectedAnnotationId) {
      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      return;
    }

    const pos = getRelativePos(e);
    isDrawing.current = true;
    drawStartPos.current = pos;
    const id = generateId();
    currentAnnotationId.current = id;

    if (activeTool === 'text') {
      return;
    }

    if (activeTool === 'draw') {
      const annotation: FreeDrawAnnotation = {
        id,
        type: 'freedraw',
        points: [pos.x, pos.y],
        stroke: drawOptions.color,
        strokeWidth: drawOptions.strokeWidth,
        opacity: drawOptions.opacity,
      };
      dispatch({ type: 'ADD_ANNOTATION', annotation });
    } else if (activeTool === 'shape') {
      const { shapeType } = shapeOptions;
      if (shapeType === 'rect') {
        const annotation: RectAnnotation = {
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
        dispatch({ type: 'ADD_ANNOTATION', annotation });
      } else if (shapeType === 'ellipse') {
        const annotation: EllipseAnnotation = {
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
        dispatch({ type: 'ADD_ANNOTATION', annotation });
      } else if (shapeType === 'arrow') {
        const annotation: ArrowAnnotation = {
          id,
          type: 'arrow',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation });
      } else if (shapeType === 'line') {
        const annotation: LineAnnotation = {
          id,
          type: 'line',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: shapeOptions.stroke,
          strokeWidth: shapeOptions.strokeWidth,
        };
        dispatch({ type: 'ADD_ANNOTATION', annotation });
      }
    }
  }, [
    dispatch,
    getRelativePos,
    isCropMode,
    resolvedCropViewport.panX,
    resolvedCropViewport.panY,
    state,
  ]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isCropMode) {
      return;
    }

    updateDrawingPoint(getRelativePos(e));
  }, [getRelativePos, isCropMode, updateDrawingPoint]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isCropMode) {
      cropPanStartRef.current = null;
      return;
    }

    finishDrawing(getRelativePos(e));
  }, [finishDrawing, getRelativePos, isCropMode]);

  useEffect(() => {
    const handleDocumentMove = (event: MouseEvent | TouchEvent) => {
      if (cropPanStartRef.current && isCropMode) {
        const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
        if (typeof clientX !== 'number' || typeof clientY !== 'number') {
          return;
        }

        const cropStart = cropPanStartRef.current;
        updateCropViewport((previous) => ({
          zoom: previous.zoom,
          panX: cropStart.panX + (clientX - cropStart.clientX),
          panY: cropStart.panY + (clientY - cropStart.clientY),
        }));
        return;
      }

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
      if (cropPanStartRef.current) {
        cropPanStartRef.current = null;
      }

      if (!isDrawing.current || isCropMode) {
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
  }, [finishDrawing, getRelativePosFromClient, isCropMode, updateCropViewport, updateDrawingPoint]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isCropMode) {
      return;
    }

    if (e.target === stageRef.current) {
      dispatch({ type: 'SELECT_ANNOTATION', id: null });
    }
  }, [dispatch, isCropMode]);

  const handleSelectAnnotation = useCallback((id: string) => {
    dispatch({ type: 'SELECT_ANNOTATION', id });
  }, [dispatch]);

  const stageFrameStyle: CSSProperties = {
    position: 'absolute',
    left: `${offsetX}px`,
    top: `${offsetY}px`,
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
    cursor: isCropMode
      ? 'grab'
      : state.activeTool === 'draw' || state.activeTool === 'shape'
        ? 'crosshair'
        : state.activeTool === 'text'
          ? 'text'
          : 'default',
  };

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const factor = event.deltaY < 0 ? PREVIEW_ZOOM_WHEEL_FACTOR : 1 / PREVIEW_ZOOM_WHEEL_FACTOR;
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;

    if (isCropMode && cropFrame) {
      zoomCropViewportAt(factor, anchorX, anchorY);
      return;
    }

    startTransition(() => {
      onPreviewZoomChange(previewZoom * factor);
    });
  }, [cropFrame, isCropMode, onPreviewZoomChange, previewZoom, zoomCropViewportAt]);

  return (
    <div
      className="inkio-ie-canvas-workspace"
      data-testid="inkio-ie-canvas-workspace"
      style={{
        position: 'relative',
        width: stageSize.width,
        height: stageSize.height,
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
      onWheel={handleWheel}
    >
      <div className="inkio-ie-stage-shell" style={STAGE_SHELL_STYLE}>
        <div
          className="inkio-ie-stage-frame"
          style={stageFrameStyle}
          data-testid="inkio-ie-stage-frame"
          data-display-width={Math.round(displayWidth)}
          data-display-height={Math.round(displayHeight)}
        >
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
              state={{ ...state, transform: renderedTransform }}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              scale={scaleToFit}
              onSelectAnnotation={handleSelectAnnotation}
              onChangeAnnotation={(id, updates) =>
                dispatch({ type: 'UPDATE_ANNOTATION_COMMIT', id, updates: updates as Partial<Annotation> })
              }
            />
            <TransformersLayer
              selectedAnnotationId={visibleSelectedAnnotationId}
              stageRef={stageRef}
            />
          </Stage>
        </div>

        <SelectionActionsOverlay
          containerWidth={stageSize.width}
          containerHeight={stageSize.height}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          annotationScale={annotationScale}
          cropX={cropX}
          cropY={cropY}
          offsetX={offsetX}
          offsetY={offsetY}
          originalWidth={state.originalWidth}
        />

        {isCropMode && cropFrame && (
          <>
            <CropOverlay
              containerWidth={stageSize.width}
              containerHeight={stageSize.height}
              frame={cropFrame}
            />
            <div className="inkio-ie-sr-only" data-testid="inkio-ie-crop-viewport-zoom">
              {resolvedCropViewport.zoom.toFixed(4)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function serializeCrop(crop: CropRect): string {
  return [crop.x, crop.y, crop.width, crop.height].map((value) => value.toFixed(3)).join(':');
}

function getCropFrameRect(imageBounds: CropRect, aspectRatio: number): CropRect {
  const safePadding = Math.min(44, Math.min(imageBounds.width, imageBounds.height) * 0.08);
  const maxWidth = Math.max(40, imageBounds.width - (safePadding * 2));
  const maxHeight = Math.max(40, imageBounds.height - (safePadding * 2));
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    x: imageBounds.x + (imageBounds.width - width) / 2,
    y: imageBounds.y + (imageBounds.height - height) / 2,
    width,
    height,
  };
}

function clampCropViewport(
  viewport: CropViewportState,
  frame: CropRect,
  bounds: CropRect,
  stageWidth: number,
  stageHeight: number,
  fitScale: number,
  minZoom: number,
): CropViewportState {
  const zoom = clampNumber(viewport.zoom, minZoom, CROP_ZOOM_MAX);
  const scale = fitScale * zoom;
  const displayWidth = bounds.width * scale;
  const displayHeight = bounds.height * scale;
  const centeredLeft = (stageWidth - displayWidth) / 2;
  const centeredTop = (stageHeight - displayHeight) / 2;
  const minPanX = frame.x + frame.width - centeredLeft - displayWidth;
  const maxPanX = frame.x - centeredLeft;
  const minPanY = frame.y + frame.height - centeredTop - displayHeight;
  const maxPanY = frame.y - centeredTop;

  return {
    zoom,
    panX: displayWidth <= frame.width ? (minPanX + maxPanX) / 2 : clampNumber(viewport.panX, minPanX, maxPanX),
    panY: displayHeight <= frame.height ? (minPanY + maxPanY) / 2 : clampNumber(viewport.panY, minPanY, maxPanY),
  };
}

function buildCropViewportFromCrop(
  bounds: CropRect,
  crop: CropRect,
  frame: CropRect,
  stageWidth: number,
  stageHeight: number,
  fitScale: number,
  minZoom: number,
): CropViewportState {
  const rawScale = Math.max(frame.width / Math.max(crop.width, 1), frame.height / Math.max(crop.height, 1));
  const zoom = clampNumber(rawScale / fitScale, minZoom, CROP_ZOOM_MAX);
  const scale = fitScale * zoom;
  const displayWidth = bounds.width * scale;
  const displayHeight = bounds.height * scale;
  const imageLeft = frame.x - ((crop.x - bounds.x) * scale);
  const imageTop = frame.y - ((crop.y - bounds.y) * scale);

  return clampCropViewport(
    {
      zoom,
      panX: imageLeft - ((stageWidth - displayWidth) / 2),
      panY: imageTop - ((stageHeight - displayHeight) / 2),
    },
    frame,
    bounds,
    stageWidth,
    stageHeight,
    fitScale,
    minZoom,
  );
}

function getCropRectFromViewport(
  bounds: CropRect,
  frame: CropRect,
  stageWidth: number,
  stageHeight: number,
  fitScale: number,
  viewport: CropViewportState,
): CropRect {
  const scale = fitScale * viewport.zoom;
  const displayWidth = bounds.width * scale;
  const displayHeight = bounds.height * scale;
  const left = ((stageWidth - displayWidth) / 2) + viewport.panX;
  const top = ((stageHeight - displayHeight) / 2) + viewport.panY;
  const width = Math.min(bounds.width, frame.width / scale);
  const height = Math.min(bounds.height, frame.height / scale);

  return {
    x: clampNumber(bounds.x + ((frame.x - left) / scale), bounds.x, bounds.x + bounds.width - width),
    y: clampNumber(bounds.y + ((frame.y - top) / scale), bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

function areCropViewportsEqual(a: CropViewportState, b: CropViewportState): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 0.0001
    && Math.abs(a.panX - b.panX) < 0.01
    && Math.abs(a.panY - b.panY) < 0.01
  );
}
