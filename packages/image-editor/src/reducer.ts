import type {
  ImageEditorState,
  Annotation,
  CropRect,
  DrawOptions,
  ShapeOptions,
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
} from './constants';
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
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'UPDATE_ANNOTATION'; id: string; updates: Partial<Annotation> }
  | { type: 'UPDATE_ANNOTATION_COMMIT'; id: string; updates: Partial<Annotation> }
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

export const initialState: ImageEditorState = {
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
  drawOptions: DEFAULT_DRAW_OPTIONS,
  shapeOptions: DEFAULT_SHAPE_OPTIONS,
  textOptions: DEFAULT_TEXT_OPTIONS,
  cropOptions: DEFAULT_CROP_OPTIONS,
  resizeOptions: DEFAULT_RESIZE_OPTIONS,
  pendingCrop: null,
  isLoading: false,
  error: null,
};

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
        pendingCrop: state.pendingCrop,
      };

    case 'START_RESIZE_SESSION': {
      const appliedCrop = state.transform.crop;
      const appliedSize = getAppliedResizeSize(state);
      const cropBounds = appliedCrop ?? {
        x: 0,
        y: 0,
        width: appliedSize.width,
        height: appliedSize.height,
      };
      const seededCrop = appliedCrop
        ? appliedCrop
        : offsetCropRect(
          cropBounds.x,
          cropBounds.y,
          getDefaultCropRect(cropBounds.width, cropBounds.height, state.cropOptions.aspectRatio),
        );

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

    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] };

    case 'UPDATE_ANNOTATION':
    case 'UPDATE_ANNOTATION_COMMIT':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? ({ ...a, ...action.updates } as Annotation) : a,
        ),
      };

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
      return {
        ...state,
        annotations: moveAnnotation(state.annotations, action.id, state.annotations.length - 1),
      };

    case 'BRING_ANNOTATION_FORWARD': {
      const index = state.annotations.findIndex((annotation) => annotation.id === action.id);
      if (index < 0 || index === state.annotations.length - 1) {
        return state;
      }

      return {
        ...state,
        annotations: moveAnnotation(state.annotations, action.id, index + 1),
      };
    }

    case 'SEND_ANNOTATION_BACKWARD': {
      const index = state.annotations.findIndex((annotation) => annotation.id === action.id);
      if (index <= 0) {
        return state;
      }

      return {
        ...state,
        annotations: moveAnnotation(state.annotations, action.id, index - 1),
      };
    }

    case 'SEND_ANNOTATION_TO_BACK':
      return {
        ...state,
        annotations: moveAnnotation(state.annotations, action.id, 0),
      };

    case 'RESET_CROP':
      return {
        ...state,
        transform: { ...state.transform, crop: null },
        pendingCrop: null,
      };

    case 'RESET':
      return { ...initialState };

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
]);

// ---- Undo/redo wrapper ----

export interface UndoableEditorState {
  present: ImageEditorState;
  past: ImageEditorState[];
  future: ImageEditorState[];
}

export type UndoableAction =
  | ({ undoable: true } & ImageEditorAction)
  | ({ undoable: false } & ImageEditorAction)
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
      past: [...state.past, state.present].slice(-maxUndoSteps),
      future: state.future.slice(1),
    };
  }

  const { undoable: _undoable, ...baseAction } = action as { undoable?: boolean } & ImageEditorAction;
  const nextPresent = imageEditorReducer(state.present, baseAction as ImageEditorAction);

  if (_undoable) {
    return {
      present: nextPresent,
      past: [...state.past, state.present].slice(-maxUndoSteps),
      future: [],
    };
  }

  return { ...state, present: nextPresent };
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

function offsetCropRect(x: number, y: number, crop: CropRect): CropRect {
  return {
    x: x + crop.x,
    y: y + crop.y,
    width: crop.width,
    height: crop.height,
  };
}
