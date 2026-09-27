'use client';

import dynamic from 'next/dynamic';
import type { ImageEditorModalProps } from '@inkio/image-editor';

/** Client-only, code-split image editor modal shared by the playground panes. */
export const LazyImageEditorModal = dynamic<ImageEditorModalProps>(
  () => import('@inkio/image-editor').then((mod) => mod.ImageEditorModal),
  { ssr: false, loading: () => null },
);
