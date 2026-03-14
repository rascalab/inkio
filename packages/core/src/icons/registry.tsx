import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AddColumnAfterIcon,
  AddColumnBeforeIcon,
  AddRowAfterIcon,
  AddRowBeforeIcon,
  BoldIcon,
  CheckIcon,
  ChevronRightIcon,
  CodeBlockIcon,
  CodeIcon,
  ColumnsIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlightIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MergeCellsIcon,
  MessageSquareIcon,
  MinusIcon,
  PaletteIcon,
  RedoIcon,
  SubscriptIcon,
  SuperscriptIcon,
  RowsIcon,
  SplitCellIcon,
  StrikethroughIcon,
  TableIcon,
  TextQuoteIcon,
  Trash2Icon,
  UnderlineIcon,
  UnlinkIcon,
  UndoIcon,
  type InkioIconComponent,
} from './icon';

export type BuiltinInkioIconId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'highlight'
  | 'textColor'
  | 'subscript'
  | 'superscript'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'textAlignLeft'
  | 'textAlignCenter'
  | 'textAlignRight'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'callout'
  | 'table'
  | 'toggleList'
  | 'codeBlock'
  | 'horizontalRule'
  | 'link'
  | 'unlink'
  | 'comment'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteColumn'
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'toggleHeaderColumn'
  | 'toggleHeaderRow'
  | 'mergeCells'
  | 'splitCell'
  | 'deleteTable'
  | 'taskCheck';

export type InkioIconId = BuiltinInkioIconId | (string & {});

export type InkioIconRegistry = Record<string, InkioIconComponent> & Record<BuiltinInkioIconId, InkioIconComponent>;

export const inkioIconRegistry: InkioIconRegistry = {
  undo: UndoIcon,
  redo: RedoIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strike: StrikethroughIcon,
  code: CodeIcon,
  highlight: HighlightIcon,
  textColor: PaletteIcon,
  subscript: SubscriptIcon,
  superscript: SuperscriptIcon,
  heading1: Heading1Icon,
  heading2: Heading2Icon,
  heading3: Heading3Icon,
  textAlignLeft: AlignLeftIcon,
  textAlignCenter: AlignCenterIcon,
  textAlignRight: AlignRightIcon,
  bulletList: ListIcon,
  orderedList: ListOrderedIcon,
  taskList: CheckIcon,
  callout: TextQuoteIcon,
  table: TableIcon,
  toggleList: ChevronRightIcon,
  codeBlock: CodeBlockIcon,
  horizontalRule: MinusIcon,
  link: LinkIcon,
  unlink: UnlinkIcon,
  comment: MessageSquareIcon,
  addColumnBefore: AddColumnBeforeIcon,
  addColumnAfter: AddColumnAfterIcon,
  deleteColumn: Trash2Icon,
  addRowBefore: AddRowBeforeIcon,
  addRowAfter: AddRowAfterIcon,
  deleteRow: Trash2Icon,
  toggleHeaderColumn: ColumnsIcon,
  toggleHeaderRow: RowsIcon,
  mergeCells: MergeCellsIcon,
  splitCell: SplitCellIcon,
  deleteTable: Trash2Icon,
  taskCheck: CheckIcon,
};

export function resolveIconRegistry(overrides?: Partial<InkioIconRegistry>): InkioIconRegistry {
  return {
    ...inkioIconRegistry,
    ...overrides,
  } as InkioIconRegistry;
}
