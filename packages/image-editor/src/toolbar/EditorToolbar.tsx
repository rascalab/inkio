import React from 'react';
import { ToolButton } from './ToolButton';
import {
  RotateCWIcon,
  ResizeIcon,
  PencilIcon,
  ShapesIcon,
  TypeIcon,
  UndoIcon,
  RedoIcon,
} from '../icons';
import type { EnabledToolType, ImageEditorLocale } from '../types';

export const TOOL_ICONS: Record<EnabledToolType, React.ComponentType<{ size?: number; className?: string }>> = {
  rotate: RotateCWIcon,
  resize: ResizeIcon,
  draw: PencilIcon,
  shape: ShapesIcon,
  text: TypeIcon,
};

interface EditorToolbarProps {
  activeTool: EnabledToolType | null;
  enabledTools: EnabledToolType[];
  locale: ImageEditorLocale;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: EnabledToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const TOOL_LOCALE_KEYS: Record<EnabledToolType, keyof ImageEditorLocale> = {
  rotate: 'rotate',
  resize: 'resize',
  draw: 'draw',
  shape: 'shapes',
  text: 'text',
};

export function EditorToolbar({
  activeTool,
  enabledTools,
  locale,
  canUndo,
  canRedo,
  onToolChange,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  return (
    <div className="inkio-ie-toolbar">
      <div
        className="inkio-ie-toolbar-group inkio-ie-toolbar-group--history"
        data-testid="inkio-ie-toolbar-history"
      >
        <ToolButton
          icon={<UndoIcon size={18} />}
          label={locale.undo}
          onClick={onUndo}
          disabled={!canUndo}
          testId="inkio-ie-undo"
        />
        <ToolButton
          icon={<RedoIcon size={18} />}
          label={locale.redo}
          onClick={onRedo}
          disabled={!canRedo}
          testId="inkio-ie-redo"
        />
      </div>

      <div className="inkio-ie-toolbar-divider" />

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
