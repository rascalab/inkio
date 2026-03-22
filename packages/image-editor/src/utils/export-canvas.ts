import Konva from 'konva';
import type { ImageEditorState, Annotation } from '../types';
import { getTransformedDimensions, getBaseDisplayDimensions } from './geometry';
import { getTextAnnotationHeight, resolveTextFontSizePx, TEXT_DEFAULT_FONT_FAMILY } from './text-metrics';

function applyAnnotationToGroup(
  container: Konva.Group | Konva.Layer,
  ann: Annotation,
  scale: number,
): void {
  switch (ann.type) {
    case 'rect': {
      const shape = new Konva.Rect({
        x: ann.x * scale,
        y: ann.y * scale,
        width: ann.width * scale,
        height: ann.height * scale,
        fill: ann.fill,
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        rotation: ann.rotation,
      });
      container.add(shape);
      break;
    }
    case 'ellipse': {
      const shape = new Konva.Ellipse({
        x: ann.x * scale,
        y: ann.y * scale,
        radiusX: ann.radiusX * scale,
        radiusY: ann.radiusY * scale,
        fill: ann.fill,
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        rotation: ann.rotation,
      });
      container.add(shape);
      break;
    }
    case 'arrow': {
      const shape = new Konva.Arrow({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        fill: ann.stroke,
        pointerLength: 10 * scale,
        pointerWidth: 10 * scale,
      });
      container.add(shape);
      break;
    }
    case 'line': {
      const shape = new Konva.Line({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        lineCap: 'round',
        lineJoin: 'round',
      });
      container.add(shape);
      break;
    }
    case 'text': {
      const fontSizePx = resolveTextFontSizePx(ann.fontSize);
      const shape = new Konva.Text({
        x: ann.x * scale,
        y: ann.y * scale,
        text: ann.text,
        fontSize: fontSizePx * scale,
        fontFamily: ann.fontFamily || TEXT_DEFAULT_FONT_FAMILY,
        fill: ann.fill,
        fontStyle: ann.fontStyle,
        rotation: ann.rotation,
        width: ann.width ? ann.width * scale : undefined,
        height: getTextAnnotationHeight(ann) * scale,
      });
      container.add(shape);
      break;
    }
    case 'freedraw': {
      const shape = new Konva.Line({
        points: ann.points.map((p) => p * scale),
        stroke: ann.stroke,
        strokeWidth: ann.strokeWidth * scale,
        opacity: ann.opacity,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: 'source-over',
      });
      container.add(shape);
      break;
    }
  }
}

export async function exportCanvas(
  state: ImageEditorState,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92,
): Promise<string> {
  if (!state.originalImage) {
    throw new Error('No image loaded');
  }

  const { width: outW, height: outH } = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    state.transform,
    state.outputSize,
  );

  const { width: baseW, height: baseH } = getBaseDisplayDimensions(
    outW, outH, state.transform.rotation,
  );

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none';
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({
      container,
      width: outW,
      height: outH,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Draw image with transforms
    const imageNode = new Konva.Image({
      image: state.originalImage,
      x: outW / 2,
      y: outH / 2,
      width: baseW,
      height: baseH,
      offsetX: baseW / 2,
      offsetY: baseH / 2,
      rotation: state.transform.rotation,
      scaleX: state.transform.flipX ? -1 : 1,
      scaleY: state.transform.flipY ? -1 : 1,
    });

    if (state.transform.crop) {
      const crop = state.transform.crop;
      imageNode.crop({
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      });
      imageNode.width(baseW);
      imageNode.height(baseH);
      imageNode.x(outW / 2);
      imageNode.y(outH / 2);
      imageNode.offsetX(baseW / 2);
      imageNode.offsetY(baseH / 2);
    }

    layer.add(imageNode);

    // Render annotations
    // Annotations use original-image-space coordinates.
    // With crop, offset by crop origin and scale to output size.
    const cropX = state.transform.crop?.x ?? 0;
    const cropY = state.transform.crop?.y ?? 0;
    const srcW = state.transform.crop?.width ?? state.originalWidth;
    const srcH = state.transform.crop?.height ?? state.originalHeight;
    const annScale = Math.min(baseW / srcW, baseH / srcH);

    const rotation = state.transform.rotation ?? 0;
    const flipX = state.transform.flipX ? -1 : 1;
    const flipY = state.transform.flipY ? -1 : 1;

    // Wrap annotations in a transform group matching the image node so that
    // rotation and flip are applied consistently on export.
    const transformGroup = new Konva.Group({
      x: outW / 2,
      y: outH / 2,
      rotation,
      scaleX: flipX,
      scaleY: flipY,
      offsetX: baseW / 2,
      offsetY: baseH / 2,
    });

    const annotationGroup = new Konva.Group({
      x: -cropX * annScale,
      y: -cropY * annScale,
    });
    transformGroup.add(annotationGroup);
    layer.add(transformGroup);

    for (const ann of state.annotations) {
      applyAnnotationToGroup(annotationGroup, ann, annScale);
    }

    layer.batchDraw();

    const mimeType =
      format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

    const dataURL = stage.toDataURL({ mimeType, quality });
    stage.destroy();
    return dataURL;
  } finally {
    container.remove();
  }
}
