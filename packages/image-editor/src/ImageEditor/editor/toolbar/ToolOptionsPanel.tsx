
import type { ToolType } from '../types';
import { useImageEditor } from '../hooks/useImageEditor';
import { CropOptions } from './options/CropOptions';
import { RotateFlipOptions } from './options/RotateFlipOptions';
import { ResizeOptions } from './options/ResizeOptions';
import { DrawOptionsPanel } from './options/DrawOptionsPanel';
import { ShapeOptionsPanel } from './options/ShapeOptionsPanel';
import { TextOptionsPanel } from './options/TextOptionsPanel';
import {
  getSelectedAnnotation,
  isDrawAnnotation,
  isShapeAnnotation,
  isTextAnnotation,
} from '../utils/annotationTypes';

interface ToolOptionsPanelProps {
  activeTool: ToolType | null;
}

export function ToolOptionsPanel({ activeTool }: ToolOptionsPanelProps) {
  const { state } = useImageEditor();
  const selectedAnnotation = getSelectedAnnotation(state.annotations, state.selectedAnnotationId);

  let resolvedPanel: ToolType | null = activeTool;

  if (activeTool !== 'crop' && activeTool !== 'rotate' && activeTool !== 'resize') {
    if (isDrawAnnotation(selectedAnnotation)) {
      resolvedPanel = 'draw';
    } else if (isShapeAnnotation(selectedAnnotation)) {
      resolvedPanel = 'shape';
    } else if (isTextAnnotation(selectedAnnotation)) {
      resolvedPanel = 'text';
    }
  }

  return (
    <div className="inkio-ie-options-panel">
      {resolvedPanel === 'crop' && <CropOptions />}
      {resolvedPanel === 'rotate' && <RotateFlipOptions />}
      {resolvedPanel === 'resize' && <ResizeOptions />}
      {resolvedPanel === 'draw' && <DrawOptionsPanel />}
      {resolvedPanel === 'shape' && <ShapeOptionsPanel />}
      {resolvedPanel === 'text' && <TextOptionsPanel />}
      {!resolvedPanel && (
        <div className="inkio-ie-options-empty">
          <span className="inkio-ie-options-empty-text">Select a tool to view options</span>
        </div>
      )}
    </div>
  );
};
