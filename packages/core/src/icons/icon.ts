import {
  createElement,
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from 'react';
import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowUpRight,
  Bold,
  Check,
  ChevronRight,
  Circle,
  Code,
  Columns2,
  Copy,
  Crop,
  FileCode,
  FlipHorizontal2,
  FlipVertical2,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Lightbulb,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  LoaderCircle,
  Lock,
  LockOpen,
  Maximize,
  Merge,
  MessageSquare,
  Minus,
  Palette,
  Pencil,
  Redo,
  RotateCcw,
  RotateCw,
  Rows2,
  Shapes,
  Square,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableColumnsSplit,
  TextQuote,
  Trash2,
  Type,
  Underline,
  Undo,
  X,
} from 'lucide';

export type InkioSvgAttributes = Record<string, string | number | undefined>;
export type InkioIconNode = [tag: string, attrs: InkioSvgAttributes][];

export interface InkioIconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  color?: string;
  size?: number | string;
  absoluteStrokeWidth?: boolean;
}

export type InkioIconComponent = ForwardRefExoticComponent<
  InkioIconProps & RefAttributes<SVGSVGElement>
>;

export interface InkioIconRendererProps extends InkioIconProps {
  iconNode: InkioIconNode;
}

const DEFAULT_ATTRIBUTES = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function resolveStrokeWidth(
  strokeWidth: InkioIconProps['strokeWidth'],
  size: InkioIconProps['size'],
  absoluteStrokeWidth: boolean,
): InkioIconProps['strokeWidth'] {
  if (!absoluteStrokeWidth) {
    return strokeWidth;
  }

  const numericStrokeWidth = typeof strokeWidth === 'number' ? strokeWidth : Number(strokeWidth);
  const numericSize = typeof size === 'number' ? size : Number(size);

  if (!Number.isFinite(numericStrokeWidth) || !Number.isFinite(numericSize) || numericSize <= 0) {
    return strokeWidth;
  }

  return (numericStrokeWidth * 24) / numericSize;
}

function renderIconChildren(iconNode: InkioIconNode, keyPrefix: string) {
  return iconNode.map(([tag, attrs], index) =>
    createElement(tag, {
      key: `${keyPrefix}-${tag}-${index}`,
      ...attrs,
    }),
  );
}

export const InkioIcon = forwardRef<SVGSVGElement, InkioIconRendererProps>(
  function InkioIcon(
    {
      iconNode,
      color = 'currentColor',
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth = false,
      children,
      ...props
    },
    ref,
  ) {
    return createElement(
      'svg',
      {
        ...DEFAULT_ATTRIBUTES,
        ...props,
        ref,
        width: size,
        height: size,
        stroke: color,
        strokeWidth: resolveStrokeWidth(strokeWidth, size, absoluteStrokeWidth),
      },
      [...renderIconChildren(iconNode, 'inkio-icon'), children],
    );
  },
);

export function createInkioIcon(
  iconNode: InkioIconNode,
  displayName: string,
): InkioIconComponent {
  const IconComponent = forwardRef<SVGSVGElement, InkioIconProps>(function IconComponent(
    props,
    ref,
  ) {
    return createElement(InkioIcon, {
      ...props,
      ref,
      iconNode,
    });
  });

  IconComponent.displayName = displayName;

  return IconComponent;
}

export function createInkioIconElement(
  iconNode: InkioIconNode,
  props: Pick<InkioIconProps, 'color' | 'size' | 'strokeWidth' | 'className'> = {},
): SVGSVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const size = props.size ?? 24;
  const strokeWidth = props.strokeWidth ?? 2;

  element.setAttribute('xmlns', DEFAULT_ATTRIBUTES.xmlns);
  element.setAttribute('viewBox', DEFAULT_ATTRIBUTES.viewBox);
  element.setAttribute('fill', DEFAULT_ATTRIBUTES.fill);
  element.setAttribute('stroke', props.color ?? DEFAULT_ATTRIBUTES.stroke);
  element.setAttribute('stroke-width', String(strokeWidth));
  element.setAttribute('stroke-linecap', DEFAULT_ATTRIBUTES.strokeLinecap);
  element.setAttribute('stroke-linejoin', DEFAULT_ATTRIBUTES.strokeLinejoin);
  element.setAttribute('width', String(size));
  element.setAttribute('height', String(size));

  if (props.className) {
    element.setAttribute('class', props.className);
  }

  for (const [tag, attrs] of iconNode) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined) {
        continue;
      }
      child.setAttribute(key, String(value));
    }
    element.appendChild(child);
  }

  return element;
}

export const AlignCenterIconNode = AlignCenterHorizontal as InkioIconNode;
export const AlignLeftIconNode = AlignStartHorizontal as InkioIconNode;
export const AlignRightIconNode = AlignEndHorizontal as InkioIconNode;
export const AddColumnAfterIconNode = ArrowRightToLine as InkioIconNode;
export const AddColumnBeforeIconNode = ArrowLeftToLine as InkioIconNode;
export const AddRowAfterIconNode = ArrowDownToLine as InkioIconNode;
export const AddRowBeforeIconNode = ArrowUpToLine as InkioIconNode;
export const ArrowUpRightIconNode = ArrowUpRight as InkioIconNode;
export const BoldIconNode = Bold as InkioIconNode;
export const CheckIconNode = Check as InkioIconNode;
export const ChevronRightIconNode = ChevronRight as InkioIconNode;
export const CircleIconNode = Circle as InkioIconNode;
export const CodeIconNode = Code as InkioIconNode;
export const ColumnsIconNode = Columns2 as InkioIconNode;
export const CopyIconNode = Copy as InkioIconNode;
export const CropIconNode = Crop as InkioIconNode;
export const FileCodeIconNode = FileCode as InkioIconNode;
export const FlipHorizontalIconNode = FlipHorizontal2 as InkioIconNode;
export const FlipVerticalIconNode = FlipVertical2 as InkioIconNode;
export const GripVerticalIconNode = GripVertical as InkioIconNode;
export const Heading1IconNode = Heading1 as InkioIconNode;
export const Heading2IconNode = Heading2 as InkioIconNode;
export const Heading3IconNode = Heading3 as InkioIconNode;
export const HighlighterIconNode = Highlighter as InkioIconNode;
export const ItalicIconNode = Italic as InkioIconNode;
export const LightbulbIconNode = Lightbulb as InkioIconNode;
export const LinkIconNode = Link2 as InkioIconNode;
export const LinkOffIconNode = Link2Off as InkioIconNode;
export const ListIconNode = List as InkioIconNode;
export const ListOrderedIconNode = ListOrdered as InkioIconNode;
export const Loader2IconNode = LoaderCircle as InkioIconNode;
export const LockIconNode = Lock as InkioIconNode;
export const LockOpenIconNode = LockOpen as InkioIconNode;
export const MaximizeIconNode = Maximize as InkioIconNode;
export const MergeCellsIconNode = Merge as InkioIconNode;
export const MessageSquareIconNode = MessageSquare as InkioIconNode;
export const MinusIconNode = Minus as InkioIconNode;
export const PaletteIconNode = Palette as InkioIconNode;
export const PencilIconNode = Pencil as InkioIconNode;
export const RedoIconNode = Redo as InkioIconNode;
export const RotateCCWIconNode = RotateCcw as InkioIconNode;
export const RotateCWIconNode = RotateCw as InkioIconNode;
export const RowsIconNode = Rows2 as InkioIconNode;
export const ShapesIconNode = Shapes as InkioIconNode;
export const SplitCellIconNode = TableColumnsSplit as InkioIconNode;
export const SquareIconNode = Square as InkioIconNode;
export const StrikethroughIconNode = Strikethrough as InkioIconNode;
export const SubscriptIconNode = Subscript as InkioIconNode;
export const SuperscriptIconNode = Superscript as InkioIconNode;
export const TableIconNode = Table as InkioIconNode;
export const TextQuoteIconNode = TextQuote as InkioIconNode;
export const Trash2IconNode = Trash2 as InkioIconNode;
export const TypeIconNode = Type as InkioIconNode;
export const UnderlineIconNode = Underline as InkioIconNode;
export const UndoIconNode = Undo as InkioIconNode;
export const XIconNode = X as InkioIconNode;

export const AlignCenterIcon = createInkioIcon(AlignCenterIconNode, 'AlignCenterIcon');
export const AlignLeftIcon = createInkioIcon(AlignLeftIconNode, 'AlignLeftIcon');
export const AlignRightIcon = createInkioIcon(AlignRightIconNode, 'AlignRightIcon');
export const AddColumnAfterIcon = createInkioIcon(AddColumnAfterIconNode, 'AddColumnAfterIcon');
export const AddColumnBeforeIcon = createInkioIcon(AddColumnBeforeIconNode, 'AddColumnBeforeIcon');
export const AddRowAfterIcon = createInkioIcon(AddRowAfterIconNode, 'AddRowAfterIcon');
export const AddRowBeforeIcon = createInkioIcon(AddRowBeforeIconNode, 'AddRowBeforeIcon');
export const ArrowIcon = createInkioIcon(ArrowUpRightIconNode, 'ArrowIcon');
export const BoldIcon = createInkioIcon(BoldIconNode, 'BoldIcon');
export const CheckIcon = createInkioIcon(CheckIconNode, 'CheckIcon');
export const ChevronRightIcon = createInkioIcon(ChevronRightIconNode, 'ChevronRightIcon');
export const CircleIcon = createInkioIcon(CircleIconNode, 'CircleIcon');
export const CodeBlockIcon = createInkioIcon(FileCodeIconNode, 'CodeBlockIcon');
export const CodeIcon = createInkioIcon(CodeIconNode, 'CodeIcon');
export const ColumnsIcon = createInkioIcon(ColumnsIconNode, 'ColumnsIcon');
export const CopyIcon = createInkioIcon(CopyIconNode, 'CopyIcon');
export const CropIcon = createInkioIcon(CropIconNode, 'CropIcon');
export const EllipseIcon = createInkioIcon(CircleIconNode, 'EllipseIcon');
export const FileCodeIcon = createInkioIcon(FileCodeIconNode, 'FileCodeIcon');
export const FlipHIcon = createInkioIcon(FlipHorizontalIconNode, 'FlipHIcon');
export const FlipVIcon = createInkioIcon(FlipVerticalIconNode, 'FlipVIcon');
export const GripVerticalIcon = createInkioIcon(GripVerticalIconNode, 'GripVerticalIcon');
export const Heading1Icon = createInkioIcon(Heading1IconNode, 'Heading1Icon');
export const Heading2Icon = createInkioIcon(Heading2IconNode, 'Heading2Icon');
export const Heading3Icon = createInkioIcon(Heading3IconNode, 'Heading3Icon');
export const HighlightIcon = createInkioIcon(HighlighterIconNode, 'HighlightIcon');
export const ItalicIcon = createInkioIcon(ItalicIconNode, 'ItalicIcon');
export const LightbulbIcon = createInkioIcon(LightbulbIconNode, 'LightbulbIcon');
export const LinkIcon = createInkioIcon(LinkIconNode, 'LinkIcon');
export const ListIcon = createInkioIcon(ListIconNode, 'ListIcon');
export const ListOrderedIcon = createInkioIcon(ListOrderedIconNode, 'ListOrderedIcon');
export const Loader2Icon = createInkioIcon(Loader2IconNode, 'Loader2Icon');
export const LockClosedIcon = createInkioIcon(LockIconNode, 'LockClosedIcon');
export const LockOpenIcon = createInkioIcon(LockOpenIconNode, 'LockOpenIcon');
export const MaximizeIcon = createInkioIcon(MaximizeIconNode, 'MaximizeIcon');
export const MergeCellsIcon = createInkioIcon(MergeCellsIconNode, 'MergeCellsIcon');
export const MessageSquareIcon = createInkioIcon(MessageSquareIconNode, 'MessageSquareIcon');
export const MinusIcon = createInkioIcon(MinusIconNode, 'MinusIcon');
export const PaletteIcon = createInkioIcon(PaletteIconNode, 'PaletteIcon');
export const PencilIcon = createInkioIcon(PencilIconNode, 'PencilIcon');
export const RectIcon = createInkioIcon(SquareIconNode, 'RectIcon');
export const RedoIcon = createInkioIcon(RedoIconNode, 'RedoIcon');
export const RotateCCWIcon = createInkioIcon(RotateCCWIconNode, 'RotateCCWIcon');
export const RotateCWIcon = createInkioIcon(RotateCWIconNode, 'RotateCWIcon');
export const RowsIcon = createInkioIcon(RowsIconNode, 'RowsIcon');
export const ShapesIcon = createInkioIcon(ShapesIconNode, 'ShapesIcon');
export const SplitCellIcon = createInkioIcon(SplitCellIconNode, 'SplitCellIcon');
export const SquareIcon = createInkioIcon(SquareIconNode, 'SquareIcon');
export const StrikethroughIcon = createInkioIcon(StrikethroughIconNode, 'StrikethroughIcon');
export const SubscriptIcon = createInkioIcon(SubscriptIconNode, 'SubscriptIcon');
export const SuperscriptIcon = createInkioIcon(SuperscriptIconNode, 'SuperscriptIcon');
export const TableIcon = createInkioIcon(TableIconNode, 'TableIcon');
export const TextQuoteIcon = createInkioIcon(TextQuoteIconNode, 'TextQuoteIcon');
export const Trash2Icon = createInkioIcon(Trash2IconNode, 'Trash2Icon');
export const TypeIcon = createInkioIcon(TypeIconNode, 'TypeIcon');
export const UnderlineIcon = createInkioIcon(UnderlineIconNode, 'UnderlineIcon');
export const UndoIcon = createInkioIcon(UndoIconNode, 'UndoIcon');
export const UnlinkIcon = createInkioIcon(LinkOffIconNode, 'UnlinkIcon');
export const XIcon = createInkioIcon(XIconNode, 'XIcon');
