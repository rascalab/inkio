import React from 'react';
import {
  Trash2,
  Copy,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Lightbulb,
  FileCode,
} from 'lucide-react';

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

export const defaultBlockMenuIcons: Record<BlockMenuIconId, React.ReactNode> = {
  delete: <Trash2 {...ICON_PROPS} />,
  duplicate: <Copy {...ICON_PROPS} />,
  text: <Type {...ICON_PROPS} />,
  heading1: <Heading1 {...ICON_PROPS} />,
  heading2: <Heading2 {...ICON_PROPS} />,
  heading3: <Heading3 {...ICON_PROPS} />,
  bulletList: <List {...ICON_PROPS} />,
  orderedList: <ListOrdered {...ICON_PROPS} />,
  callout: <Lightbulb {...ICON_PROPS} />,
  codeBlock: <FileCode {...ICON_PROPS} />,
};
