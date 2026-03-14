import React from 'react';
import { ToolButton } from './ToolButton';
import {
  CropIcon,
  RotateCWIcon,
  ResizeIcon,
  PencilIcon,
  ShapesIcon,
  TypeIcon,
  UndoIcon,
  RedoIcon,
} from '../icons';
import type { ToolType, ImageEditorLocale } from '../types';

const TOOL_ICONS: Record<ToolType, React.ComponentType<{ size?: number; className?: string }>> = {
  crop: CropIcon,
  rotate: RotateCWIcon,
  resize: ResizeIcon,
  draw: PencilIcon,
  shape: ShapesIcon,
  text: TypeIcon,
};

interface EditorToolbarProps {
  activeTool: ToolType | null;
  enabledTools: ToolType[];
  locale: ImageEditorLocale;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOL_LOCALE_KEYS: Record<ToolType, keyof ImageEditorLocale> = {
  crop: 'crop',
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
      <div className="inkio-ie-toolbar-group">
        <ToolButton
          icon={<UndoIcon size={18} />}
          label={locale.undo}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolButton
          icon={<RedoIcon size={18} />}
          label={locale.redo}
          onClick={onRedo}
          disabled={!canRedo}
        />
      </div>

      <div className="inkio-ie-toolbar-divider" />

      <div className="inkio-ie-toolbar-group">
        {enabledTools.map((tool) => {
          const IconComponent = TOOL_ICONS[tool];
          return (
            <ToolButton
              key={tool}
              icon={<IconComponent size={18} />}
              label={locale[TOOL_LOCALE_KEYS[tool]] as string}
              isActive={activeTool === tool}
              onClick={() => onToolChange(tool)}
            />
          );
        })}
      </div>
    </div>
  );
};
