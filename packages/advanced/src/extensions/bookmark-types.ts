export interface BookmarkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface BookmarkAttributes extends BookmarkPreview {
  url: string;
}

export interface BookmarkOptions {
  HTMLAttributes: Record<string, any>;
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
  /** Loading placeholder text while the preview resolves. */
  loadingPreviewText?: string;
}
