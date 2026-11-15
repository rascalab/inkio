import { useCallback, useRef } from 'react';
import { useImageEditor } from '../../hooks/use-image-editor';
import { ASPECT_RATIO_PRESETS } from '../../constants';
import { getDefaultCropRect } from '../../utils/crop';
import { isQuarterTurn } from '../../utils/geometry';
import { OptionPopover } from '../OptionPopover';
import type { ViewportKind } from '../../utils/controls-model';
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
  const { resizeOptions, transform } = state;
  const aspectRatioRef = useRef<number | null>(null);
  const effectiveCrop = state.pendingCrop ?? transform.crop;
  const cropBounds = transform.crop ?? {
    x: 0,
    y: 0,
    width: state.originalWidth,
    height: state.originalHeight,
  };

  const handleWidthChange = useCallback(
    (nextWidth: number) => {
      if (Number.isNaN(nextWidth) || nextWidth <= 0) {
        return;
      }

      if (resizeOptions.lockAspectRatio && resizeOptions.width > 0) {
        const ratio = aspectRatioRef.current ?? resizeOptions.width / resizeOptions.height;
        aspectRatioRef.current = ratio;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          apply: true,
          options: {
            width: nextWidth,
            height: Math.max(1, Math.round(nextWidth / ratio)),
          },
        });
        return;
      }

      dispatch({ type: 'SET_RESIZE_OPTIONS', options: { width: nextWidth }, apply: true });
    },
    [dispatch, resizeOptions.height, resizeOptions.lockAspectRatio, resizeOptions.width],
  );

  const handleHeightChange = useCallback(
    (nextHeight: number) => {
      if (Number.isNaN(nextHeight) || nextHeight <= 0) {
        return;
      }

      if (resizeOptions.lockAspectRatio && resizeOptions.height > 0) {
        const ratio = aspectRatioRef.current ?? resizeOptions.width / resizeOptions.height;
        aspectRatioRef.current = ratio;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          apply: true,
          options: {
            height: nextHeight,
            width: Math.max(1, Math.round(nextHeight * ratio)),
          },
        });
        return;
      }

      dispatch({ type: 'SET_RESIZE_OPTIONS', options: { height: nextHeight }, apply: true });
    },
    [dispatch, resizeOptions.height, resizeOptions.lockAspectRatio, resizeOptions.width],
  );

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
  const sizeLabel = `${resizeOptions.width} × ${resizeOptions.height}`;

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
      <PanelSection>
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
          onWidthChange={handleWidthChange}
          onHeightChange={handleHeightChange}
          onFocus={() => { aspectRatioRef.current = null; }}
          onCommit={() => dispatch({ type: 'COMMIT_RESIZE_SESSION' })}
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
        </OptionPopover>
      </PanelSection>
    </ToolPanel>
  );
}
