import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
  useId,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { Stage } from 'react-konva';
import { createId } from '@inkio/core';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/use-image-editor';
import { DesignLayer } from './DesignLayer';
import { TransformersLayer } from './TransformersLayer';
import { CropOverlay } from './CropOverlay';
import { SelectionActionsOverlay } from './SelectionActionsOverlay';
import { CanvasTextEditor } from './CanvasTextEditor';
import type { Annotation, CropRect, ImageEditorLocale, ImageEditorState, TextAnnotationData } from '../types';
import { DEFAULT_STICKER_SIZE } from '../constants';
import {
  normalizeRect,
  getAnnotationScale,
  getTransformedDimensions,
  canvasSpaceToImageSpace,
  clampToRect,
  transformRect,
} from '../utils/geometry';
import { isTransformerInteraction } from '../utils/konva-targets';
import { TEXT_MIN_WIDTH } from '../utils/text-metrics';
import { clampNumber } from '../utils/math';
import { getPreviewScale } from '../utils/raster-limits';

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
  onPreviewZoomFactor: (factor: number) => void;
  onCropScaleChange: (control: CropScaleControl | null) => void;
}

export interface CropScaleControl {
  value: number;
  min: number;
  max: number;
  set: (value: number) => void;
}

interface CropViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

const REST_OFFSET = { x: 0, y: 0 };
const CROP_RETURN_MS = 180;
const MAX_CROP_OVERSCROLL = 20;

const generateId = () => createId('ann');

export function EditorCanvas({
  containerWidth,
  containerHeight,
  previewZoom,
  onPreviewZoomFactor,
  onCropScaleChange,
}: EditorCanvasProps) {
  const { state, dispatch, locale } = useImageEditor();
  const stageRef = useRef<Konva.Stage>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();

  const isDrawing = useRef(false);
  const currentAnnotationId = useRef<string | null>(null);
  const drawStartPos = useRef<{ x: number; y: number } | null>(null);
  // Freedraw: points (image space) captured since the stroke started. They
  // are drawn imperatively on the live Konva Line and committed to the
  // reducer once on stroke end, so a stroke costs one annotation update
  // instead of an O(n) array copy + full canvas re-render per frame.
  const freedrawPoints = useRef<number[]>([]);
  const liveStrokeDisplayPoints = useRef<number[]>([]);
  const liveStrokeScale = useRef(1);
  const liveStrokeNode = useRef<Konva.Line | null>(null);
  // Shape/redact drags: latest geometry wins, flushed at most once per frame.
  const pendingShapeUpdate = useRef<{ id: string; updates: Partial<Annotation> } | null>(null);
  const rafId = useRef<number>(0);
  const cropPanStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
    elastic: boolean;
  } | null>(null);
  const cropReturnFrame = useRef(0);
  const cropOverscrollRef = useRef(REST_OFFSET);
  const [cropOverscroll, setCropOverscroll] = useState(REST_OFFSET);
  const releaseCrop = useCallback(() => {
    cropPanStartRef.current = null;
    if (cropReturnFrame.current) return;
    const from = cropOverscrollRef.current;
    if (from === REST_OFFSET) return;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = clampNumber((now - start) / CROP_RETURN_MS, 0, 1);
      const remaining = (1 - progress) ** 3;
      const next = progress < 1 ? { x: from.x * remaining, y: from.y * remaining } : REST_OFFSET;
      cropOverscrollRef.current = next;
      setCropOverscroll(next);
      cropReturnFrame.current = progress < 1 ? requestAnimationFrame(animate) : 0;
    };
    cropReturnFrame.current = requestAnimationFrame(animate);
  }, []);
  const annotationsRef = useRef(state.annotations);
  annotationsRef.current = state.annotations;

  const [stageSize, setStageSize] = useState({ width: containerWidth, height: containerHeight });
  const [cropViewport, setCropViewport] = useState<CropViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const [cropViewportProjection, setCropViewportProjection] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Drop pending drawing batches on unmount so the rAF callback never
  // dispatches into a torn-down editor session.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(cropReturnFrame.current);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      freedrawPoints.current = [];
      liveStrokeDisplayPoints.current = [];
      liveStrokeNode.current = null;
      pendingShapeUpdate.current = null;
      isDrawing.current = false;
    };
  }, []);

  const isCropMode = (state.activeTool === 'resize' || state.activeTool === 'crop')
    && state.pendingCrop !== null;
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

  // Crop gestures use the rotated full-image viewport. Persisted crop
  // rectangles remain in original-image coordinates in both directions.
  const cropSessionBounds = useMemo(
    () => ({
      x: 0, y: 0,
      ...getTransformedDimensions(
        state.originalWidth, state.originalHeight, { ...state.transform, crop: null }, null,
      ),
    }),
    [state.originalWidth, state.originalHeight, state.transform],
  );
  const sourceCrop = isCropMode ? state.pendingCrop : null;
  const { rotation, flipX, flipY } = state.transform;
  const targetCrop = useMemo(() => sourceCrop ? transformRect(
    sourceCrop, state.originalWidth, state.originalHeight, rotation, flipX, flipY,
  ) : null, [sourceCrop, state.originalWidth, state.originalHeight, rotation, flipX, flipY]);
  const targetCropSignature = sourceCrop ? serializeCrop(sourceCrop) : '';
  const cropAspectRatio = state.cropOptions.aspectRatio
    ?? (targetCrop && targetCrop.height > 0 ? targetCrop.width / targetCrop.height : 1);

  const cropFitScale =
    cropSessionBounds.width > 0 && cropSessionBounds.height > 0
      ? Math.min(stageSize.width / cropSessionBounds.width, stageSize.height / cropSessionBounds.height,
        getPreviewScale(cropSessionBounds.width, cropSessionBounds.height))
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

  // The largest inscribed aperture touches a fit edge, so any lower scale
  // would leave part of it uncovered. Keep the existing raster ceiling.
  const cropMaxZoom = cropFrame ? getCropZoomLimit(cropSessionBounds, cropFitScale) : 1;

  const projection = cropFrame && targetCrop
    ? [
      stageSize.width,
      stageSize.height,
      cropFitScale,
      cropMaxZoom,
      serializeCrop(cropSessionBounds),
      serializeCrop(cropFrame),
      serializeCrop(targetCrop),
    ].join('|')
    : null;

  // A crop is stored in image coordinates. Reproject it before committing a
  // render with new layout geometry, so the old viewport cannot overwrite it.
  if (projection !== cropViewportProjection) {
    setCropViewportProjection(projection);
    if (cropFrame && targetCrop) {
      const next = buildCropViewportFromCrop(
        cropSessionBounds, targetCrop, cropFrame,
        stageSize.width, stageSize.height, cropFitScale, cropMaxZoom,
      );
      setCropViewport(next);
    }
  }

  const resolvedCropViewport = cropFrame
    ? clampCropViewport(cropViewport, cropFrame, cropSessionBounds, stageSize.width, stageSize.height, cropFitScale, cropMaxZoom)
    : cropViewport;
  const scaleToFit = isCropMode
    ? cropFitScale * resolvedCropViewport.zoom
    : (
      workingDimensions.width > 0 && workingDimensions.height > 0
        ? Math.min(stageSize.width / workingDimensions.width, stageSize.height / workingDimensions.height,
          getPreviewScale(workingDimensions.width, workingDimensions.height))
        : 1
    ) * previewZoom;
  const displayScale = isCropMode ? scaleToFit : Math.min(scaleToFit,
    getPreviewScale(workingDimensions.width, workingDimensions.height));

  const displayBaseWidth = isCropMode ? cropSessionBounds.width : workingDimensions.width;
  const displayBaseHeight = isCropMode ? cropSessionBounds.height : workingDimensions.height;
  const displayWidth = displayBaseWidth * displayScale;
  const displayHeight = displayBaseHeight * displayScale;

  const centeredOffsetX = (stageSize.width - displayWidth) / 2;
  const centeredOffsetY = (stageSize.height - displayHeight) / 2;
  const offsetX = centeredOffsetX + (isCropMode ? resolvedCropViewport.panX + cropOverscroll.x : 0);
  const offsetY = centeredOffsetY + (isCropMode ? resolvedCropViewport.panY + cropOverscroll.y : 0);
  const cropAperture = useMemo(() => cropFrame
    ? { ...cropFrame, x: cropFrame.x - offsetX, y: cropFrame.y - offsetY }
    : undefined, [cropFrame, offsetX, offsetY]);

  // Same scale DesignLayer renders annotations with (used by the live
  // freedraw preview, which bypasses React while a stroke is in progress).
  const annotationScale = getAnnotationScale(
    renderedTransform,
    state.originalWidth,
    state.originalHeight,
    displayWidth,
    displayHeight,
  );
  const liveAnnotationScale = annotationScale.x;
  const editingAnnotation = state.annotations.find((annotation) => annotation.id === editingTextId);
  const editingText = !isCropMode && editingAnnotation?.type === 'text'
    && state.selectedAnnotationId === editingTextId ? editingAnnotation : null;
  const visibleSelectedAnnotationId = isCropMode ? null : state.selectedAnnotationId;

  useEffect(() => {
    if (containerWidth > 0 && containerHeight > 0) {
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, [containerHeight, containerWidth]);

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
        cropMaxZoom,
      );

      return areCropViewportsEqual(previous, next) ? previous : next;
    });
  }, [
    cropFitScale,
    cropFrame,
    cropMaxZoom,
    cropSessionBounds,
    stageSize.height,
    stageSize.width,
  ]);

  useEffect(() => {
    if (!isCropMode || !cropFrame) {
      return;
    }

    const viewportCrop = getCropRectFromViewport(
      cropSessionBounds,
      cropFrame,
      stageSize.width,
      stageSize.height,
      cropFitScale,
      resolvedCropViewport,
    );
    const nextCrop = transformRect(
      viewportCrop, state.originalWidth, state.originalHeight,
      state.transform.rotation, state.transform.flipX, state.transform.flipY, true,
    );
    const nextSignature = serializeCrop(nextCrop);
    if (targetCropSignature === nextSignature) {
      return;
    }

    dispatch({ type: 'SET_PENDING_CROP', crop: nextCrop });
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
    targetCropSignature,
  ]);

  const zoomCropViewportAt = useCallback((
    getZoom: (current: number) => number,
    anchorX: number,
    anchorY: number,
  ) => {
    const x = anchorX - stageSize.width / 2;
    const y = anchorY - stageSize.height / 2;
    updateCropViewport((previous) => {
      const zoom = clampNumber(getZoom(previous.zoom), 1, cropMaxZoom);
      if (previous.zoom === zoom) return previous;

      // Preserve the image point under the anchor as its distance from the
      // image center scales. Pan remains relative to the workspace center.
      const ratio = zoom / previous.zoom;
      return {
        zoom,
        panX: x - (x - previous.panX) * ratio,
        panY: y - (y - previous.panY) * ratio,
      };
    });
  }, [cropMaxZoom, stageSize.height, stageSize.width, updateCropViewport]);

  const setCropScale = useCallback((value: number) => {
    // The aperture is always centered in the workspace.
    zoomCropViewportAt(() => value, stageSize.width / 2, stageSize.height / 2);
  }, [stageSize.height, stageSize.width, zoomCropViewportAt]);

  const cropScaleValue = cropFrame ? resolvedCropViewport.zoom : null;
  useEffect(() => {
    onCropScaleChange(cropScaleValue === null
      ? null
      : { value: cropScaleValue, min: 1, max: cropMaxZoom, set: setCropScale });
  }, [cropMaxZoom, cropScaleValue, onCropScaleChange, setCropScale]);

  useEffect(() => () => onCropScaleChange(null), [onCropScaleChange]);

  const clampStagePoint = useCallback(
    (pos: { x: number; y: number }) =>
      clampToRect(pos.x, pos.y, { x: 0, y: 0, width: displayWidth, height: displayHeight }),
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

  // Konva-event path: reads the stage's tracked pointer (which also covers
  // touchend via changedTouches), unlike the document-listener path below.
  const getRelativePos = useCallback(() => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return toAnnotationPoint(clampStagePoint(pos));
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

  const resetDrawing = useCallback(() => {
    isDrawing.current = false;
    currentAnnotationId.current = null;
    drawStartPos.current = null;
  }, []);

  const flushShapeUpdate = useCallback(() => {
    const pending = pendingShapeUpdate.current;
    if (!pending) return null;
    pendingShapeUpdate.current = null;
    dispatch({ type: 'UPDATE_ANNOTATION', id: pending.id, updates: pending.updates });
    return pending;
  }, [dispatch]);

  // Latest-value batching: mousemove fires far more often than frames, and
  // every geometry is absolute (derived from the drag start), so only the
  // most recent one per frame needs to reach the reducer.
  const scheduleShapeUpdate = useCallback((id: string, updates: Partial<Annotation>) => {
    pendingShapeUpdate.current = { id, updates };
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        flushShapeUpdate();
      });
    }
  }, [flushShapeUpdate]);

  const updateDrawingPoint = useCallback((pos: { x: number; y: number }) => {
    if (!isDrawing.current || !currentAnnotationId.current || !drawStartPos.current) return;
    const id = currentAnnotationId.current;
    const { activeTool, shapeOptions } = state;

    if (activeTool === 'draw') {
      freedrawPoints.current.push(pos.x, pos.y);
      const scale = liveStrokeScale.current;
      liveStrokeDisplayPoints.current.push(pos.x * scale, pos.y * scale);

      // Draw the stroke imperatively on the mounted Konva Line (same array,
      // mutated in place; Konva re-reads it on each batched draw). The
      // reducer only sees the finished stroke (see finishDrawing).
      let node = liveStrokeNode.current;
      if (!node || node.id() !== id) {
        node = stageRef.current?.findOne<Konva.Line>((candidate: Konva.Node) => candidate.id() === id) ?? null;
        liveStrokeNode.current = node;
      }
      if (node) {
        node.points(liveStrokeDisplayPoints.current);
        node.getLayer()?.batchDraw();
      }
      return;
    }

    if (activeTool === 'redact') {
      const start = drawStartPos.current;
      scheduleShapeUpdate(id, normalizeRect(start.x, start.y, pos.x - start.x, pos.y - start.y));
      return;
    }

    if (activeTool === 'shape') {
      const start = drawStartPos.current;
      const { shapeType } = shapeOptions;
      if (shapeType === 'rect') {
        scheduleShapeUpdate(id, normalizeRect(start.x, start.y, pos.x - start.x, pos.y - start.y));
      } else if (shapeType === 'ellipse') {
        scheduleShapeUpdate(id, {
          x: (start.x + pos.x) / 2,
          y: (start.y + pos.y) / 2,
          radiusX: Math.abs(pos.x - start.x) / 2,
          radiusY: Math.abs(pos.y - start.y) / 2,
        });
      } else if (shapeType === 'arrow' || shapeType === 'line') {
        scheduleShapeUpdate(id, { points: [start.x, start.y, pos.x, pos.y] });
      }
    }
  }, [scheduleShapeUpdate, state.activeTool, state.shapeOptions]);

  const finishDrawing = useCallback((
    pos: { x: number; y: number } | null,
    origin = drawStartPos.current,
  ) => {
    if (state.activeTool === 'text' && origin && pos) {
      const start = origin;
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
      dispatch({ type: 'ADD_ANNOTATION', annotation, preview: true, select: true });
      setEditingTextId(id);

      resetDrawing();
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    // Commit the whole stroke and its preview creation as one undo step.
    if (freedrawPoints.current.length > 0 && currentAnnotationId.current) {
      const flushId = currentAnnotationId.current;
      const stroke = freedrawPoints.current;
      freedrawPoints.current = [];
      dispatch({ type: 'APPEND_ANNOTATION_POINTS', id: flushId, points: stroke });
    }
    liveStrokeDisplayPoints.current = [];
    liveStrokeNode.current = null;
    // Flush the last batched shape geometry so the final size is exact.
    const flushedShape = flushShapeUpdate();

    const id = currentAnnotationId.current;
    if (id) {
      const committed = annotationsRef.current.find((item) => item.id === id);
      // annotationsRef lags the flush above by one render: merge the
      // flushed geometry so the too-small check sees the final size.
      const annotation = committed && flushedShape?.id === id
        ? ({ ...committed, ...flushedShape.updates } as Annotation)
        : committed;
      let tooSmall = false;
      if (annotation) {
        if (annotation.type === 'rect' && annotation.width < 3 && annotation.height < 3) tooSmall = true;
        if (annotation.type === 'redact' && annotation.width < 3 && annotation.height < 3) tooSmall = true;
        if (annotation.type === 'ellipse' && annotation.radiusX < 2 && annotation.radiusY < 2) tooSmall = true;
      }

      if (tooSmall) {
        dispatch({ type: 'DELETE_ANNOTATION', id });
      } else {
        dispatch({ type: 'SELECT_ANNOTATION', id });
      }
    }

    resetDrawing();
  }, [dispatch, flushShapeUpdate, resetDrawing, state.activeTool, state.textOptions]);

  const placeSticker = useCallback((pos: { x: number; y: number }) => {
    dispatch({
      type: 'ADD_ANNOTATION',
      annotation: {
        id: generateId(), type: 'sticker', x: pos.x, y: pos.y,
        size: DEFAULT_STICKER_SIZE, emoji: state.stickerOptions.emoji, rotation: 0,
      },
      select: true,
    });
  }, [dispatch, state.stickerOptions.emoji]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isTransformerInteraction(e.target)) return;
    workspaceRef.current?.focus({ preventScroll: true });
    if (editingText) {
      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      return;
    }
    if (isCropMode) {
      const nativeEvent = e.evt;
      if (!('touches' in nativeEvent) && nativeEvent.button !== 0) return;
      const clientX = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientX : nativeEvent.clientX;
      const clientY = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientY : nativeEvent.clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        cancelAnimationFrame(cropReturnFrame.current);
        cropReturnFrame.current = 0;
        cropOverscrollRef.current = REST_OFFSET;
        setCropOverscroll(REST_OFFSET);
        cropPanStartRef.current = {
          clientX,
          clientY,
          panX: resolvedCropViewport.panX,
          panY: resolvedCropViewport.panY,
          elastic: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        };
      }
      return;
    }

    const { activeTool } = state;

    if (!activeTool || activeTool === 'rotate' || activeTool === 'filter') {
      if (e.target === e.target.getStage()) {
        dispatch({ type: 'SELECT_ANNOTATION', id: null });
      }
      return;
    }

    const clickedNode = e.target as Konva.Node;
    const targetId = clickedNode.id?.() || clickedNode.parent?.id?.();
    if (targetId && state.annotations.some((annotation) => annotation.id === targetId)) return;

    if (state.selectedAnnotationId) {
      dispatch({ type: 'SELECT_ANNOTATION', id: null });
      return;
    }

    // Resize can show the committed image after Apply, but is not a drawing tool.
    if (activeTool === 'resize' || activeTool === 'crop') return;
    const pos = getRelativePos();
    isDrawing.current = true;
    drawStartPos.current = pos;
    const id = generateId();
    currentAnnotationId.current = id;

    if (activeTool === 'text') {
      return;
    }

    if (activeTool === 'sticker') {
      placeSticker(pos);
      resetDrawing();
      return;
    }

    if (activeTool === 'draw') {
      freedrawPoints.current = [];
      liveStrokeScale.current = liveAnnotationScale;
      liveStrokeDisplayPoints.current = [pos.x * liveAnnotationScale, pos.y * liveAnnotationScale];
      liveStrokeNode.current = null;
    }
    dispatch({ type: 'ADD_ANNOTATION', annotation: createMark(activeTool, state, id, pos), preview: true });
  }, [
    dispatch,
    editingText,
    getRelativePos,
    isCropMode,
    liveAnnotationScale,
    resetDrawing,
    placeSticker,
    resolvedCropViewport.panX,
    resolvedCropViewport.panY,
    state,
  ]);

  const handleMouseMove = useCallback(() => {
    if (isCropMode) {
      return;
    }

    updateDrawingPoint(getRelativePos());
  }, [getRelativePos, isCropMode, updateDrawingPoint]);

  const handleMouseUp = useCallback(() => {
    if (isCropMode) return;

    finishDrawing(getRelativePos());
  }, [finishDrawing, getRelativePos, isCropMode]);

  useEffect(() => {
    const handleDocumentMove = (event: MouseEvent | TouchEvent) => {
      if (cropPanStartRef.current && cropFrame) {
        const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
        if (typeof clientX !== 'number' || typeof clientY !== 'number') {
          return;
        }

        const cropStart = cropPanStartRef.current;
        const panX = cropStart.panX + (clientX - cropStart.clientX);
        const panY = cropStart.panY + (clientY - cropStart.clientY);
        const bounded = clampCropViewport({ zoom: resolvedCropViewport.zoom, panX, panY }, cropFrame,
          cropSessionBounds, stageSize.width, stageSize.height, cropFitScale, cropMaxZoom);
        setCropViewport((previous) => areCropViewportsEqual(previous, bounded) ? previous : bounded);
        if (cropStart.elastic) {
          const dx = panX - bounded.panX;
          const dy = panY - bounded.panY;
          const next = dx || dy
            ? {
              x: (MAX_CROP_OVERSCROLL * dx) / (64 + Math.abs(dx)),
              y: (MAX_CROP_OVERSCROLL * dy) / (64 + Math.abs(dy)),
            }
            : REST_OFFSET;
          if (cropOverscrollRef.current.x !== next.x || cropOverscrollRef.current.y !== next.y) {
            cropOverscrollRef.current = next;
            setCropOverscroll(next);
          }
        }
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
      if (cropPanStartRef.current) releaseCrop();

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
    // Passive so page/panel scroll stays smooth on mobile: this handler never
    // calls preventDefault (see the non-passive workspace touchmove below
    // that only intercepts while actively drawing).
    document.addEventListener('touchmove', handleDocumentMove, { passive: true });
    document.addEventListener('touchend', handleDocumentUp);
    document.addEventListener('touchcancel', releaseCrop);
    window.addEventListener('blur', releaseCrop);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMove);
      document.removeEventListener('mouseup', handleDocumentUp);
      document.removeEventListener('touchmove', handleDocumentMove);
      document.removeEventListener('touchend', handleDocumentUp);
      document.removeEventListener('touchcancel', releaseCrop);
      window.removeEventListener('blur', releaseCrop);
    };
  }, [cropFitScale, cropFrame, cropMaxZoom, cropSessionBounds, finishDrawing, getRelativePosFromClient, isCropMode,
    releaseCrop, resolvedCropViewport.zoom, stageSize.height, stageSize.width, updateDrawingPoint]);

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

  // Stable reference so memo(DesignLayer) can skip re-renders when only
  // unrelated state (tool, zoom, selection) changes.
  const handleChangeAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    dispatch({ type: editingText?.id === id ? 'UPDATE_ANNOTATION' : 'UPDATE_ANNOTATION_COMMIT', id, updates });
  }, [dispatch, editingText?.id]);

  const isDrawGestureTool =
    state.activeTool === 'draw' || state.activeTool === 'shape' || state.activeTool === 'redact';

  const stageFrameStyle: CSSProperties = {
    position: 'absolute',
    left: `${offsetX}px`,
    top: `${offsetY}px`,
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
    // Drag-gesture tools take over touch; otherwise let the browser scroll.
    touchAction: isCropMode || isDrawGestureTool ? 'none' : 'pan-x pan-y',
    cursor: isCropMode
      ? 'grab'
      : state.activeTool === 'draw' || state.activeTool === 'shape'
        ? 'crosshair'
        : state.activeTool === 'text'
          ? 'text'
          : 'default',
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    const node = workspaceRef.current;
    if (!node || event.defaultPrevented || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    if (event.target instanceof Element
      && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      return;
    }

    const factor = event.deltaY < 0 ? PREVIEW_ZOOM_WHEEL_FACTOR : 1 / PREVIEW_ZOOM_WHEEL_FACTOR;
    const rect = node.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    // The raster can bleed under chrome, but the wheel gesture belongs only
    // to the workspace, not to the overflowing part of the stage.
    if (anchorX < 0 || anchorY < 0 || anchorX >= rect.width || anchorY >= rect.height) return;
    event.preventDefault();
    if (cropPanStartRef.current) return;

    if (isCropMode && cropFrame) {
      zoomCropViewportAt((zoom) => zoom * factor, anchorX, anchorY);
      return;
    }

    onPreviewZoomFactor(factor);
  }, [cropFrame, isCropMode, onPreviewZoomFactor, zoomCropViewportAt]);

  // Attach the wheel handler natively (non-passive) instead of via React's onWheel:
  // synthetic wheel events do not reliably reach handlers inside the dialog portal,
  // and a non-passive listener is required for preventDefault to suppress page scroll.
  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) {
      return;
    }

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Scroll-vs-draw branching for touch: intercept scrolling only while a
  // stroke is in progress so plain panel/page scroll stays native + smooth.
  // (The document-level touchmove above is passive and never intercepts.)
  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) {
      return;
    }

    const onTouchMove = (event: TouchEvent) => {
      if (isDrawing.current) {
        event.preventDefault();
      }
    };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove);
  }, []);

  const selected = state.annotations.find((annotation) => annotation.id === visibleSelectedAnnotationId);
  const handleCanvasKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
    const { key, shiftKey } = event;
    const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const dy = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    if (cropFrame) {
      if (!dx && !dy) return;
      event.preventDefault();
      if (shiftKey) {
        zoomCropViewportAt(
          (zoom) => (dx || -dy) > 0 ? zoom * PREVIEW_ZOOM_WHEEL_FACTOR : zoom / PREVIEW_ZOOM_WHEEL_FACTOR,
          cropFrame.x + cropFrame.width / 2, cropFrame.y + cropFrame.height / 2,
        );
      } else {
        updateCropViewport((previous) => ({
          ...previous, panX: previous.panX - dx * 10, panY: previous.panY - dy * 10,
        }));
      }
      return;
    }

    if (key === ' ' && state.annotations.length) {
      event.preventDefault();
      const index = selected ? state.annotations.indexOf(selected) : -1;
      const count = state.annotations.length;
      const next = index < 0 ? (shiftKey ? count - 1 : 0) : (index + count + (shiftKey ? -1 : 1)) % count;
      dispatch({ type: 'SELECT_ANNOTATION', id: state.annotations[next].id });
      return;
    }
    if ((dx || dy) && selected) {
      event.preventDefault();
      const from = toAnnotationPoint({ x: displayWidth / 2, y: displayHeight / 2 });
      const step = shiftKey ? 10 : 1;
      const to = toAnnotationPoint({ x: displayWidth / 2 + dx * step, y: displayHeight / 2 + dy * step });
      handleChangeAnnotation(selected.id, 'points' in selected
        ? { points: selected.points.map((value, index) => value + (index % 2 ? to.y - from.y : to.x - from.x)) }
        : { x: selected.x + to.x - from.x, y: selected.y + to.y - from.y });
      return;
    }
    if (key !== 'Enter') return;
    event.preventDefault();
    if (selected?.type === 'text' && !shiftKey) {
      setEditingTextId(selected.id);
      return;
    }
    const start = toAnnotationPoint({ x: displayWidth * 0.4, y: displayHeight * 0.4 });
    const end = toAnnotationPoint({ x: displayWidth * 0.6, y: displayHeight * 0.6 });
    switch (state.activeTool) {
      case 'text':
        finishDrawing(start, start);
        break;
      case 'sticker':
        placeSticker(start);
        break;
      case 'shape':
      case 'draw':
      case 'redact':
        dispatch({
          type: 'ADD_ANNOTATION',
          annotation: createMark(state.activeTool, state, generateId(), start, end),
          select: true,
        });
        break;
      case 'resize':
      case 'crop':
        dispatch({ type: 'START_RESIZE_SESSION' });
        break;
    }
  };

  return (
    <div
      ref={workspaceRef}
      className="inkio-ie-canvas-workspace"
      data-testid="inkio-ie-canvas-workspace"
      tabIndex={0}
      role="application"
      aria-label={locale.canvasLabel ?? 'Image canvas'}
      aria-describedby={instructionsId}
      onMouseDown={(event) => {
        if (editingText && stageRef.current?.findOne<Konva.Transformer>('Transformer')?.isTransforming()) {
          event.preventDefault();
        } else if (event.target === event.currentTarget
          || (event.target instanceof Element && event.target.matches('.inkio-ie-stage-shell, .inkio-ie-stage-frame'))) {
          event.currentTarget.focus({ preventScroll: true });
        }
      }}
      onKeyDown={handleCanvasKey}
      style={{
        position: 'relative',
        width: stageSize.width,
        height: stageSize.height,
        overflow: isCropMode ? 'visible' : 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      <span id={instructionsId} className="inkio-ie-sr-only">
        {cropFrame ? locale.cropKeyboardHelp : locale.canvasKeyboardHelp}
      </span>
      <span role="status" className="inkio-ie-sr-only">
        {targetCrop
          ? `${locale.cropArea}: ${Math.round(targetCrop.width)} × ${Math.round(targetCrop.height)} (${Math.round(targetCrop.x)}, ${Math.round(targetCrop.y)})`
          : selected && !editingText
            ? `${getAnnotationName(selected, locale)}, ${state.annotations.indexOf(selected) + 1} / ${state.annotations.length}`
            : null}
      </span>
      <div className="inkio-ie-stage-shell" style={STAGE_SHELL_STYLE}>
        <div
          className="inkio-ie-stage-frame"
          style={stageFrameStyle}
          data-testid="inkio-ie-stage-frame"
          data-display-width={Math.round(displayWidth)}
          data-display-height={Math.round(displayHeight)}
        >
          <div aria-hidden="true" className="inkio-ie-transparency-grid" style={cropAperture && {
            inset: 'auto',
            left: cropAperture.x,
            top: cropAperture.y,
            width: cropAperture.width,
            height: cropAperture.height,
          }} />
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
              transform={isCropMode ? renderedTransform : state.transform}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onSelectAnnotation={handleSelectAnnotation}
              interactive={!isCropMode}
              onChangeAnnotation={handleChangeAnnotation}
              editingTextId={editingText?.id}
              cropAperture={cropAperture}
              onEditText={setEditingTextId}
            />
            <TransformersLayer
              selectedAnnotationId={visibleSelectedAnnotationId}
              stageRef={stageRef}
            />
          </Stage>
          {editingText && (
            <CanvasTextEditor
              annotation={editingText}
              stage={stageRef.current}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onComplete={() => setEditingTextId(null)}
            />
          )}
        </div>

        {!editingText && !isCropMode && <SelectionActionsOverlay
          stage={stageRef.current}
          containerWidth={stageSize.width}
          containerHeight={stageSize.height}
          offsetX={offsetX}
          offsetY={offsetY}
        />}

        {isCropMode && cropFrame && (
          <>
            <CropOverlay frame={cropFrame} />
            <div className="inkio-ie-sr-only" data-testid="inkio-ie-crop-viewport-zoom" aria-hidden="true">
              {resolvedCropViewport.zoom.toFixed(4)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type MarkPoint = { x: number; y: number };

function createMark(
  tool: 'shape' | 'draw' | 'redact', state: ImageEditorState, id: string, start: MarkPoint, end?: MarkPoint,
): Annotation {
  const { x, y } = start;
  const dx = end ? end.x - x : 0;
  const dy = end ? end.y - y : 0;
  if (tool === 'draw') {
    const { color: stroke, strokeWidth, opacity } = state.drawOptions;
    return { id, type: 'freedraw', points: end ? [x, y, end.x, end.y] : [x, y], stroke, strokeWidth, opacity };
  }
  if (tool === 'redact') {
    const { mode, strength } = state.redactOptions;
    return { id, type: 'redact', ...normalizeRect(x, y, dx, dy), rotation: 0, mode, strength };
  }
  const { shapeType: type, stroke, strokeWidth, fill } = state.shapeOptions;
  if (type === 'rect') {
    return { id, type, ...normalizeRect(x, y, dx, dy), rotation: 0, fill, stroke, strokeWidth };
  }
  if (type === 'ellipse') {
    return {
      id, type, x: x + dx / 2, y: y + dy / 2, radiusX: Math.abs(dx) / 2, radiusY: Math.abs(dy) / 2,
      rotation: 0, fill, stroke, strokeWidth,
    };
  }
  return { id, type, points: [x, y, end?.x ?? x, end?.y ?? y], stroke, strokeWidth };
}

function getAnnotationName(annotation: Annotation, locale: ImageEditorLocale): string {
  switch (annotation.type) {
    case 'text': return `${locale.text}: ${annotation.text}`;
    case 'sticker': return `${locale.sticker}: ${annotation.emoji}`;
    case 'rect': return locale.rectangle;
    case 'freedraw': return locale.draw;
    default: return locale[annotation.type];
  }
}

function serializeCrop(crop: CropRect): string {
  return [crop.x, crop.y, crop.width, crop.height].map((value) => value.toFixed(3)).join(':');
}

function getCropFrameRect(imageBounds: CropRect, aspectRatio: number): CropRect {
  const maxWidth = imageBounds.width;
  const maxHeight = imageBounds.height;
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

function getCropZoomLimit(bounds: CropRect, fitScale: number): number {
  return Math.min(CROP_ZOOM_MAX, getPreviewScale(bounds.width, bounds.height) / fitScale);
}

function clampCropViewport(
  viewport: CropViewportState,
  frame: CropRect,
  bounds: CropRect,
  stageWidth: number,
  stageHeight: number,
  fitScale: number,
  maxZoom: number,
): CropViewportState {
  const zoom = clampNumber(viewport.zoom, 1, maxZoom);
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
  maxZoom: number,
): CropViewportState {
  const rawScale = Math.max(frame.width / Math.max(crop.width, 1), frame.height / Math.max(crop.height, 1));
  const zoom = clampNumber(rawScale / fitScale, 1, maxZoom);
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
    maxZoom,
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
