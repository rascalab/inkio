import { useCallback } from 'react';
import { useImageEditor } from '../../hooks/use-image-editor';
import { ASPECT_RATIO_PRESETS } from '../../constants';
import { getDefaultCropRect } from '../../utils/crop';
import { getTransformedDimensions } from '../../utils/geometry';
import {
  ApplyResetGroup,
  ControlCard,
  InlineValue,
  PresetChipGroup,
  ResizeDimensionGroup,
} from '../control-groups';

export function ResizeOptions() {
  const { state, dispatch, locale } = useImageEditor();
  const { resizeOptions, transform, outputSize } = state;
  const effectiveCrop = state.pendingCrop ?? transform.crop;
  const appliedSize = getTransformedDimensions(
    state.originalWidth,
    state.originalHeight,
    transform,
    outputSize,
  );
  const cropBounds = transform.crop ?? {
    x: 0,
    y: 0,
    width: appliedSize.width,
    height: appliedSize.height,
  };

  const handleWidthChange = useCallback(
    (nextWidth: number) => {
      if (Number.isNaN(nextWidth) || nextWidth <= 0) {
        return;
      }

      if (resizeOptions.lockAspectRatio && resizeOptions.width > 0) {
        const ratio = resizeOptions.height / resizeOptions.width;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          options: {
            width: nextWidth,
            height: Math.max(1, Math.round(nextWidth * ratio)),
          },
        });
        return;
      }

      dispatch({ type: 'SET_RESIZE_OPTIONS', options: { width: nextWidth } });
    },
    [dispatch, resizeOptions.height, resizeOptions.lockAspectRatio, resizeOptions.width],
  );

  const handleHeightChange = useCallback(
    (nextHeight: number) => {
      if (Number.isNaN(nextHeight) || nextHeight <= 0) {
        return;
      }

      if (resizeOptions.lockAspectRatio && resizeOptions.height > 0) {
        const ratio = resizeOptions.width / resizeOptions.height;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          options: {
            height: nextHeight,
            width: Math.max(1, Math.round(nextHeight * ratio)),
          },
        });
        return;
      }

      dispatch({ type: 'SET_RESIZE_OPTIONS', options: { height: nextHeight } });
    },
    [dispatch, resizeOptions.height, resizeOptions.lockAspectRatio, resizeOptions.width],
  );

  const handleCropPreset = useCallback(
    (aspectRatio: number | null) => {
      const nextCrop = getDefaultCropRect(cropBounds.width, cropBounds.height, aspectRatio);
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
    [cropBounds.height, cropBounds.width, cropBounds.x, cropBounds.y, dispatch],
  );

  return (
    <>
      <PresetChipGroup
        label={locale.cropArea}
        items={ASPECT_RATIO_PRESETS.map((preset) => ({
          key: String(preset.label ?? preset.labelKey),
          label: preset.label ?? locale[preset.labelKey],
          active: state.cropOptions.aspectRatio === preset.value,
          onClick: () => handleCropPreset(preset.value),
          testId: `inkio-ie-crop-preset-${String(preset.label ?? preset.labelKey).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
        }))}
      />
      {effectiveCrop && (
        <ControlCard label={locale.cropPendingNotice}>
          <InlineValue
            label={locale.cropArea}
            value={`${Math.round(effectiveCrop.width)} × ${Math.round(effectiveCrop.height)}`}
          />
        </ControlCard>
      )}
      <ResizeDimensionGroup
        width={resizeOptions.width}
        height={resizeOptions.height}
        lockAspectRatio={resizeOptions.lockAspectRatio}
        widthLabel={locale.width}
        heightLabel={locale.height}
        lockLabel={locale.lockAspectRatio}
        onWidthChange={handleWidthChange}
        onHeightChange={handleHeightChange}
        onToggleLock={() =>
          dispatch({
            type: 'SET_RESIZE_OPTIONS',
            options: { lockAspectRatio: !resizeOptions.lockAspectRatio },
          })
        }
        widthTestId="inkio-ie-resize-width"
        heightTestId="inkio-ie-resize-height"
        lockTestId="inkio-ie-resize-lock-aspect"
      />
      <ApplyResetGroup
        label={locale.resize}
        applyLabel={locale.apply}
        resetLabel={locale.reset}
        applyTestId="inkio-ie-resize-apply"
        resetTestId="inkio-ie-resize-reset"
        onApply={() => dispatch({ type: 'COMMIT_RESIZE_SESSION' })}
        onReset={() => dispatch({ type: 'RESET_RESIZE_SESSION' })}
      />
    </>
  );
}
