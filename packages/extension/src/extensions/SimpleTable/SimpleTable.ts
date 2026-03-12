import { Extension } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';

export interface SimpleTableOptions {
  HTMLAttributes: Record<string, any>;
  resizable: boolean;
  allowTableNodeSelection: boolean;
}

export const SimpleTable = Extension.create<SimpleTableOptions>({
  name: 'simpleTable',

  addOptions() {
    return {
      HTMLAttributes: {},
      resizable: true,
      allowTableNodeSelection: false,
    };
  },

  addExtensions() {
    return [
      Table.configure({
        HTMLAttributes: this.options.HTMLAttributes,
        resizable: this.options.resizable,
        allowTableNodeSelection: this.options.allowTableNodeSelection,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ];
  },
});
