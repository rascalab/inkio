import type { EnabledToolType, ToolType } from '../types';

export function normalizeTool(tool: ToolType | null): EnabledToolType | null {
  if (tool === 'crop') {
    return 'resize';
  }

  return tool;
}

/**
 * Normalize a tool list for the toolbar: 'crop' is an alias of 'resize'
 * (same session machinery), nulls are dropped, and duplicates collapse to
 * first occurrence. Callers passing ['crop', 'resize'] intentionally get
 * ['resize'] — the alias is resolved here, not at every call site.
 */
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
