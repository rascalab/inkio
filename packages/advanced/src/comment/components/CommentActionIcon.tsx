import type { InkioIconComponent } from '@inkio/core/icons';

/**
 * Optional action icon for comment buttons. Renders nothing unless an
 * override is provided, so default output stays text-only while the `icons`
 * override actually takes effect.
 */
export function CommentActionIcon({ icon }: { icon: InkioIconComponent | undefined }) {
  if (!icon) return null;
  const Icon = icon;
  return <Icon size={14} />;
}
