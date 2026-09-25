import type { ComponentType } from 'react';
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components?: Record<string, ComponentType>) {
  return {
    ...docsComponents,
    ...components,
  };
}
