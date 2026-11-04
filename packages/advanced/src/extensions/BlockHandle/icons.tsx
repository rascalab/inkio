import React from 'react';
import { inkioIconRegistry, type InkioIconRegistry } from '@inkio/core/icons';

export type BlockMenuIconId =
  | 'delete'
  | 'duplicate'
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'callout'
  | 'codeBlock';

export type BlockMenuIcons = Partial<Record<BlockMenuIconId, React.ReactNode>>;

const ICON_PROPS = {
  size: 16,
  strokeWidth: 1.8,
} as const;

const IDS: BlockMenuIconId[] = [
  'delete',
  'duplicate',
  'text',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'callout',
  'codeBlock',
];

export function blockMenuIconsFrom(registry: InkioIconRegistry): Record<BlockMenuIconId, React.ReactNode> {
  return Object.fromEntries(
    IDS.map((id) => {
      const Icon = registry[id];
      return [id, <Icon key={id} {...ICON_PROPS} />];
    }),
  ) as Record<BlockMenuIconId, React.ReactNode>;
}

export const defaultBlockMenuIcons = blockMenuIconsFrom(inkioIconRegistry);
