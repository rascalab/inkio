// @vitest-environment jsdom

import { Profiler, StrictMode, useReducer, useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditorContext } from '../../ImageEditorContext';
import { DEFAULT_LOCALE } from '../../constants';
import { imageEditorReducer, initialState } from '../../reducer';
import { EditorCanvas, type CropScaleControl } from '../EditorCanvas';
import { planCropPlacement, projectSourceCrop } from '../crop-viewport';

vi.mock('react-konva/lib/ReactKonvaCore.js', () => ({ Stage: () => null }));
vi.mock('../DesignLayer', () => ({ DesignLayer: () => null }));
vi.mock('../TransformersLayer', () => ({ TransformersLayer: () => null }));

afterEach(cleanup);

const noop = () => {};

function CropHarness({ width, height }: { width: number; height: number }) {
  const [state, dispatch] = useReducer(imageEditorReducer, {
    ...initialState,
    activeTool: 'resize',
    originalWidth: 336,
    originalHeight: 560,
    transform: { ...initialState.transform, rotation: 90 },
    pendingCrop: { x: 0, y: 0, width: 336, height: 560 },
    resizeOptions: { ...initialState.resizeOptions, width: 560, height: 336 },
  });
  const [scale, setScale] = useState<CropScaleControl | null>(null);
  return (
    <ImageEditorContext.Provider value={{
      state, dispatch, locale: DEFAULT_LOCALE, undo: noop, redo: noop, canUndo: false, canRedo: false,
    }}>
      <EditorCanvas
        containerWidth={width}
        containerHeight={height}
        previewZoom={1}
        onPreviewZoomFactor={noop}
        onCropScaleChange={setScale}
      />
      <output data-testid="crop">{JSON.stringify(state.pendingCrop ?? state.transform.crop)}</output>
      <output data-testid="dimensions">{state.resizeOptions.width}x{state.resizeOptions.height}</output>
      <output data-testid="output-size">{state.outputSize && `${state.outputSize.width}x${state.outputSize.height}`}</output>
      <output data-testid="scale">{scale?.value.toFixed(4)}</output>
      <button type="button" onClick={() => dispatch({ type: 'COMMIT_RESIZE_SESSION' })}>Apply</button>
    </ImageEditorContext.Provider>
  );
}

describe('EditorCanvas crop gestures', () => {
  it('preserves a small off-center source crop even in a workspace beyond the raster budget', () => {
    const crop = { x: 2000, y: 1200, width: 400, height: 200 };
    const placement = planCropPlacement({
      image: null, imageWidth: 6000, imageHeight: 3000, rotation: 90, flipX: true, flipY: false,
      stageWidth: 2400, stageHeight: 1600,
    }, crop)!;
    const projected = projectSourceCrop(placement.geometry, placement.viewport);
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(projected[key]).toBeCloseTo(crop[key], 8);
    }
    const scale = placement.geometry.fitScale * placement.viewport.zoom;
    expect(placement.geometry.boundsHeight * scale).toBeLessThanOrEqual(4096.000001);
  });

  it('commits zoom, the rotated source crop, and dimensions together and keeps them through reprojection and apply', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const read = (testId: string) => container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;
    const commits: Array<Record<'zoom' | 'crop' | 'dimensions' | 'scale', string | undefined>> = [];
    const editor = (width: number, height: number) => (
      <StrictMode>
        <Profiler id="crop" onRender={() => {
          commits.push({
            zoom: read('inkio-ie-crop-viewport-zoom'),
            crop: read('crop'),
            dimensions: read('dimensions'),
            scale: read('scale'),
          });
        }}>
          <CropHarness width={width} height={height} />
        </Profiler>
      </StrictMode>
    );
    const { getByRole, getByTestId, rerender } = render(editor(560, 336), { container });
    expect(read('scale')).toBe('1.0000');
    const crop = JSON.stringify({ x: 18, y: 30, width: 300, height: 500 });
    commits.length = 0;

    fireEvent.keyDown(getByTestId('inkio-ie-canvas-workspace'), { key: 'ArrowUp', shiftKey: true });
    expect(commits.length).toBeGreaterThan(0);
    for (const commit of commits) {
      expect(commit).toEqual({ zoom: '1.1200', crop, dimensions: '500x300', scale: '1.1200' });
    }

    rerender(editor(420, 300));
    expect(read('inkio-ie-crop-viewport-zoom')).toBe('1.1200');
    expect(read('crop')).toBe(crop);
    expect(read('dimensions')).toBe('500x300');

    fireEvent.click(getByRole('button', { name: 'Apply' }));
    expect(read('inkio-ie-crop-viewport-zoom')).toBeUndefined();
    expect(read('scale')).toBe('');
    expect(read('crop')).toBe(crop);
    expect(read('dimensions')).toBe('500x300');
    expect(read('output-size')).toBe('300x500');
  });
});
