import React from 'react';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export function ToolButton({
  icon,
  label,
  isActive = false,
  onClick,
  disabled = false,
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
      className={`inkio-ie-toolbar-btn${isActive ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      {icon}
      <span className="inkio-ie-toolbar-btn-label">{label}</span>
    </button>
  );
}
