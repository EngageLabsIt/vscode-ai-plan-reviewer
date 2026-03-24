import React, { useCallback, useState } from 'react';
import type { Comment } from '../../../shared/models';
import { useComments } from './CommentContext';

function refLabel(c: Comment): string {
  if (c.type === 'range') {
    return `Selection ${c.targetStart}–${c.targetEnd}`;
  }
  if (c.type === 'section') {
    return `Section "${c.sectionId}"`;
  }
  return `Line ${c.targetStart}`;
}

interface CommentCardProps {
  comment: Comment;
}

const CommentCardComponent: React.FC<CommentCardProps> = ({ comment }) => {
  const { onEdit, onDelete } = useComments();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const handleSave = useCallback((): void => {
    if (editBody.trim().length === 0) return;
    onEdit(comment.id, editBody.trim());
    setIsEditing(false);
  }, [comment.id, editBody, onEdit]);

  const handleCancelEdit = useCallback((): void => {
    setEditBody(comment.body);
    setIsEditing(false);
  }, [comment.body]);

  return (
    <div className="comment-card-wrap">
      <div className="comment-card">
        <div className="comment-card-header">
          <span className="comment-card-ref">{refLabel(comment)}</span>
          {comment.carriedFromId !== null && <span className="comment-card-carried-badge">↩ carried</span>}
          {!isEditing && (
            <div className="comment-card-actions">
              <button
                className="edit-btn"
                title="Edit comment"
                onClick={() => { setIsEditing(true); }}
              >
                Edit
              </button>
              <button
                className="delete-btn"
                title="Delete comment"
                onClick={() => { onDelete(comment.id); }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <>
            <textarea
              className="comment-card-edit-textarea"
              value={editBody}
              onChange={(e) => { setEditBody(e.target.value); }}
              rows={3}
              autoFocus
            />
            <div className="comment-card-edit-actions">
              <button className="comment-form__btn comment-form__btn--cancel" onClick={handleCancelEdit}>Cancel</button>
              <button className="comment-form__btn comment-form__btn--submit" onClick={handleSave}>Save</button>
            </div>
          </>
        ) : (
          <div className="comment-card-body">{comment.body}</div>
        )}
      </div>
    </div>
  );
};

export const CommentCard = React.memo(CommentCardComponent);
