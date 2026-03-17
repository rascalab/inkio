import type Konva from 'konva';

export function isTransformerInteraction(target: Konva.Node | null): boolean {
  let current: Konva.Node | null = target;
  while (current) {
    if (typeof current.getClassName === 'function' && current.getClassName() === 'Transformer') {
      return true;
    }
    current = current.getParent();
  }
  return false;
}
