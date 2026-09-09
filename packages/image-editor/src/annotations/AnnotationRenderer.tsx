
import type { Annotation } from '../types';
import { RectAnnotationShape } from './RectAnnotationShape';
import { EllipseAnnotationShape } from './EllipseAnnotationShape';
import { ArrowAnnotationShape } from './ArrowAnnotationShape';
import { LineAnnotationShape } from './LineAnnotationShape';
import { TextAnnotationShape } from './TextAnnotationShape';
import { FreeDrawAnnotationShape } from './FreeDrawAnnotationShape';
import { RedactAnnotationShape } from './RedactAnnotationShape';
import { StickerAnnotationShape } from './StickerAnnotationShape';

interface AnnotationRendererProps {
  annotation: Annotation;
  image: HTMLImageElement | null;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<Annotation>) => void;
  scale: number;
}

export function AnnotationRenderer({
  annotation,
  image,
  onSelect,
  onChange,
  scale,
}: AnnotationRendererProps) {
  const commonProps = { onSelect, onChange, scale };

  switch (annotation.type) {
    case 'rect':
      return <RectAnnotationShape annotation={annotation} {...commonProps} />;
    case 'ellipse':
      return <EllipseAnnotationShape annotation={annotation} {...commonProps} />;
    case 'arrow':
      return <ArrowAnnotationShape annotation={annotation} {...commonProps} />;
    case 'line':
      return <LineAnnotationShape annotation={annotation} {...commonProps} />;
    case 'text':
      return <TextAnnotationShape annotation={annotation} {...commonProps} />;
    case 'freedraw':
      return <FreeDrawAnnotationShape annotation={annotation} {...commonProps} />;
    case 'redact':
      return <RedactAnnotationShape annotation={annotation} image={image} {...commonProps} />;
    case 'sticker':
      return <StickerAnnotationShape annotation={annotation} {...commonProps} />;
    default:
      return null;
  }
}
