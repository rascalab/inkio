import { MinusIcon as CoreMinusIcon } from '@inkio/core/icons';

export {
  ArrowIcon,
  BoldIcon,
  CropIcon,
  EllipseIcon,
  FlipHIcon,
  FlipVIcon,
  ItalicIcon,
  LockClosedIcon as LockIcon,
  LockOpenIcon as UnlockIcon,
  MaximizeIcon as ResizeIcon,
  MinusIcon,
  PaletteIcon,
  PencilIcon,
  RectIcon,
  RedoIcon,
  RotateCCWIcon,
  RotateCWIcon,
  ShapesIcon,
  TypeIcon,
  UndoIcon,
  XIcon as CloseIcon,
} from '@inkio/core/icons';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function LineIcon(props: IconProps) {
  return <CoreMinusIcon {...props} />;
}

export function PlusIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
