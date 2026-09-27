import type {
  ImageEditorState,
  Annotation,
  CropRect,
  DrawOptions,
  FilterPresetId,
  FinetuneOptions,
  RedactOptions,
  ShapeOptions,
  StickerOptions,
  TextOptions,
  CropOptionsState,
  ResizeOptionsState,
  OutputSize,
  ToolType,
} from './types';
import {
  DEFAULT_DRAW_OPTIONS,
  DEFAULT_SHAPE_OPTIONS,
  DEFAULT_TEXT_OPTIONS,
  DEFAULT_CROP_OPTIONS,
  DEFAULT_RESIZE_OPTIONS,
  DEFAULT_REDACT_OPTIONS,
  DEFAULT_STICKER_OPTIONS,
} from './constants';
import { DEFAULT_FINETUNE } from './utils/filters';
import { getDefaultCropRect } from './utils/crop';
import { getTransformedDimensions } from './utils/geometry';

export type ImageEditorAction =
  | { type: 'SET_IMAGE'; image: HTMLImageElement; width: number; height: number }
  | { type: 'SET_TOOL'; tool: ToolType | null; preserveSelection?: boolean }
  | { type: 'START_RESIZE_SESSION' }
  | { type: 'COMMIT_RESIZE_SESSION' }
  | { type: 'DISCARD_RESIZE_SESSION' }
  | { type: 'RESET_RESIZE_SESSION' }
  | { type: 'SET_DRAW_OPTIONS'; options: Partial<DrawOptions> }
  | { type: 'SET_SHAPE_OPTIONS'; options: Partial<ShapeOptions> }
  | { type: 'SET_TEXT_OPTIONS'; options: Partial<TextOptions> }
  | { type: 'SET_CROP_OPTIONS'; options: Partial<CropOptionsState> }
  | { type: 'SET_RESIZE_OPTIONS'; options: Partial<ResizeOptionsState> }
  | { type: 'SET_FILTER'; filter: FilterPresetId }
  | { type: 'SET_FINETUNE'; finetune: Partial<FinetuneOptions> }
  | { type: 'RESET_FINETUNE' }
  | { type: 'SET_REDACT_OPTIONS'; options: Partial<RedactOptions> }
  | { type: 'SET_STICKER_OPTIONS'; options: Partial<StickerOptions> }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'UPDATE_ANNOTATION'; id: string; updates: Partial<Annotation> }
  | { type: 'UPDATE_ANNOTATION_COMMIT'; id: string; updates: Partial<Annotation> }
  | { type: 'APPEND_ANNOTATION_POINTS'; id: string; points: number[] }
  | { type: 'DELETE_ANNOTATION'; id: string }
  | { type: 'SELECT_ANNOTATION'; id: string | null }
  | { type: 'APPLY_CROP' }
  | { type: 'SET_PENDING_CROP'; crop: CropRect | null }
  | { type: 'ROTATE_CW' }
  | { type: 'ROTATE_CCW' }
  | { type: 'FLIP_X' }
  | { type: 'FLIP_Y' }
  | { type: 'APPLY_RESIZE'; size: OutputSize }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'BRING_ANNOTATION_TO_FRONT'; id: string }
  | { type: 'BRING_ANNOTATION_FORWARD'; id: string }
  | { type: 'SEND_ANNOTATION_BACKWARD'; id: string }
  | { type: 'SEND_ANNOTATION_TO_BACK'; id: string }
  | { type: 'RESET_CROP' }
  | { type: 'RESET' };

/**
 * Fresh nested option objects per call: sharing the DEFAULT_* singletons
 * (or a single initialState's nested refs) across sessions means one
 * accidental in-place mutation corrupts defaults for every future session.
 */
export function createInitialState(): ImageEditorState {
  return {
    originalImage: null,
    originalWidth: 0,
    originalHeight: 0,
    transform: {
      rotation: 0,
      flipX: false,
      flipY: false,
      crop: null,
    },
    outputSize: null,
    annotations: [],
    selectedAnnotationId: null,
    activeTool: null,
    filter: 'none',
    finetune: { ...DEFAULT_FINETUNE },
    drawOptions: { ...DEFAULT_DRAW_OPTIONS },
    shapeOptions: { ...DEFAULT_SHAPE_OPTIONS },
    textOptions: { ...DEFAULT_TEXT_OPTIONS },
    cropOptions: { ...DEFAULT_CROP_OPTIONS },
    resizeOptions: { ...DEFAULT_RESIZE_OPTIONS },
    redactOptions: { ...DEFAULT_REDACT_OPTIONS },
    stickerOptions: { ...DEFAULT_STICKER_OPTIONS },
    pendingCrop: null,
    isLoading: false,
    error: null,
  };
}

export const initialState: ImageEditorState = createInitialState();

export function imageEditorReducer(
  state: ImageEditorState,
  action: ImageEditorAction,
): ImageEditorState {
  switch (action.type) {
    case 'SET_IMAGE':
      return {
        ...state,
        originalImage: action.image,
        originalWidth: action.width,
        originalHeight: action.height,
        transform: { rotation: 0, flipX: false, flipY: false, crop: null },
        outputSize: null,
        annotations: [],
        selectedAnnotationId: null,
        pendingCrop: null,
        resizeOptions: {
          ...state.resizeOptions,
          width: action.width,
          height: action.height,
        },
      };

    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        selectedAnnotationId: action.preserveSelection ? state.selectedAnnotationId : null,
        // Crop/resize sessions belong to their tool: carrying a stale
        // pendingCrop across tools blocks the next session from starting.
        pendingCrop: null,
      };

    case 'START_RESIZE_SESSION': {
      const appliedCrop = state.transform.crop;
      const appliedSize = getAppliedResizeSize(state);
      const seededCrop = appliedCrop
        ?? getDefaultCropRect(appliedSize.width, appliedSize.height, state.cropOptions.aspectRatio);

      return {
        ...state,
        pendingCrop: seededCrop,
        resizeOptions: {
          ...state.resizeOptions,
          width: appliedSize.width,
          height: appliedSize.height,
        },
      };
    }

    case 'COMMIT_RESIZE_SESSION':
      return {
        ...state,
        transform: { ...state.transform, crop: state.pendingCrop },
        outputSize: {
          width: state.resizeOptions.width,
          height: state.resizeOptions.height,
        },
        pendingCrop: null,
      };

    case 'DISCARD_RESIZE_SESSION': {
      const appliedSize = getAppliedResizeSize(state);
      return {
        ...state,
        pendingCrop: null,
        resizeOptions: {
          ...state.resizeOptions,
          width: appliedSize.width,
          height: appliedSize.height,
        },
      };
    }

    case 'RESET_RESIZE_SESSION': {
      const resetTransform = {
        ...state.transform,
        crop: null,
      };
      const resetCropOptions = DEFAULT_CROP_OPTIONS;
      const resetSize = getTransformedDimensions(
        state.originalWidth,
        state.originalHeight,
        resetTransform,
        null,
      );
      const resetCrop = getDefaultCropRect(
        resetSize.width,
        resetSize.height,
        resetCropOptions.aspectRatio,
      );

      return {
        ...state,
        transform: resetTransform,
        cropOptions: resetCropOptions,
        outputSize: null,
        pendingCrop: resetCrop,
        resizeOptions: {
          ...state.resizeOptions,
          width: resetSize.width,
          height: resetSize.height,
        },
      };
    }

    case 'SET_DRAW_OPTIONS':
      return { ...state, drawOptions: { ...state.drawOptions, ...action.options } };

    case 'SET_SHAPE_OPTIONS':
      return { ...state, shapeOptions: { ...state.shapeOptions, ...action.options } };

    case 'SET_TEXT_OPTIONS':
      return { ...state, textOptions: { ...state.textOptions, ...action.options } };

    case 'SET_CROP_OPTIONS':
      return { ...state, cropOptions: { ...state.cropOptions, ...action.options } };

    case 'SET_RESIZE_OPTIONS':
      return { ...state, resizeOptions: { ...state.resizeOptions, ...action.options } };

    case 'SET_FILTER':
      return { ...state, filter: action.filter };

    case 'SET_FINETUNE':
      return { ...state, finetune: { ...state.finetune, ...action.finetune } };

    case 'RESET_FINETUNE':
      return { ...state, finetune: { ...DEFAULT_FINETUNE } };

    case 'SET_REDACT_OPTIONS':
      return { ...state, redactOptions: { ...state.redactOptions, ...action.options } };

    case 'SET_STICKER_OPTIONS':
      return { ...state, stickerOptions: { ...state.stickerOptions, ...action.options } };

    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] };

    case 'UPDATE_ANNOTATION':
    case 'UPDATE_ANNOTATION_COMMIT': {
      // Stale id (e.g. drag events racing a delete): return the identical
      // state so memoized layers skip the re-render entirely.
      const index = state.annotations.findIndex((a) => a.id === action.id);
      if (index < 0) return state;
      // No-op updates (blur commits with unchanged values, settling sliders)
      // return the identical state too: otherwise every one spreads into a
      // new object and pollutes undo history plus re-renders.
      const current = state.annotations[index] as unknown as Record<string, unknown>;
      const updates = action.updates as Record<string, unknown>;
      const changed = Object.keys(updates).some((key) => !Object.is(current[key], updates[key]));
      if (!changed) return state;
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? ({ ...a, ...action.updates } as Annotation) : a,
        ),
      };
    }

    // Freedraw commit path: EditorCanvas previews a stroke imperatively and
    // appends all of its points here once on stroke end, so the spread below
    // runs once per stroke rather than once per frame.
    case 'APPEND_ANNOTATION_POINTS': {
      if (action.points.length === 0) return state;
      let changed = false;
      const annotations = state.annotations.map((a) => {
        if (a.id !== action.id) return a;
        if (a.type !== 'freedraw' && a.type !== 'line' && a.type !== 'arrow') return a;
        changed = true;
        return { ...a, points: [...a.points, ...action.points] } as Annotation;
      });
      return changed ? { ...state, annotations } : state;
    }

    case 'DELETE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
        selectedAnnotationId:
          state.selectedAnnotationId === action.id ? null : state.selectedAnnotationId,
      };

    case 'SELECT_ANNOTATION':
      return { ...state, selectedAnnotationId: action.id };

    case 'APPLY_CROP':
      return {
        ...state,
        transform: { ...state.transform, crop: state.pendingCrop },
        pendingCrop: null,
      };

    case 'SET_PENDING_CROP':
      return { ...state, pendingCrop: action.crop };

    case 'ROTATE_CW':
      return {
        ...state,
        transform: { ...state.transform, rotation: (state.transform.rotation + 90) % 360 },
      };

    case 'ROTATE_CCW':
      return {
        ...state,
        transform: {
          ...state.transform,
          rotation: ((state.transform.rotation - 90) % 360 + 360) % 360,
        },
      };

    case 'FLIP_X':
      return { ...state, transform: { ...state.transform, flipX: !state.transform.flipX } };

    case 'FLIP_Y':
      return { ...state, transform: { ...state.transform, flipY: !state.transform.flipY } };

    case 'APPLY_RESIZE':
      return { ...state, outputSize: action.size };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'BRING_ANNOTATION_TO_FRONT':
    case 'BRING_ANNOTATION_FORWARD':
    case 'SEND_ANNOTATION_BACKWARD':
    case 'SEND_ANNOTATION_TO_BACK': {
      const lastIndex = state.annotations.length - 1;
      let targetIndex: number;
      if (action.type === 'BRING_ANNOTATION_TO_FRONT') {
        targetIndex = lastIndex;
      } else if (action.type === 'SEND_ANNOTATION_TO_BACK') {
        targetIndex = 0;
      } else {
        const index = state.annotations.findIndex((annotation) => annotation.id === action.id);
        // Clamp at the ends so a no-op move keeps the target equal to the
        // current index (moveAnnotation then returns the identical array).
        targetIndex = action.type === 'BRING_ANNOTATION_FORWARD'
          ? Math.min(index + 1, lastIndex)
          : Math.max(index - 1, 0);
      }
      const annotations = moveAnnotation(state.annotations, action.id, targetIndex);
      // moveAnnotation returns the identical array when nothing moves;
      // keep state referentially stable so history + memo layers skip it.
      return annotations === state.annotations ? state : { ...state, annotations };
    }

    case 'RESET_CROP':
      return {
        ...state,
        transform: { ...state.transform, crop: null },
        pendingCrop: null,
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

/** Actions that are undoable (affect visual output) */
export const UNDOABLE_ACTIONS = new Set<ImageEditorAction['type']>([
  'ADD_ANNOTATION',
  'UPDATE_ANNOTATION_COMMIT',
  'DELETE_ANNOTATION',
  'BRING_ANNOTATION_TO_FRONT',
  'BRING_ANNOTATION_FORWARD',
  'SEND_ANNOTATION_BACKWARD',
  'SEND_ANNOTATION_TO_BACK',
  'COMMIT_RESIZE_SESSION',
  'RESET_RESIZE_SESSION',
  'APPLY_CROP',
  'ROTATE_CW',
  'ROTATE_CCW',
  'FLIP_X',
  'FLIP_Y',
  'APPLY_RESIZE',
  'SET_FILTER',
]);

// ---- Undo/redo wrapper ----

export interface UndoableEditorState {
  present: ImageEditorState;
  past: ImageEditorState[];
  future: ImageEditorState[];
}

export type UndoableAction =
  | ImageEditorAction
  | { type: 'UNDO' }
  | { type: 'REDO' };

export function makeInitialUndoableState(): UndoableEditorState {
  return { present: initialState, past: [], future: [] };
}

export function undoableReducer(
  state: UndoableEditorState,
  action: UndoableAction,
  maxUndoSteps: number,
): UndoableEditorState {
  // Clamp so a misconfigured provider can't grow history without bound.
  // States are stored by reference (structural sharing: unchanged
  // annotations and the originalImage keep their refs), so each entry
  // costs one state shell + one annotations array, never deep copies.
  const cap = Number.isFinite(maxUndoSteps)
    ? Math.max(1, Math.min(Math.floor(maxUndoSteps), 100))
    : 30;
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      present: previous,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future],
    };
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      present: next,
      past: [...state.past, state.present].slice(-cap),
      future: state.future.slice(1),
    };
  }

  const nextPresent = imageEditorReducer(state.present, action);

  if (UNDOABLE_ACTIONS.has(action.type)) {
    // Skip no-op undoable actions (e.g. BRING_FORWARD on the top item
    // returns the identical state): pushing them wastes a history slot
    // and breaks redo expectations.
    if (nextPresent === state.present) return state;
    return {
      present: nextPresent,
      past: [...state.past, state.present].slice(-cap),
      future: [],
    };
  }

  return nextPresent === state.present ? state : { ...state, present: nextPresent };
}

function moveAnnotation(
  annotations: Annotation[],
  id: string,
  nextIndex: number,
): Annotation[] {
  const currentIndex = annotations.findIndex((annotation) => annotation.id === id);
  if (currentIndex < 0 || currentIndex === nextIndex) {
    return annotations;
  }

  const nextAnnotations = [...annotations];
  const [annotation] = nextAnnotations.splice(currentIndex, 1);
  nextAnnotations.splice(Math.max(0, Math.min(nextIndex, nextAnnotations.length)), 0, annotation);
  return nextAnnotations;
}

function getAppliedResizeSize(state: ImageEditorState): OutputSize {
  return getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );
}
