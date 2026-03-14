import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoldIcon, inkioIconRegistry, resolveIconRegistry } from '../index';

describe('@inkio/core/icons', () => {
  it('renders shared SVG icons', () => {
    const { container } = render(<BoldIcon size={18} strokeWidth={1.5} data-testid="bold-icon" />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('18');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('merges overrides on top of the default registry', () => {
    const CustomBoldIcon = () => null;
    const registry = resolveIconRegistry({ bold: CustomBoldIcon as any });

    expect(registry.bold).toBe(CustomBoldIcon);
    expect(registry.comment).toBe(inkioIconRegistry.comment);
  });
});
