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
    <div className="inkio-ie-toolbar">
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
