import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Comment } from '../../../shared/models';
import { MarkdownBody } from './MarkdownBody';
import { CommentThread } from './CommentThread';
import { CommentForm } from './CommentForm';
import { RangeHighlighter } from './RangeHighlighter';
import { useBlockMapping } from '../hooks/useBlockMapping';
import { useComments } from '../features/comments/CommentContext';

interface PlanReviewViewProps {
  html: string;
  comments: Comment[];
  onUpdateComment: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  onResolveComment: (id: string) => void;
  globalCommentEditRequested?: boolean;
}

export const PlanReviewView: React.FC<PlanReviewViewProps> = ({
  html,
  comments,
  onUpdateComment,
  onDeleteComment,
  onResolveComment,
  globalCommentEditRequested = false,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const globalAnchorRef = useRef<HTMLDivElement>(null);
  const blockMap = useBlockMapping(bodyRef);

  const { openCommentForm, commentFormState } = useComments();

  // Lines already commented (line/range, non-resolved) → hide the + button
  // Excludes 'section' and 'global' because they have different anchors
  const commentedLines = useMemo(
    () => new Set(
      comments
        .filter((c) => !c.resolved && c.type !== 'global' && c.type !== 'section')
        .map((c) => c.targetStart)
    ),
    [comments]
  );

  // Anchor line for the form: derived from commentFormState (no local state)
  const pendingLine: number | null = useMemo(() => {
    if (commentFormState === null || commentFormState.type === 'global' || commentFormState.type === 'section') {
      return null;
    }
    if (commentFormState.type === 'line') return commentFormState.lineNumber;
    return commentFormState.startLine; // range
  }, [commentFormState]);

  // Handler for per-block + button
  const handleBlockAdd = useCallback((lineNumber: number): void => {
    openCommentForm({ type: 'line', lineNumber, startCharOffset: null, endCharOffset: null, selectedText: null });
  }, [openCommentForm]);

  // Handler for text selection (range)
  const handleRangeAdd = useCallback((targetStart: number, targetEnd: number, selectedText: string): void => {
    if (targetStart === targetEnd) {
      openCommentForm({ type: 'line', lineNumber: targetStart, startCharOffset: null, endCharOffset: null, selectedText });
    } else {
      openCommentForm({ type: 'range', startLine: targetStart, endLine: targetEnd, startCharOffset: null, endCharOffset: null, selectedText });
    }
  }, [openCommentForm]);

  // Portal container for inline form (line/range)
  const [formContainer, setFormContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFormContainer(null);
    if (pendingLine === null) return;

    const anchor = blockMap.get(pendingLine);
    if (anchor === undefined) return;

    const container = document.createElement('div');
    container.className = 'comment-form-portal';
    anchor.insertAdjacentElement('afterend', container);
    setFormContainer(container);

    return () => {
      container.remove();
      setFormContainer(null);
    };
  }, [pendingLine, blockMap]);

  // Portal container for global comment form
  const [globalFormContainer, setGlobalFormContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setGlobalFormContainer(null);
    if (commentFormState?.type !== 'global') return;
    if (globalAnchorRef.current === null) return;

    const container = document.createElement('div');
    container.className = 'comment-form-portal comment-form-portal--global';
    globalAnchorRef.current.insertAdjacentElement('afterend', container);
    setGlobalFormContainer(container);

    return () => {
      container.remove();
      setGlobalFormContainer(null);
    };
  }, [commentFormState]);

  // Existing global comment (non-resolved)
  const globalComment = useMemo(
    () => comments.find((c) => c.type === 'global' && !c.resolved) ?? null,
    [comments]
  );

  return (
    <div className="plan-review-view">
      <MarkdownBody ref={bodyRef} html={html} />

      {/* + buttons per-block (portaled inside each .annotatable-block) */}
      {Array.from(blockMap.entries()).map(([lineNumber, el]) => {
        if (commentedLines.has(lineNumber)) return null;
        return createPortal(
          <button
            key={lineNumber}
            className="block-comment-btn"
            title="Aggiungi commento"
            aria-label={`Aggiungi commento alla riga ${lineNumber}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent deselecting text
              handleBlockAdd(lineNumber);
            }}
          >
            +
          </button>,
          el
        );
      })}

      {/* Comment threads for line/range/section */}
      {comments
        .filter((c) => c.type !== 'global')
        .map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            anchorElement={blockMap.get(comment.targetStart)}
            onUpdate={onUpdateComment}
            onDelete={onDeleteComment}
            onResolve={onResolveComment}
          />
        ))}

      {/* Inline form for line/range */}
      {formContainer !== null && createPortal(<CommentForm />, formContainer)}

      {/* Anchor for global comment (bottom of page) */}
      <div ref={globalAnchorRef} className="global-comment-anchor" />

      {/* Global comment thread */}
      {globalComment !== null && (
        // @ts-expect-error — editRequested added in Chunk 3
        <CommentThread
          comment={globalComment}
          anchorElement={globalAnchorRef.current ?? undefined}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          onResolve={onResolveComment}
          editRequested={globalCommentEditRequested}
        />
      )}

      {/* Global comment form */}
      {globalFormContainer !== null && createPortal(<CommentForm />, globalFormContainer)}

      <RangeHighlighter
        bodyRef={bodyRef}
        comments={comments}
        onAddRangeComment={handleRangeAdd}
      />
    </div>
  );
};
