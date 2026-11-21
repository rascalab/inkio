import React from 'react';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export function ToolButton({
  icon,
  label,
  isActive = false,
  onClick,
  disabled = false,
  className = 'inkio-ie-toolbar-btn',
  testId,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-testid={testId}
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
      className={`${className}${isActive ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      {icon != null && <span className="inkio-ie-toolbar-btn-icon" aria-hidden="true">{icon}</span>}
      <span className="inkio-ie-toolbar-btn-label">{label}</span>
    </button>
  );
}
