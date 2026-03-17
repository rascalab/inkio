import { useContext } from 'react';
import { ImageEditorContext } from '../ImageEditorContext';

export function useImageEditor() {
  const ctx = useContext(ImageEditorContext);
  if (!ctx) {
    throw new Error('useImageEditor must be used within an ImageEditorProvider');
  }
  return ctx;
}
