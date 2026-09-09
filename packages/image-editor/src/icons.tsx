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

export function RedactIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
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
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-2.9 3.6" />
      <path d="M6.6 6.6C3.6 8.3 2 12 2 12s3 7 10 7c1.5 0 2.9-.3 4.1-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function StickerIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.8 1 2 1.5 3.5 1.5s2.7-.5 3.5-1.5" />
      <path d="M9 9.5h.01" />
      <path d="M15 9.5h.01" />
    </svg>
  );
}

export function FilterIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
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
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
      <circle cx="9" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
