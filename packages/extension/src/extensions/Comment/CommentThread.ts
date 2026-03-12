export interface CommentEntry {
  id: string;
  threadId: string;
  content: string;
  author: { id: string; name: string; avatar?: string };
  createdAt: string;
  updatedAt?: string;
}

/** @deprecated Use CommentThreadData from CommentPanel instead */
export interface CommentThread {
  id: string;
  comments: CommentEntry[];
  resolved: boolean;
  createdAt: string;
}

/** @deprecated Use ExtensionsCommentAdapter from adapter.ts instead */
export interface InkioCommentAdapter {
  onCommentCreate?: (threadId: string, selection: string) => void;
  onCommentReply?: (threadId: string, content: string) => void;
  onCommentResolve?: (threadId: string) => void;
  onCommentDelete?: (threadId: string) => void;
  loadComments?: (threadIds: string[]) => Promise<CommentThread[]>;
}
