import { createContext, useContext } from 'react';
import type { Comment } from '../../../shared/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommentFormState =
  | { type: 'section'; sectionId: string; heading: string }
  | { type: 'line';    lineNumber: number; startCharOffset: number | null; endCharOffset: number | null; selectedText: string | null }
  | { type: 'range';   startLine: number; endLine: number; startCharOffset: number | null; endCharOffset: number | null; selectedText: string | null };

export interface CommentContextValue {
  comments: Comment[];
  onEdit:    (id: string, body: string) => void;
  onDelete:  (id: string) => void;
  onResolve: (id: string) => void;
  commentFormState: CommentFormState | null;
  activeCommentLine: number | null;
  openCommentForm: (state: CommentFormState) => void;
  closeCommentForm: () => void;
  onCommentSubmit: (body: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CommentContext = createContext<CommentContextValue | null>(null);

export function useComments(): CommentContextValue {
  const ctx = useContext(CommentContext);
  if (ctx === null) {
    throw new Error('useComments must be used within a CommentContext.Provider');
  }
  return ctx;
}

export { CommentContext };
