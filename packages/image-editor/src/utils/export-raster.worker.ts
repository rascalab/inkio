import Konva from 'konva';
import {
  encodeExportCanvas, renderExportScene, verifyEncodedBlob,
  type ExportOutput, type ExportResult, type ExportScene,
} from './export-raster';

export interface ExportWorkerRequest {
  scene: ExportScene;
  image: ImageBitmap;
  mimeType: string;
  quality: number;
  output: ExportOutput;
}

// Konva 10.7's canvas wrapper needs a style object. Set its factory only in
// the worker so the same scene/cache APIs can draw to native OffscreenCanvas.
Konva.Util.createCanvasElement = () => Object.assign(new OffscreenCanvas(0, 0), { style: {} }) as unknown as HTMLCanvasElement;

async function exportImage({ scene, image, mimeType, quality, output }: ExportWorkerRequest): Promise<ExportResult> {
  let canvas: HTMLCanvasElement;
  try {
    canvas = renderExportScene(scene, image);
  } finally {
    image.close();
  }

  // Konva's public type describes a DOM canvas, but the worker factory returns OffscreenCanvas.
  return encodeExportCanvas(canvas, output, async (target) =>
    verifyEncodedBlob(await (target as OffscreenCanvas).convertToBlob({ type: mimeType, quality }), mimeType));
}

self.onmessage = ({ data }: MessageEvent<ExportWorkerRequest>) => {
  void exportImage(data).then(
    (result) => self.postMessage(result),
    () => self.postMessage(null),
  );
};
