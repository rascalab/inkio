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

export type ImageEditorAction =
  | { type: 'SET_IMAGE'; image: HTMLImageElement; width: number; height: number }
  | { type: 'SET_TOOL'; tool: ToolType | null }
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
  | { type: 'SET_EDITING_TEXT'; id: string | null }
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
  editingTextId: null,
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
        selectedAnnotationId: null,
        editingTextId: null,
        pendingCrop: action.tool !== 'crop' ? null : state.pendingCrop,
      };

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

    case 'SET_EDITING_TEXT':
      return { ...state, editingTextId: action.id };

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
