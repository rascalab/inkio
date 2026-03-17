import { useRef, useEffect, type RefObject } from 'react';
import { Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import { getIEColors } from '../theme';

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
    if (!tr) return;

    if (!selectedAnnotationId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const node = stage.findOne(`#${selectedAnnotationId}`);
    if (node) {
      tr.nodes([node as Konva.Node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedAnnotationId, stageRef]);

  const colors = getIEColors();

  return (
    <Layer>
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 5 || newBox.height < 5) return oldBox;
          return newBox;
        }}
        anchorFill={colors.handle}
        anchorStroke={colors.primary}
        anchorSize={8}
        borderStroke={colors.primary}
        borderDash={[3, 3]}
        keepRatio={false}
      />
    </Layer>
  );
};
