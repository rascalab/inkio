import type { Extensions } from '@tiptap/core';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { getExtensions, type ExtensionsOptions } from '@inkio/core';
import { Callout } from './extensions/Callout';
import { KeyboardShortcuts } from './extensions/KeyboardShortcuts';
import { DetailsShortcut } from './extensions/DetailsShortcut';

export interface DefaultExtensionsOptions extends ExtensionsOptions {
  callout?: boolean;
  toggleList?: boolean;
  table?: boolean;
  keyboardShortcuts?: boolean;
}

export function getDefaultExtensions(options: DefaultExtensionsOptions = {}) {
  const {
    callout,
    toggleList,
    table,
    keyboardShortcuts,
    ...coreOptions
  } = options;

  const extensions: Extensions = [
    ...getExtensions(coreOptions),
    ...(callout !== false ? [Callout] : []),
    ...(keyboardShortcuts !== false ? [KeyboardShortcuts] : []),
    ...(toggleList !== false
      ? [
          Details.configure({
            persist: true,
            HTMLAttributes: {},
          }),
          DetailsSummary,
          DetailsContent,
          DetailsShortcut,
        ]
      : []),
    ...(table !== false
      ? [
          Table.configure({
            HTMLAttributes: {},
            resizable: false,
            allowTableNodeSelection: false,
          }),
          TableRow,
          TableHeader,
          TableCell,
        ]
      : []),
  ];

  return extensions;
}
