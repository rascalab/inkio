import { useId, useRef, useState } from 'react';
import { BoldIcon, CloseIcon, ItalicIcon, LockIcon, UnlockIcon } from '../icons';
import { OptionPopover } from './OptionPopover';

/** Shared labeled controls for the contextual tool options. */

interface ToolPanelProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ToolPanel({ title, actions, children }: ToolPanelProps) {
  return (
    <section className="inkio-ie-tool-panel" aria-label={title}>
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
  presentation?: 'inline' | 'popover';
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number, preview?: boolean) => void;
  commitOnRelease?: boolean;
  rangeTestId?: string;
  numberTestId?: string;
}

export function SliderRow({
  presentation = 'inline',
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  commitOnRelease,
  rangeTestId,
  numberTestId,
}: SliderRowProps) {
  const inputId = useId();
  const commitRange = commitOnRelease
    ? (event: React.SyntheticEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value))
    : undefined;

  const control = (
    <div className="inkio-ie-slider-row">
      <label htmlFor={inputId} className="inkio-ie-slider-label">
        <span>{label}</span>
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
          aria-valuetext={valueLabel}
          onChange={(event) => onChange(Number(event.target.value), true)}
          onPointerUp={commitRange}
          onKeyUp={commitRange}
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

            onChange(nextValue);
          }}
          aria-label={`${label} value`}
        />
      </div>
    </div>
  );

  return presentation === 'popover' ? (
    <OptionPopover
      label={`${label}: ${valueLabel}`}
      summary={<>{label}<span className="inkio-ie-option-value">{valueLabel}</span></>}
      testId={rangeTestId ? `${rangeTestId}-trigger` : undefined}
    >
      {control}
    </OptionPopover>
  ) : control;
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
  invalidMessage?: string;
  onWidthChange: (value: number) => boolean;
  onHeightChange: (value: number) => boolean;
  onToggleLock: () => void;
  onFocus?: () => void;
  onCommit?: () => void;
  widthTestId?: string;
  heightTestId?: string;
  lockTestId?: string;
}

function DimensionInput({
  label,
  invalidMessage,
  value,
  testId,
  onChange,
  onFocus,
  onCommit,
}: {
  label: string;
  invalidMessage?: string;
  value: number;
  testId?: string;
  onChange: (value: number) => boolean;
  onFocus?: () => void;
  onCommit?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const changedRef = useRef(false);

  return (
    <label className="inkio-ie-field">
      <span className="inkio-ie-field-label">{label}</span>
      <input
        type="number"
        className="inkio-ie-field-input"
        aria-label={label}
        data-testid={testId}
        min={1}
        step={1}
        aria-invalid={invalid || undefined}
        value={editing ? draft : Math.round(value)}
        onFocus={() => {
          onFocus?.();
          setDraft(String(Math.round(value)));
          setEditing(true);
          setInvalid(false);
          changedRef.current = false;
        }}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const nextValue = Number(text);
          if (!text || !Number.isFinite(nextValue) || nextValue <= 0) {
            setInvalid(Boolean(text));
            return;
          }
          const valid = onChange(Math.max(1, Math.round(nextValue)));
          setInvalid(!valid);
          changedRef.current ||= valid;
        }}
        onBlur={() => {
          setEditing(false);
          setInvalid(false);
          if (changedRef.current) onCommit?.();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (changedRef.current) onCommit?.();
          changedRef.current = false;
          setDraft(String(value));
          setInvalid(false);
        }}
      />
      {invalid && invalidMessage && (
        <span className="inkio-ie-field-error" role="alert">{invalidMessage}</span>
      )}
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
  invalidMessage,
  onWidthChange,
  onHeightChange,
  onToggleLock,
  onFocus,
  onCommit,
  widthTestId,
  heightTestId,
  lockTestId,
}: DimensionsFieldProps) {
  return (
    <div className="inkio-ie-field-row">
      <DimensionInput label={widthLabel} invalidMessage={invalidMessage} value={width} testId={widthTestId} onChange={onWidthChange} onFocus={onFocus} onCommit={onCommit} />
      <DimensionInput label={heightLabel} invalidMessage={invalidMessage} value={height} testId={heightTestId} onChange={onHeightChange} onFocus={onFocus} onCommit={onCommit} />
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
