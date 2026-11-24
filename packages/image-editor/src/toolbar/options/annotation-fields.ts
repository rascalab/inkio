import type { ImageEditorContextValue } from '../../ImageEditorContext';
import type { ImageEditorAction } from '../../reducer';
import type { Annotation, ImageEditorState } from '../../types';
import { getSelectedAnnotation } from '../../utils/annotation-types';

export function selectedFor<A extends Annotation>(
  state: ImageEditorState,
  matches: (annotation: Annotation | null) => annotation is A,
): A | null {
  const selected = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);
  return matches(selected) ? selected : null;
}

type OptionsAction = Extract<ImageEditorAction, { options: object }>;
type AnnotationKey<A> = A extends Annotation ? keyof A : never;
type ToolOptions<T extends OptionsAction['type']> = Required<Extract<OptionsAction, { type: T }>['options']>;
type FieldChange<V> = (value: V, preview?: boolean) => void;

interface FieldBinder<Options, A> {
  <K extends keyof Options & AnnotationKey<A> & string>(key: K): FieldChange<Options[K]>;
  <K extends keyof Options & string>(key: K, annotationKey: AnnotationKey<A>): FieldChange<Options[K]>;
}

/** Bind each control to its tool default or the matching selected annotation field. */
export function optionFields<T extends OptionsAction['type'], A extends Annotation>(
  dispatch: ImageEditorContextValue['dispatch'],
  type: T,
  selected: A | null,
): FieldBinder<ToolOptions<T>, A> {
  return <K extends keyof ToolOptions<T> & string>(key: K, annotationKey?: AnnotationKey<A>) =>
    (value: ToolOptions<T>[K], preview = false) => {
      if (selected) {
        dispatch({
          type: preview ? 'UPDATE_ANNOTATION' : 'UPDATE_ANNOTATION_COMMIT',
          id: selected.id,
          updates: { [annotationKey ?? key]: value },
        });
      } else {
        dispatch({ type, options: { [key]: value } });
      }
    };
}
