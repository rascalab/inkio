import { DEFAULT_TOOLS } from '../constants';
import type { EnabledToolType, ImageEditorCustomTool, ImageEditorTool, ToolType } from '../types';

export type ResolvedImageEditorTool = EnabledToolType | ImageEditorCustomTool;

const BUILTIN_TOOL_IDS = new Set<string>([...DEFAULT_TOOLS, 'crop']);

export function normalizeTool(tool: ToolType | null): EnabledToolType | null;
export function normalizeTool(tool: string): string;
export function normalizeTool(tool: string | null): string | null {
  return tool === 'crop' ? 'resize' : tool;
}

export function getImageEditorToolId(tool: ResolvedImageEditorTool): string {
  return typeof tool === 'string' ? tool : tool.id;
}

/** Keep the first entry for each tool ID and reserve all built-in names for built-ins. */
export function normalizeTools(tools: readonly ImageEditorTool[]): ResolvedImageEditorTool[] {
  const normalized: ResolvedImageEditorTool[] = [];
  const seen = new Set<string>();
  for (const tool of tools) {
    if (!tool) continue;
    if (typeof tool === 'string') {
      if (!BUILTIN_TOOL_IDS.has(tool)) continue;
    } else if (typeof tool.id !== 'string' || !tool.id.trim() || BUILTIN_TOOL_IDS.has(tool.id)) {
      continue;
    }
    const nextTool = typeof tool === 'string' ? normalizeTool(tool) : tool;
    if (!nextTool) continue;
    const id = getImageEditorToolId(nextTool);
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(nextTool);
  }
  return normalized;
}

export function isResizeTool(tool: ToolType | null): boolean {
  return tool === 'resize' || tool === 'crop';
}
