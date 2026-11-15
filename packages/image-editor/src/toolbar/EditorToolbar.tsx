import React from 'react';
import { ToolButton } from './ToolButton';
import {
  RotateCWIcon,
  ResizeIcon,
  PencilIcon,
  ShapesIcon,
  TypeIcon,
  FilterIcon,
  RedactIcon,
  StickerIcon,
} from '../icons';
import type { EnabledToolType, ImageEditorLocale } from '../types';

export const TOOL_ICONS: Record<EnabledToolType, React.ComponentType<{ size?: number; className?: string }>> = {
  rotate: RotateCWIcon,
  resize: ResizeIcon,
  draw: PencilIcon,
  shape: ShapesIcon,
  text: TypeIcon,
  filter: FilterIcon,
  redact: RedactIcon,
  sticker: StickerIcon,
};

interface EditorToolbarProps {
  activeTool: EnabledToolType | null;
  enabledTools: EnabledToolType[];
  locale: ImageEditorLocale;
  onToolChange: (tool: EnabledToolType) => void;
}

export const TOOL_LOCALE_KEYS: Record<EnabledToolType, keyof ImageEditorLocale> = {
  rotate: 'rotate',
  resize: 'resize',
  draw: 'draw',
  shape: 'shapes',
  text: 'text',
  filter: 'filter',
  redact: 'redact',
  sticker: 'sticker',
};

export function EditorToolbar({
  activeTool,
  enabledTools,
  locale,
  onToolChange,
}: EditorToolbarProps) {
  return (
    <div
      className="inkio-ie-toolbar"
      role="toolbar"
      aria-label={locale.toolsLabel ?? 'Image editor tools'}
      aria-orientation="vertical"
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const current = buttons.findIndex((button) => button === document.activeElement);
        const next = event.key === 'Home' ? 0
          : event.key === 'End' ? buttons.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
        event.preventDefault();
        buttons[next]?.focus();
      }}
    >
      <div
        className="inkio-ie-toolbar-group inkio-ie-toolbar-group--tools"
        data-testid="inkio-ie-toolbar-tools"
      >
        {enabledTools.map((tool) => {
          const IconComponent = TOOL_ICONS[tool];
          return (
            <ToolButton
              key={tool}
              icon={<IconComponent size={18} />}
              label={locale[TOOL_LOCALE_KEYS[tool]] as string}
              isActive={activeTool === tool}
              onClick={() => onToolChange(tool)}
              testId={`inkio-ie-tool-${tool}`}
            />
          );
        })}
      </div>
    </div>
  );
};
