import { useRef, useEffect, useLayoutEffect, type ComponentProps, type RefObject } from 'react';
import { Layer, Transformer } from 'react-konva/lib/ReactKonvaCore.js';
import 'konva/lib/shapes/Transformer.js';
import type Konva from 'konva';
import { getIEColors } from '../theme';

const BORDER_DASH = [3, 3];
const constrainTransformer: ComponentProps<typeof Transformer>['boundBoxFunc'] = (oldBox, newBox) =>
  newBox.width < 5 || newBox.height < 5 ? oldBox : newBox;

interface TransformersLayerProps {
  selectedAnnotationId: string | null;
  stageRef: RefObject<Konva.Stage | null>;
}

export function TransformersLayer({
  selectedAnnotationId,
  stageRef,
}: TransformersLayerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr || !selectedAnnotationId) return;

    const stage = stageRef.current;
    if (!stage) return;

    // Match by predicate, never by `#id` selector: annotation ids may
    // contain selector-significant characters (spaces, dots, colons,
    // quotes) that silently fail to match and drop the transformer.
    const node = stage.find((candidate: Konva.Node) => candidate.id() === selectedAnnotationId)[0];
    if (node) {
      tr.nodes([node as Konva.Node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedAnnotationId, stageRef]);

  useLayoutEffect(() => {
    const tr = transformerRef.current;
    if (!tr || !selectedAnnotationId) return;
    // Read after DOM updates so editor-local CSS overrides (including theme) win.
    const colors = getIEColors(tr.getStage()?.container());
    tr.setAttrs({ anchorFill: colors.handle, anchorStroke: colors.primary, borderStroke: colors.primary });
  });

  // An empty Konva Layer still owns full-size scene and hit canvases.
  if (!selectedAnnotationId) return null;

  return (
    <Layer>
      <Transformer
        ref={transformerRef}
        boundBoxFunc={constrainTransformer}
        anchorSize={8}
        borderDash={BORDER_DASH}
        keepRatio={false}
        // Flipping via anchors would persist negative scaleX/scaleY into
        // annotation width/height (Konva renders negative sizes unpredictably).
        // Image-level flip already exists as a first-class transform.
        flipEnabled={false}
      />
    </Layer>
  );
};
