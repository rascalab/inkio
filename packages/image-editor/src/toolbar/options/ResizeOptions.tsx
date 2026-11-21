import { useCallback, useRef } from 'react';
import { useImageEditor } from '../../hooks/use-image-editor';
import { ASPECT_RATIO_PRESETS } from '../../constants';
import { getDefaultCropRect } from '../../utils/crop';
import { isQuarterTurn } from '../../utils/geometry';
import { OptionPopover } from '../OptionPopover';
import type { ViewportKind } from '../../utils/controls-model';
import { fitsRaster, MAX_EXPORT_DIMENSION, MAX_EXPORT_PIXELS } from '../../utils/raster-limits';
import {
  DimensionsField,
  PanelIconButton,
  PanelPrimaryButton,
  PanelSection,
  SegmentedControl,
  ToolPanel,
} from '../control-groups';

export function ResizeOptions({ viewportKind = 'desktop' }: { viewportKind?: ViewportKind }) {
  const { state, dispatch, locale } = useImageEditor();
  const { transform } = state;
  const effectiveCrop = state.pendingCrop ?? transform.crop;
  const cropBounds = transform.crop ?? {
    x: 0,
    y: 0,
    width: state.originalWidth,
    height: state.originalHeight,
  };

  const handleCropPreset = useCallback(
    (aspectRatio: number | null) => {
      const sourceRatio = aspectRatio && isQuarterTurn(transform.rotation) ? 1 / aspectRatio : aspectRatio;
      const nextCrop = getDefaultCropRect(cropBounds.width, cropBounds.height, sourceRatio);
      dispatch({ type: 'SET_CROP_OPTIONS', options: { aspectRatio } });
      dispatch({
        type: 'SET_PENDING_CROP',
        crop: {
          x: cropBounds.x + nextCrop.x,
          y: cropBounds.y + nextCrop.y,
          width: nextCrop.width,
          height: nextCrop.height,
        },
      });
    },
    [cropBounds.height, cropBounds.width, cropBounds.x, cropBounds.y, dispatch, transform.rotation],
  );

  const cropChoices = (
    <SegmentedControl
      label={locale.cropArea}
      items={ASPECT_RATIO_PRESETS.map((preset) => ({
        key: String(preset.label ?? preset.labelKey),
        label: preset.label ?? locale[preset.labelKey],
        active: state.cropOptions.aspectRatio === preset.value,
        onClick: () => handleCropPreset(preset.value),
        testId: `inkio-ie-crop-preset-${String(preset.label ?? preset.labelKey).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
      }))}
    />
  );
  const preset = ASPECT_RATIO_PRESETS.find((item) => item.value === state.cropOptions.aspectRatio);
  const cropLabel = preset?.label ?? (preset ? locale[preset.labelKey] : locale.cropArea);

  return (
    <ToolPanel
      title={locale.resize}
      actions={(
        <>
          <PanelIconButton
            label={locale.reset}
            testId="inkio-ie-resize-reset"
            onClick={() => dispatch({ type: 'RESET_RESIZE_SESSION' })}
          />
          <PanelPrimaryButton
            label={locale.apply}
            testId="inkio-ie-resize-apply"
            onClick={() => dispatch({ type: 'COMMIT_RESIZE_SESSION' })}
          />
        </>
      )}
    >
      <PanelSection>
        {viewportKind === 'mobile' ? (
          <OptionPopover label={`${locale.cropArea}: ${cropLabel}`} summary={cropLabel} testId="inkio-ie-crop-ratios-trigger">
            {cropChoices}
          </OptionPopover>
        ) : cropChoices}
        {effectiveCrop && (
          <p className="inkio-ie-sr-only" data-testid="inkio-ie-crop-size">
            <span className="inkio-ie-sr-only">{locale.cropPendingNotice} </span>
            {Math.round(effectiveCrop.width)} × {Math.round(effectiveCrop.height)}
          </p>
        )}
      </PanelSection>
      {viewportKind === 'desktop' && <PanelSection><ResizeDimensions /></PanelSection>}
    </ToolPanel>
  );
}

export function ResizeDimensions() {
  const { state: { resizeOptions }, dispatch, locale } = useImageEditor();
  const aspectRatioRef = useRef<number | null>(null);
  const sizeLabel = `${resizeOptions.width} × ${resizeOptions.height}`;

  const changeDimension = (axis: 'width' | 'height', value: number) => {
    let { width, height } = resizeOptions;
    if (resizeOptions.lockAspectRatio && width > 0 && height > 0) {
      const ratio = aspectRatioRef.current ?? width / height;
      aspectRatioRef.current = ratio;
      if (axis === 'width') height = Math.max(1, Math.round(value / ratio));
      else width = Math.max(1, Math.round(value * ratio));
    }
    if (axis === 'width') width = value;
    else height = value;
    if (!fitsRaster(width, height, MAX_EXPORT_DIMENSION, MAX_EXPORT_PIXELS)) return false;
    dispatch({ type: 'SET_RESIZE_OPTIONS', options: { width, height }, apply: true });
    return true;
  };

  return (
    <OptionPopover
      label={`${locale.resize}: ${sizeLabel}`}
      summary={sizeLabel}
      testId="inkio-ie-resize-dimensions-trigger"
    >
      <DimensionsField
        width={resizeOptions.width}
        height={resizeOptions.height}
        lockAspectRatio={resizeOptions.lockAspectRatio}
        widthLabel={locale.width}
        heightLabel={locale.height}
        lockLabel={locale.lockAspectRatio}
        invalidMessage={locale.outputSizeError}
        onWidthChange={(value) => changeDimension('width', value)}
        onHeightChange={(value) => changeDimension('height', value)}
        onFocus={() => { aspectRatioRef.current = null; }}
        onCommit={() => dispatch({ type: 'COMMIT_RESIZE_SESSION' })}
        onToggleLock={() => dispatch({
          type: 'SET_RESIZE_OPTIONS',
          options: { lockAspectRatio: !resizeOptions.lockAspectRatio },
        })}
        widthTestId="inkio-ie-resize-width"
        heightTestId="inkio-ie-resize-height"
        lockTestId="inkio-ie-resize-lock-aspect"
      />
    </OptionPopover>
  );
}
