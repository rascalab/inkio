import { useId } from 'react';
import { BoldIcon, CloseIcon, ItalicIcon, LockIcon, UnlockIcon } from '../icons';
import { ColorPickerButton } from './options/ColorPickerButton';

/**
 * Pintura-style inspector primitives. Each tool renders ONE ToolPanel with
 * labeled sections — never a strip of cards — so the util panel stays
 * compact and scannable. All data-testids are preserved for e2e.
 */

interface ToolPanelProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ToolPanel({ title, actions, children }: ToolPanelProps) {
  return (
    <section className="inkio-ie-tool-panel">
      <header className="inkio-ie-tool-panel-header">
        <span className="inkio-ie-tool-panel-title">{title}</span>
        {actions && <span className="inkio-ie-tool-panel-actions">{actions}</span>}
      </header>
      <div className="inkio-ie-tool-panel-body">{children}</div>
    </section>
  );
}

interface PanelSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function PanelSection({ label, children, className }: PanelSectionProps) {
  return (
    <div className={`inkio-ie-tool-section${className ? ` ${className}` : ''}`}>
      {label && <span className="inkio-ie-tool-section-label">{label}</span>}
      {children}
    </div>
  );
}

export interface SegmentedItem {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
  title?: string;
}

export function SegmentedControl({ items, label }: { items: SegmentedItem[]; label: string }) {
  return (
    <div className="inkio-ie-segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`inkio-ie-segmented-btn${item.active ? ' is-active' : ''}`}
          onClick={item.onClick}
          title={item.title ?? item.label}
          aria-label={item.title ?? item.label}
          aria-pressed={item.active}
          data-testid={item.testId}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onPreviewChange: (value: number) => void;
  onCommitChange?: (value: number) => void;
  onDirectChange: (value: number) => void;
  rangeTestId?: string;
  numberTestId?: string;
}

export function SliderRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onPreviewChange,
  onCommitChange,
  onDirectChange,
  rangeTestId,
  numberTestId,
}: SliderRowProps) {
  const inputId = useId();

  return (
    <div className="inkio-ie-slider-row">
      <label htmlFor={inputId} className="inkio-ie-slider-label">
        <span>{label}</span>
        <span className="inkio-ie-slider-value">{valueLabel}</span>
      </label>
      <div className="inkio-ie-slider-control">
        <input
          id={inputId}
          type="range"
          className="inkio-ie-range-input"
          data-testid={rangeTestId}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onPreviewChange(Number(event.target.value))}
          onPointerUp={(event) => onCommitChange?.(Number((event.target as HTMLInputElement).value))}
          onKeyUp={(event) => onCommitChange?.(Number((event.target as HTMLInputElement).value))}
        />
        <input
          type="number"
          className="inkio-ie-range-number"
          data-testid={numberTestId}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isNaN(nextValue)) {
              return;
            }

            onDirectChange(nextValue);
          }}
          aria-label={`${label} value`}
        />
      </div>
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
  pickerTestId?: string;
  allowTransparent?: boolean;
  enableAlpha?: boolean;
  transparentLabel?: string;
  transparentTestId?: string;
  hexLabel?: string;
  alphaLabel?: string;
  paletteLabel?: string;
}

export function ColorField({
  label,
  value,
  presets,
  onChange,
  pickerTestId,
  allowTransparent = false,
  enableAlpha = true,
  transparentLabel,
  transparentTestId,
  hexLabel = 'Hex color',
  alphaLabel = 'Opacity',
  paletteLabel = 'Color palette',
}: ColorFieldProps) {
  return (
    <ColorPickerButton
      value={value}
      label={label}
      testId={pickerTestId}
      presets={presets}
      allowTransparent={allowTransparent}
      enableAlpha={enableAlpha}
      transparentLabel={transparentLabel}
      transparentTestId={transparentTestId}
      hexLabel={hexLabel}
      alphaLabel={alphaLabel}
      paletteLabel={paletteLabel}
      onChange={onChange}
    />
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  testId?: string;
  onChange: (value: string) => void;
}

export function SelectField({ label, value, options, testId, onChange }: SelectFieldProps) {
  return (
    <label className="inkio-ie-field">
      <span className="inkio-ie-field-label">{label}</span>
      <select
        className="inkio-ie-field-input inkio-ie-select-input"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface DimensionsFieldProps {
  width: number;
  height: number;
  lockAspectRatio: boolean;
  widthLabel: string;
  heightLabel: string;
  lockLabel: string;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onToggleLock: () => void;
  widthTestId?: string;
  heightTestId?: string;
  lockTestId?: string;
}

function DimensionInput({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  testId?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="inkio-ie-field">
      <span className="inkio-ie-field-label">{label}</span>
      <input
        type="number"
        className="inkio-ie-field-input"
        data-testid={testId}
        min={1}
        value={value}
        onChange={(event) => {
          const nextValue = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(nextValue) || nextValue <= 0) {
            return;
          }

          onChange(nextValue);
        }}
      />
    </label>
  );
}

export function DimensionsField({
  width,
  height,
  lockAspectRatio,
  widthLabel,
  heightLabel,
  lockLabel,
  onWidthChange,
  onHeightChange,
  onToggleLock,
  widthTestId,
  heightTestId,
  lockTestId,
}: DimensionsFieldProps) {
  return (
    <div className="inkio-ie-field-row">
      <DimensionInput label={widthLabel} value={width} testId={widthTestId} onChange={onWidthChange} />
      <DimensionInput label={heightLabel} value={height} testId={heightTestId} onChange={onHeightChange} />
      <button
        type="button"
        className={`inkio-ie-inline-toggle${lockAspectRatio ? ' is-active' : ''}`}
        aria-pressed={lockAspectRatio}
        title={lockLabel}
        aria-label={lockLabel}
        onClick={onToggleLock}
        data-testid={lockTestId}
      >
        {lockAspectRatio ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
      </button>
    </div>
  );
}

interface IconActionRowProps {
  label: string;
  actions: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    testId?: string;
    onClick: () => void;
  }>;
}

export function IconActionRow({ label, actions }: IconActionRowProps) {
  return (
    <div className="inkio-ie-icon-action-row" role="group" aria-label={label}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="inkio-ie-icon-action-btn"
          title={action.label}
          aria-label={action.label}
          data-testid={action.testId}
          onClick={action.onClick}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

interface LayerOrderRowProps {
  label: string;
  items: Array<{
    key: string;
    label: string;
    testId?: string;
    disabled?: boolean;
    onClick: () => void;
  }>;
}

export function LayerOrderRow({ label, items }: LayerOrderRowProps) {
  return (
    <div className="inkio-ie-layer-row" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="inkio-ie-chip"
          onClick={item.onClick}
          disabled={item.disabled}
          data-testid={item.testId}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface TextStyleRowProps {
  isBold: boolean;
  isItalic: boolean;
  boldLabel: string;
  italicLabel: string;
  onToggleBold: () => void;
  onToggleItalic: () => void;
}

export function TextStyleRow({
  isBold,
  isItalic,
  boldLabel,
  italicLabel,
  onToggleBold,
  onToggleItalic,
}: TextStyleRowProps) {
  return (
    <div className="inkio-ie-text-style-row">
      <button
        type="button"
        className={`inkio-ie-icon-action-btn${isBold ? ' is-active' : ''}`}
        title={boldLabel}
        aria-label={boldLabel}
        aria-pressed={isBold}
        onClick={onToggleBold}
      >
        <BoldIcon size={16} />
      </button>
      <button
        type="button"
        className={`inkio-ie-icon-action-btn${isItalic ? ' is-active' : ''}`}
        title={italicLabel}
        aria-label={italicLabel}
        aria-pressed={isItalic}
        onClick={onToggleItalic}
      >
        <ItalicIcon size={16} />
      </button>
    </div>
  );
}

interface HeaderActionButtonProps {
  label: string;
  testId?: string;
  onClick: () => void;
}

export function PanelPrimaryButton({ label, testId, onClick }: HeaderActionButtonProps) {
  return (
    <button
      type="button"
      className="inkio-ie-action-btn inkio-ie-action-btn--primary inkio-ie-action-btn--compact"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

export function PanelIconButton({
  label,
  testId,
  onClick,
}: HeaderActionButtonProps) {
  return (
    <button
      type="button"
      className="inkio-ie-icon-action-btn inkio-ie-icon-action-btn--compact"
      title={label}
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
    >
      <CloseIcon size={14} />
    </button>
  );
}
