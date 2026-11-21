import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface BookmarkStorage {
  previewRequests: WeakSet<ProseMirrorNode>;
}

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
  /**
   * Resolves previews for bookmarks explicitly inserted with `setBookmark`
   * in an editable editor. Loading or pasting a document does not resolve
   * its bookmarks. Only a subset of absolute HTTP(S) URLs reaches this callback.
   * The URL check is not network authorization:
   * the host must enforce its destination policy at every fetch and redirect,
   * including DNS/IP checks, and control which preview assets it returns.
   */
  onResolveBookmark?: (url: string) => Promise<BookmarkPreview>;
  /** Loading placeholder text while the preview resolves. */
  loadingPreviewText?: string;
}
