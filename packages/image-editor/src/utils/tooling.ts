import type { EnabledToolType, ToolType } from '../types';

export function normalizeTool(tool: ToolType | null): EnabledToolType | null {
  if (tool === 'crop') {
    return 'resize';
  }

  return tool;
}

export function normalizeTools(tools: ToolType[]): EnabledToolType[] {
  const normalized: EnabledToolType[] = [];
  const seen = new Set<EnabledToolType>();

  tools.forEach((tool) => {
    const nextTool = normalizeTool(tool);
    if (!nextTool || seen.has(nextTool)) {
      return;
    }

    seen.add(nextTool);
    normalized.push(nextTool);
  });

  return normalized;
}

export function isResizeTool(tool: ToolType | null): boolean {
  return tool === 'resize' || tool === 'crop';
}
