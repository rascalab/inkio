import React, { useCallback } from 'react';
import { useImageEditor } from '../../hooks/useImageEditor';
import { LockIcon, UnlockIcon } from '../../icons';

export function ResizeOptions() {
  const { state, dispatch, locale } = useImageEditor();
  const { resizeOptions, originalWidth, originalHeight } = state;

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newWidth = parseInt(e.target.value, 10);
      if (isNaN(newWidth) || newWidth <= 0) return;
      if (resizeOptions.lockAspectRatio && originalWidth > 0) {
        const ratio = originalHeight / originalWidth;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          options: { width: newWidth, height: Math.round(newWidth * ratio) },
        });
      } else {
        dispatch({ type: 'SET_RESIZE_OPTIONS', options: { width: newWidth } });
      }
    },
    [resizeOptions.lockAspectRatio, originalWidth, originalHeight, dispatch],
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newHeight = parseInt(e.target.value, 10);
      if (isNaN(newHeight) || newHeight <= 0) return;
      if (resizeOptions.lockAspectRatio && originalHeight > 0) {
        const ratio = originalWidth / originalHeight;
        dispatch({
          type: 'SET_RESIZE_OPTIONS',
          options: { height: newHeight, width: Math.round(newHeight * ratio) },
        });
      } else {
        dispatch({ type: 'SET_RESIZE_OPTIONS', options: { height: newHeight } });
      }
    },
    [resizeOptions.lockAspectRatio, originalWidth, originalHeight, dispatch],
  );

  const handleApply = useCallback(() => {
    dispatch({
      type: 'APPLY_RESIZE',
      size: { width: resizeOptions.width, height: resizeOptions.height },
    });
  }, [dispatch, resizeOptions]);

  return (
    <div className="inkio-ie-options-section">
      <div className="inkio-ie-options-row inkio-ie-options-row--gap">
        <div className="inkio-ie-field">
          <label className="inkio-ie-field-label">{locale.width}</label>
          <input
            type="number"
            className="inkio-ie-field-input"
            value={resizeOptions.width}
            onChange={handleWidthChange}
            min={1}
          />
        </div>
        <div className="inkio-ie-field">
          <label className="inkio-ie-field-label">{locale.height}</label>
          <input
            type="number"
            className="inkio-ie-field-input"
            value={resizeOptions.height}
            onChange={handleHeightChange}
            min={1}
          />
        </div>
        <button
          type="button"
          className={`inkio-ie-icon-btn${resizeOptions.lockAspectRatio ? ' is-active' : ''}`}
          title={locale.lockAspectRatio}
          onClick={() =>
            dispatch({
              type: 'SET_RESIZE_OPTIONS',
              options: { lockAspectRatio: !resizeOptions.lockAspectRatio },
            })
          }
        >
          {resizeOptions.lockAspectRatio ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
      </div>
      <button
        type="button"
        className="inkio-ie-action-btn inkio-ie-action-btn--primary"
        onClick={handleApply}
      >
        {locale.apply}
      </button>
    </div>
  );
};
