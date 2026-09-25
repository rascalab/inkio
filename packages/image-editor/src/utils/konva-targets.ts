import type Konva from 'konva';

export function isTransformerInteraction(target: Konva.Node | null): boolean {
  // Visited set: a custom node whose getParent cycles (itself or a loop)
  // would otherwise hang the UI thread in this walk.
  const seen = new Set<Konva.Node>();
  let current: Konva.Node | null = target;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current.getClassName === 'function' && current.getClassName() === 'Transformer') {
      return true;
    }
    current = current.getParent();
  }
  return false;
}
