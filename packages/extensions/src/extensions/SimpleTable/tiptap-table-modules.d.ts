declare module '@tiptap/extension-table' {
  import type { Node } from '@tiptap/core';

  export const Table: Node;
  export default Table;
}

declare module '@tiptap/extension-table-row' {
  import type { Node } from '@tiptap/core';

  export const TableRow: Node;
  export default TableRow;
}

declare module '@tiptap/extension-table-cell' {
  import type { Node } from '@tiptap/core';

  export const TableCell: Node;
  export default TableCell;
}

declare module '@tiptap/extension-table-header' {
  import type { Node } from '@tiptap/core';

  export const TableHeader: Node;
  export default TableHeader;
}
