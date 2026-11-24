import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useId,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { Layer, Stage } from 'react-konva/lib/ReactKonvaCore.js';
import { createId } from '@inkio/core/ui';
import type Konva from 'konva';
import { useImageEditor } from '../hooks/use-image-editor';
import { DesignLayer } from './DesignLayer';
import { ImageNode } from './ImageNode';
import { TransformersLayer } from './TransformersLayer';
import { CropOverlay } from './CropOverlay';
import { SelectionActionsOverlay } from './SelectionActionsOverlay';
import { CanvasTextEditor } from './CanvasTextEditor';
import type { Annotation, ImageEditorLocale, ImageEditorState, TextAnnotationData } from '../types';
import { DEFAULT_STICKER_SIZE } from '../constants';
import {
  normalizeRect,
  getAnnotationScale,
  getTransformedDimensions,
  canvasSpaceToImageSpace,
  getBaseDisplayDimensions,
  clampToRect,
  transformRect,
} from '../utils/geometry';
import { isTransformerInteraction } from '../utils/konva-targets';
import { TEXT_MIN_WIDTH } from '../utils/text-metrics';
import { clampNumber } from '../utils/math';
import { getPreviewScale } from '../utils/raster-limits';
import {
  areSameCropViewport,
  areSameSourceCrop,
  clampCropViewport,
  planCropPlacement,
  projectSourceCrop,
  type CropGeometry,
  type CropPlacement,
  type CropViewport,
} from './crop-viewport';

const PREVIEW_ZOOM_WHEEL_FACTOR = 1.12;

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

const FIT_CROP_VIEWPORT: CropViewport = { zoom: 1, panX: 0, panY: 0 };

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
  const clearCropOverscroll = useCallback(() => {
    if (cropReturnFrame.current) {
      cancelAnimationFrame(cropReturnFrame.current);
      cropReturnFrame.current = 0;
    }
    if (cropOverscrollRef.current !== REST_OFFSET) {
      cropOverscrollRef.current = REST_OFFSET;
      setCropOverscroll(REST_OFFSET);
    }
  }, []);
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
  useLayoutEffect(() => {
    annotationsRef.current = state.annotations;
  }, [state.annotations]);

  const stageSize = useMemo(
    () => ({ width: containerWidth, height: containerHeight }),
    [containerWidth, containerHeight],
  );
  const [cropInteraction, setCropInteraction] = useState<CropPlacement | null>(null);
  const cropPlacementRef = useRef<CropPlacement | null>(null);
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

  const { rotation, flipX, flipY } = state.transform;
  const cropLayout = useMemo(() => ({
    image: state.originalImage,
    imageWidth: state.originalWidth,
    imageHeight: state.originalHeight,
    rotation,
    flipX,
    flipY,
    stageWidth: stageSize.width,
    stageHeight: stageSize.height,
  }), [state.originalImage, state.originalWidth, state.originalHeight, rotation, flipX, flipY,
    stageSize]);
  const sourceCrop = isCropMode ? state.pendingCrop : null;
  const targetCrop = useMemo(() => sourceCrop ? transformRect(
    sourceCrop, state.originalWidth, state.originalHeight, rotation, flipX, flipY,
  ) : null, [sourceCrop, state.originalWidth, state.originalHeight, rotation, flipX, flipY]);
  const cropPlacement = useMemo(() => {
    if (!sourceCrop) return null;
    // Keep the viewport that produced our own crop. Only a new source draft
    // or layout (including rotation, flip or preset) needs a forward projection.
    if (cropInteraction?.geometry.layout === cropLayout && areSameSourceCrop(cropInteraction.crop, sourceCrop)) {
      return cropInteraction;
    }
    return planCropPlacement(cropLayout, sourceCrop);
  }, [cropInteraction, cropLayout, sourceCrop]);
  const cropGeometry = cropPlacement?.geometry;
  const cropFrame = cropGeometry?.frame;
  const resolvedCropViewport = cropPlacement?.viewport ?? FIT_CROP_VIEWPORT;

  let displayScale: number;
  if (cropGeometry) {
    displayScale = cropGeometry.fitScale * resolvedCropViewport.zoom;
  } else {
    const rasterScale = getPreviewScale(workingDimensions.width, workingDimensions.height);
    const fitScale = workingDimensions.width > 0 && workingDimensions.height > 0
      ? Math.min(stageSize.width / workingDimensions.width, stageSize.height / workingDimensions.height, rasterScale)
      : 1;
    displayScale = Math.min(fitScale * previewZoom, rasterScale);
  }

  const displayBaseWidth = cropGeometry?.boundsWidth ?? workingDimensions.width;
  const displayBaseHeight = cropGeometry?.boundsHeight ?? workingDimensions.height;
  const displayWidth = displayBaseWidth * displayScale;
  const displayHeight = displayBaseHeight * displayScale;
  // Rotate the photo as one surface. Annotations keep an independent stage
  // in display coordinates so their pointer targets stay aligned.
  let rasterWidth = displayWidth;
  let rasterHeight = displayHeight;
  let rotationTransform: string | undefined;
  const rotating = state.activeTool === 'rotate' && displayWidth > 0 && displayHeight > 0;
  if (rotating) {
    const base = getBaseDisplayDimensions(workingDimensions.width, workingDimensions.height, rotation);
    const scale = Math.min(getPreviewScale(base.width, base.height),
      previewZoom * Math.max(stageSize.width, stageSize.height) / Math.max(base.width, base.height));
    rasterWidth = base.width * scale;
    rasterHeight = base.height * scale;
    const fit = displayScale / scale;
    rotationTransform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${flipX ? -fit : fit}, ${flipY ? -fit : fit})`;
  }
  const { originalImage, filter, finetune } = state;
  const { crop } = renderedTransform;
  const flat = useMemo(() => ({ rotation: 0, flipX: false, flipY: false, crop }), [crop]);
  const photoTransform = rotating ? flat : renderedTransform;
  const photo = useMemo(() => {
    if (!originalImage) return null;
    const node = <ImageNode image={originalImage} displayWidth={rasterWidth} displayHeight={rasterHeight}
      transform={photoTransform} filter={filter} finetune={finetune} />;
    return rotating ? <Stage width={rasterWidth} height={rasterHeight} listening={false}>
      <Layer listening={false}>{node}</Layer>
    </Stage> : node;
  }, [rotating, originalImage, rasterWidth, rasterHeight, photoTransform, filter, finetune]);

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

  const { updateCropViewport, zoomCropViewportAt, reprojectCropViewport } = useMemo(() => {
    function setCropScale(value: number) {
      zoomCropViewportAt(() => value);
    }

    function publishScale(placement: CropPlacement | null) {
      onCropScaleChange(placement ? {
        value: placement.viewport.zoom,
        min: 1,
        max: placement.geometry.maxZoom,
        set: setCropScale,
      } : null);
    }

    function commitCropViewport(placement: CropPlacement, viewport: CropViewport) {
      const crop = projectSourceCrop(placement.geometry, viewport);
      if (areSameSourceCrop(placement.crop, crop)) return;

      // The viewport, draft, dimensions and scale control advance together.
      // The ref also lets successive events accumulate before React renders.
      const next = { geometry: placement.geometry, viewport, crop };
      cropPlacementRef.current = next;
      setCropInteraction(next);
      dispatch({ type: 'SET_PENDING_CROP', crop });
      if (viewport.zoom !== placement.viewport.zoom) publishScale(next);
    }

    function updateCropViewport(recipe: (viewport: CropViewport, geometry: CropGeometry) => CropViewport) {
      const placement = cropPlacementRef.current;
      if (!placement) return null;
      const next = clampCropViewport(placement.geometry, recipe(placement.viewport, placement.geometry));
      if (!areSameCropViewport(placement.viewport, next)) commitCropViewport(placement, next);
      return next;
    }

    function zoomCropViewportAt(getZoom: (current: number) => number, anchorX?: number, anchorY?: number) {
      updateCropViewport((previous, { maxZoom, layout: { stageWidth, stageHeight } }) => {
        const zoom = clampNumber(getZoom(previous.zoom), 1, maxZoom);
        if (previous.zoom === zoom) return previous;

        // Preserve the point under the pointer (or aperture center for the
        // ruler and keyboard). Pan is relative to the workspace center.
        const x = (anchorX ?? stageWidth / 2) - stageWidth / 2;
        const y = (anchorY ?? stageHeight / 2) - stageHeight / 2;
        const ratio = zoom / previous.zoom;
        return {
          zoom,
          panX: x - (x - previous.panX) * ratio,
          panY: y - (y - previous.panY) * ratio,
        };
      });
    }

    function reprojectCropViewport(placement: CropPlacement | null) {
      const previous = cropPlacementRef.current;
      if (previous === placement) return; // No echo for a gesture's own commit.
      cropPlacementRef.current = placement;
      cropPanStartRef.current = null;
      clearCropOverscroll();

      // Reprojection changes only the preview, never the draft it represents.
      if (previous?.viewport.zoom !== placement?.viewport.zoom
        || previous?.geometry.maxZoom !== placement?.geometry.maxZoom) {
        publishScale(placement);
      }
    }

    return { updateCropViewport, zoomCropViewportAt, reprojectCropViewport };
  }, [clearCropOverscroll, dispatch, onCropScaleChange]);

  useLayoutEffect(() => {
    reprojectCropViewport(cropPlacement);
  }, [cropPlacement, reprojectCropViewport]);

  useLayoutEffect(() => () => {
    cropPlacementRef.current = null;
    onCropScaleChange(null);
  }, [onCropScaleChange]);

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
    // Browsers can coalesce moves; size the shape at the release point.
    if (pos && state.activeTool !== 'draw') updateDrawingPoint(pos);

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
        if (annotation.type === 'rect' || annotation.type === 'redact') tooSmall = annotation.width < 3 && annotation.height < 3;
        if (annotation.type === 'ellipse' && annotation.radiusX < 2 && annotation.radiusY < 2) tooSmall = true;
      }

      if (tooSmall) {
        dispatch({ type: 'DELETE_ANNOTATION', id });
      } else {
        dispatch({ type: 'SELECT_ANNOTATION', id });
      }
    }

    resetDrawing();
  }, [dispatch, flushShapeUpdate, resetDrawing, state.activeTool, state.textOptions, updateDrawingPoint]);

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
    // Keep the browser's mousedown default from moving focus back off the workspace.
    if (e.evt.type === 'mousedown') e.evt.preventDefault();
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

      const viewport = cropPlacementRef.current?.viewport;
      if (viewport && typeof clientX === 'number' && typeof clientY === 'number') {
        clearCropOverscroll();
        cropPanStartRef.current = {
          clientX,
          clientY,
          panX: viewport.panX,
          panY: viewport.panY,
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
    clearCropOverscroll,
    dispatch,
    editingText,
    getRelativePos,
    isCropMode,
    liveAnnotationScale,
    resetDrawing,
    placeSticker,
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

  const handleDocumentMove = useEffectEvent((event: MouseEvent | TouchEvent) => {
    const cropStart = cropPanStartRef.current;
    if (!cropStart && !isDrawing.current) return;

    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

    if (cropStart) {
      const panX = cropStart.panX + (clientX - cropStart.clientX);
      const panY = cropStart.panY + (clientY - cropStart.clientY);
      const bounded = updateCropViewport(({ zoom }) => ({ zoom, panX, panY }));
      if (bounded && cropStart.elastic) {
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

    const pos = getRelativePosFromClient(clientX, clientY);
    if (pos) updateDrawingPoint(pos);
  });

  const handleDocumentUp = useEffectEvent((event: MouseEvent | TouchEvent) => {
    if (cropPanStartRef.current) releaseCrop();
    if (!isDrawing.current || isCropMode) return;

    const changedTouch = 'changedTouches' in event ? event.changedTouches[0] : undefined;
    const clientX = changedTouch?.clientX ?? ('clientX' in event ? event.clientX : undefined);
    const clientY = changedTouch?.clientY ?? ('clientY' in event ? event.clientY : undefined);
    const pos =
      typeof clientX === 'number' && typeof clientY === 'number'
        ? getRelativePosFromClient(clientX, clientY)
        : null;

    finishDrawing(pos);
  });

  useEffect(() => {
    const onMove = (event: MouseEvent | TouchEvent) => handleDocumentMove(event);
    const onUp = (event: MouseEvent | TouchEvent) => handleDocumentUp(event);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // Passive: only the workspace's touchmove below intercepts active strokes.
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', releaseCrop);
    window.addEventListener('blur', releaseCrop);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', releaseCrop);
      window.removeEventListener('blur', releaseCrop);
    };
  }, [releaseCrop]);

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
    left: offsetX,
    top: offsetY,
    width: displayWidth,
    height: displayHeight,
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

  const handleWheel = useEffectEvent((event: WheelEvent) => {
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
  });

  // Attach the wheel handler natively (non-passive) instead of via React's onWheel:
  // synthetic wheel events do not reliably reach handlers inside the dialog portal,
  // and a non-passive listener is required for preventDefault to suppress page scroll.
  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) {
      return;
    }

    const onWheel = (event: WheelEvent) => handleWheel(event);
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

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
          event.preventDefault();
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
      <div className="inkio-ie-stage-shell">
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
          {rotating && <div className="inkio-ie-rotation-raster" style={{ transform: rotationTransform }}>{photo}</div>}
          {(!rotating || state.annotations.length > 0) && <Stage
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
              transform={renderedTransform}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onSelectAnnotation={handleSelectAnnotation}
              interactive={!isCropMode}
              onChangeAnnotation={handleChangeAnnotation}
              editingTextId={editingText?.id}
              cropAperture={cropAperture}
              onEditText={setEditingTextId}
            >
              {!rotating && photo}
            </DesignLayer>
            <TransformersLayer
              selectedAnnotationId={visibleSelectedAnnotationId}
              stageRef={stageRef}
            />
          </Stage>}
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

        {selected && !editingText && !isCropMode && <SelectionActionsOverlay
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

