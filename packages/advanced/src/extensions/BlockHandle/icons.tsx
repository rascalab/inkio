import React from 'react';
import {
  CopyIcon,
  FileCodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  LightbulbIcon,
  ListIcon,
  ListOrderedIcon,
  Trash2Icon,
  TypeIcon,
} from '@inkio/core/icons';

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
  delete: <Trash2Icon {...ICON_PROPS} />,
  duplicate: <CopyIcon {...ICON_PROPS} />,
  text: <TypeIcon {...ICON_PROPS} />,
  heading1: <Heading1Icon {...ICON_PROPS} />,
  heading2: <Heading2Icon {...ICON_PROPS} />,
  heading3: <Heading3Icon {...ICON_PROPS} />,
  bulletList: <ListIcon {...ICON_PROPS} />,
  orderedList: <ListOrderedIcon {...ICON_PROPS} />,
  callout: <LightbulbIcon {...ICON_PROPS} />,
  codeBlock: <FileCodeIcon {...ICON_PROPS} />,
};
