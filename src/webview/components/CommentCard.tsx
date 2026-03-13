import React, { useCallback, useState } from 'react';
import type { Comment } from '../../shared/models';

const CATEGORY_META: Record<Comment['category'], { icon: string; label: string }> = {
  issue:      { icon: '⛔', label: 'Issue' },
  suggestion: { icon: '💡', label: 'Suggestion' },
  question:   { icon: '❓', label: 'Question' },
  approval:   { icon: '✅', label: 'Approval' },
};

const CATEGORY_OPTIONS: Array<{ value: Comment['category']; label: string; icon: string }> = [
  { value: 'issue',      label: 'Issue',      icon: '⛔' },
  { value: 'suggestion', label: 'Suggestion', icon: '💡' },
  { value: 'question',   label: 'Question',   icon: '❓' },
  { value: 'approval',   label: 'Approval',   icon: '✅' },
];

function refLabel(c: Comment): string {
  if (c.type === 'range' && c.targetStart !== c.targetEnd) {
    return `Lines ${c.targetStart}–${c.targetEnd}`;
  }
  return `Line ${c.targetStart}`;
}

interface CommentCardProps {
  comment: Comment;
  onEdit:    (id: string, body: string, category: Comment['category']) => void;
  onDelete:  (id: string) => void;
  onResolve: (id: string) => void;
}

export const CommentCard: React.FC<CommentCardProps> = ({ comment, onEdit, onDelete, onResolve }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editCategory, setEditCategory] = useState<Comment['category']>(comment.category);

  const meta = CATEGORY_META[comment.category];

  const handleSave = useCallback((): void => {
    if (editBody.trim().length === 0) return;
    onEdit(comment.id, editBody.trim(), editCategory);
    setIsEditing(false);
  }, [comment.id, editBody, editCategory, onEdit]);

  const handleCancelEdit = useCallback((): void => {
    setEditBody(comment.body);
    setEditCategory(comment.category);
    setIsEditing(false);
  }, [comment.body, comment.category]);

  return (
    <div className={`comment-card-wrap comment-card--${comment.category}`}>
      <div className="comment-card">
        <div className="comment-card-header">
          <span className="comment-card-category" aria-label={meta.label}>
            {meta.icon} {meta.label}
          </span>
          <span className="comment-card-ref">{refLabel(comment)}</span>
          {comment.resolved && <span className="comment-card-resolved-badge">✓ resolved</span>}
          {comment.carriedFromId !== null && <span className="comment-card-carried-badge">↩ carried</span>}
          {!isEditing && (
            <div className="comment-card-actions">
              {!comment.resolved && (
                <button
                  className="resolve-btn"
                  title="Mark as resolved"
                  onClick={() => { onResolve(comment.id); }}
                >
                  ✓
                </button>
              )}
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
            <select
              className="comment-card-edit-select"
              value={editCategory}
              onChange={(e) => { setEditCategory(e.target.value as Comment['category']); }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
              ))}
            </select>
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
