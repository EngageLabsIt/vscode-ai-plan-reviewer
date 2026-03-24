import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Comment } from '../../../shared/models';
import { MarkdownBody } from './MarkdownBody';
import { AnnotationGutter } from './AnnotationGutter';
import { CommentThread } from './CommentThread';
import { CommentForm } from './CommentForm';
import { RangeHighlighter } from './RangeHighlighter';
import { useBlockMapping } from '../hooks/useBlockMapping';

interface PlanReviewViewProps {
  html: string;
  comments: Comment[];
  onAddComment: (targetStart: number, targetEnd: number, body: string, selectedText?: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  onResolveComment: (id: string) => void;
}

export const PlanReviewView: React.FC<PlanReviewViewProps> = ({
  html,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onResolveComment,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const blockMap = useBlockMapping(bodyRef);
  const [pendingCommentLine, setPendingCommentLine] = useState<number | null>(null);
  const [pendingCommentIsRange, setPendingCommentIsRange] = useState<{
    targetStart: number;
    targetEnd: number;
    selectedText?: string;
  } | null>(null);

  const handleGutterAdd = (lineNumber: number): void => {
    setPendingCommentIsRange(null);
    setPendingCommentLine(lineNumber);
  };

  const handleRangeAdd = (targetStart: number, targetEnd: number, selectedText: string): void => {
    setPendingCommentIsRange({ targetStart, targetEnd, selectedText });
    setPendingCommentLine(targetStart);
  };

  const handleFormSubmit = (body: string): void => {
    if (pendingCommentIsRange !== null) {
      onAddComment(
        pendingCommentIsRange.targetStart,
        pendingCommentIsRange.targetEnd,
        body,
        pendingCommentIsRange.selectedText,
      );
    } else if (pendingCommentLine !== null) {
      onAddComment(pendingCommentLine, pendingCommentLine, body);
    }
    setPendingCommentLine(null);
    setPendingCommentIsRange(null);
  };

  const handleFormCancel = (): void => {
    setPendingCommentLine(null);
    setPendingCommentIsRange(null);
  };

  // Manage a portal container element positioned after the pending block's anchor
  const [formContainer, setFormContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFormContainer(null);

    if (pendingCommentLine === null) return;

    const anchor = blockMap.get(pendingCommentLine);
    if (anchor === undefined) return;

    const container = document.createElement('div');
    container.className = 'comment-form-portal';
    anchor.insertAdjacentElement('afterend', container);
    setFormContainer(container);

    return () => {
      container.remove();
      setFormContainer(null);
    };
  }, [pendingCommentLine, blockMap]);

  return (
    <div className="plan-review-view">
      <AnnotationGutter
        bodyRef={bodyRef}
        blockMap={blockMap}
        comments={comments}
        onAddComment={handleGutterAdd}
        activeCommentLine={pendingCommentLine}
      />
      <MarkdownBody ref={bodyRef} html={html} />
      {comments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          anchorElement={blockMap.get(comment.targetStart)}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          onResolve={onResolveComment}
        />
      ))}
      {formContainer !== null &&
        createPortal(
          <CommentForm onSubmit={handleFormSubmit} onCancel={handleFormCancel} />,
          formContainer,
        )}
      <RangeHighlighter
        bodyRef={bodyRef}
        comments={comments}
        onAddRangeComment={handleRangeAdd}
      />
    </div>
  );
};
