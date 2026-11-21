import type { ComponentType } from 'react';
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
import { getImageEditorToolId, type ResolvedImageEditorTool } from '../utils/tooling';
import type { ViewportKind } from '../utils/controls-model';

const TOOL_ICONS: Record<EnabledToolType, ComponentType<{ size?: number; className?: string }>> = {
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
  activeTool: string | null;
  enabledTools: readonly ResolvedImageEditorTool[];
  locale: ImageEditorLocale;
  onToolChange: (tool: ResolvedImageEditorTool) => void;
  viewportKind?: ViewportKind;
  disabled?: boolean;
}

const TOOL_LOCALE_KEYS: Record<EnabledToolType, keyof ImageEditorLocale> = {
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
  viewportKind = 'desktop',
  disabled = false,
}: EditorToolbarProps) {
  const mobile = viewportKind === 'mobile';
  const buttons = enabledTools.map((tool) => {
    const id = getImageEditorToolId(tool);
    const Icon = typeof tool === 'string' ? TOOL_ICONS[tool] : null;
    const label = typeof tool === 'string' ? locale[TOOL_LOCALE_KEYS[tool]] as string : tool.label;
    return (
      <ToolButton
        key={id}
        icon={typeof tool === 'string' ? (Icon && <Icon size={18} />) : tool.icon}
        label={label}
        isActive={activeTool === id}
        disabled={disabled}
        className={mobile ? 'inkio-ie-mobile-tool-btn' : undefined}
        onClick={() => onToolChange(tool)}
        testId={`inkio-ie-tool-${id}`}
      />
    );
  });

  const toolbar = (
    <div
      className={mobile ? 'inkio-ie-mobile-tool-tray' : 'inkio-ie-toolbar'}
      data-testid={mobile ? 'inkio-ie-mobile-tool-tray' : undefined}
      role="toolbar"
      aria-label={locale.toolsLabel ?? 'Image editor tools'}
      aria-orientation={mobile ? 'horizontal' : 'vertical'}
      onKeyDown={(event) => {
        const previous = mobile ? 'ArrowLeft' : 'ArrowUp';
        const next = mobile ? 'ArrowRight' : 'ArrowDown';
        const { key } = event;
        if (key !== previous && key !== next && key !== 'Home' && key !== 'End') return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const current = buttons.findIndex((button) => button === event.target);
        if (current === -1) return;
        const rtl = mobile && getComputedStyle(event.currentTarget).direction === 'rtl';
        const direction = (key === next) !== rtl ? 1 : -1;
        const index = key === 'Home' ? 0
          : key === 'End' ? buttons.length - 1
            : (current + direction + buttons.length) % buttons.length;
        event.preventDefault();
        buttons[index]?.focus();
      }}
    >
      {mobile ? buttons : (
        <div
          className="inkio-ie-toolbar-group inkio-ie-toolbar-group--tools"
          data-testid="inkio-ie-toolbar-tools"
        >
          {buttons}
        </div>
      )}
    </div>
  );

  return mobile ? toolbar : (
    <div className="inkio-ie-tool-rail" data-testid="inkio-ie-tool-rail">
      {toolbar}
    </div>
  );
}
