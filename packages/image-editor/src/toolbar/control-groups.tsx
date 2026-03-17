import { useId } from 'react';
import { BoldIcon, CloseIcon, ItalicIcon, LockIcon, UnlockIcon } from '../icons';
import { ColorPickerButton } from './options/ColorPickerButton';

interface ControlCardProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function ControlCard({ label, children, className }: ControlCardProps) {
  return (
    <section className={`inkio-ie-control-card${className ? ` ${className}` : ''}`}>
      <header className="inkio-ie-control-card-header">
        <span className="inkio-ie-control-card-label">{label}</span>
      </header>
      <div className="inkio-ie-control-card-body">{children}</div>
    </section>
  );
}

interface PresetChipGroupItem {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}

interface PresetChipGroupProps {
  label: string;
  items: PresetChipGroupItem[];
}

export function PresetChipGroup({ label, items }: PresetChipGroupProps) {
  return (
    <ControlCard label={label}>
      <div className="inkio-ie-chip-row">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`inkio-ie-chip${item.active ? ' is-active' : ''}`}
            onClick={item.onClick}
            data-testid={item.testId}
          >
            {item.label}
          </button>
        ))}
      </div>
    </ControlCard>
  );
}

interface ColorSwatchGroupProps {
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

export function ColorSwatchGroup({
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
}: ColorSwatchGroupProps) {
  return (
    <ControlCard label={label}>
      <div className="inkio-ie-control-stack">
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
      </div>
    </ControlCard>
  );
}

interface SelectFieldGroupOption {
  label: string;
  value: string;
}

interface SelectFieldGroupProps {
  label: string;
  value: string;
  options: SelectFieldGroupOption[];
  testId?: string;
  onChange: (value: string) => void;
}

export function SelectFieldGroup({
  label,
  value,
  options,
  testId,
  onChange,
}: SelectFieldGroupProps) {
  return (
    <ControlCard label={label}>
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
    </ControlCard>
  );
}

interface RangeFieldGroupProps {
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

export function RangeFieldGroup({
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
}: RangeFieldGroupProps) {
  const inputId = useId();

  return (
    <ControlCard label={label}>
      <div className="inkio-ie-control-stack">
        <label htmlFor={inputId} className="inkio-ie-range-field-label">
          <span>{label}</span>
          <span className="inkio-ie-range-field-value">{valueLabel}</span>
        </label>
        <div className="inkio-ie-range-row">
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
    </ControlCard>
  );
}

interface ResizeDimensionGroupProps {
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

export function ResizeDimensionGroup({
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
}: ResizeDimensionGroupProps) {
  return (
    <ControlCard label={widthLabel}>
      <div className="inkio-ie-control-stack">
        <label className="inkio-ie-field">
          <span className="inkio-ie-field-label">{widthLabel}</span>
          <input
            type="number"
            className="inkio-ie-field-input"
            data-testid={widthTestId}
            min={1}
            value={width}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              if (Number.isNaN(nextValue) || nextValue <= 0) {
                return;
              }

              onWidthChange(nextValue);
            }}
          />
        </label>
        <label className="inkio-ie-field">
          <span className="inkio-ie-field-label">{heightLabel}</span>
          <input
            type="number"
            className="inkio-ie-field-input"
            data-testid={heightTestId}
            min={1}
            value={height}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              if (Number.isNaN(nextValue) || nextValue <= 0) {
                return;
              }

              onHeightChange(nextValue);
            }}
          />
        </label>
        <button
          type="button"
          className={`inkio-ie-inline-toggle${lockAspectRatio ? ' is-active' : ''}`}
          aria-pressed={lockAspectRatio}
          onClick={onToggleLock}
          data-testid={lockTestId}
        >
          {lockAspectRatio ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
          <span>{lockLabel}</span>
        </button>
      </div>
    </ControlCard>
  );
}

interface ApplyResetGroupProps {
  label: string;
  applyLabel: string;
  resetLabel: string;
  onApply: () => void;
  onReset: () => void;
  applyTestId?: string;
  resetTestId?: string;
}

export function ApplyResetGroup({
  label,
  applyLabel,
  resetLabel,
  onApply,
  onReset,
  applyTestId,
  resetTestId,
}: ApplyResetGroupProps) {
  return (
    <ControlCard label={label}>
      <div className="inkio-ie-action-row">
        <button
          type="button"
          className="inkio-ie-icon-action-btn"
          title={resetLabel}
          aria-label={resetLabel}
          onClick={onReset}
          data-testid={resetTestId}
        >
          <CloseIcon size={16} />
        </button>
        <button
          type="button"
          className="inkio-ie-action-btn inkio-ie-action-btn--primary inkio-ie-action-btn--grow"
          onClick={onApply}
          data-testid={applyTestId}
        >
          {applyLabel}
        </button>
      </div>
    </ControlCard>
  );
}

interface TextStyleGroupProps {
  label: string;
  isBold: boolean;
  isItalic: boolean;
  boldLabel: string;
  italicLabel: string;
  onToggleBold: () => void;
  onToggleItalic: () => void;
}

export function TextStyleGroup({
  label,
  isBold,
  isItalic,
  boldLabel,
  italicLabel,
  onToggleBold,
  onToggleItalic,
}: TextStyleGroupProps) {
  return (
    <ControlCard label={label}>
      <div className="inkio-ie-action-row">
        <button
          type="button"
          className={`inkio-ie-icon-action-btn${isBold ? ' is-active' : ''}`}
          title={boldLabel}
          aria-label={boldLabel}
          onClick={onToggleBold}
        >
          <BoldIcon size={16} />
        </button>
        <button
          type="button"
          className={`inkio-ie-icon-action-btn${isItalic ? ' is-active' : ''}`}
          title={italicLabel}
          aria-label={italicLabel}
          onClick={onToggleItalic}
        >
          <ItalicIcon size={16} />
        </button>
      </div>
    </ControlCard>
  );
}

interface LayerOrderGroupProps {
  label: string;
  items: Array<{
    key: string;
    label: string;
    testId?: string;
    disabled?: boolean;
    onClick: () => void;
  }>;
}

export function LayerOrderGroup({ label, items }: LayerOrderGroupProps) {
  return (
    <ControlCard label={label}>
      <div className="inkio-ie-chip-row">
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
    </ControlCard>
  );
}

interface RotateActionGroupProps {
  label: string;
  actions: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    testId?: string;
    onClick: () => void;
  }>;
}

export function RotateActionGroup({ label, actions }: RotateActionGroupProps) {
  return (
    <ControlCard label={label} className="inkio-ie-control-card--compact">
      <div className="inkio-ie-action-row inkio-ie-action-row--wrap">
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
    </ControlCard>
  );
}

interface InlineValueProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export function InlineValue({ label, value, icon }: InlineValueProps) {
  return (
    <div className="inkio-ie-inline-value">
      <span className="inkio-ie-inline-value-label">{label}</span>
      <span className="inkio-ie-inline-value-content">
        {icon ? <span className="inkio-ie-inline-value-icon">{icon}</span> : null}
        {value}
      </span>
    </div>
  );
}
