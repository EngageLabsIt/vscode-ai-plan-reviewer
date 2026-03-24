import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Comment } from '../../../shared/models';

interface CommentThreadProps {
  comment: Comment;
  anchorElement: HTMLElement | undefined;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  editRequested?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  anchorElement,
  onUpdate,
  onDelete,
  editRequested = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editRequested === 0) return;
    setCollapsed(false);
    setEditing(true);
    setEditBody(comment.body);
    const timerId = setTimeout(() => {
      portalContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => { clearTimeout(timerId); };
  }, [editRequested, comment.body, portalContainer]);

  useEffect(() => {
    if (anchorElement === undefined) return;

    const container = document.createElement('div');
    container.className = 'comment-thread-portal';
    anchorElement.insertAdjacentElement('afterend', container);
    setPortalContainer(container);

    return () => {
      container.remove();
      setPortalContainer(null);
    };
  }, [anchorElement]);

  if (anchorElement === undefined || portalContainer === null) return null;

  const lineLabel =
    comment.type === 'global'
      ? 'Piano intero'
      : comment.targetStart === comment.targetEnd
        ? `Line ${comment.targetStart}`
        : `Lines ${comment.targetStart}–${comment.targetEnd}`;

  const handleSaveEdit = (): void => {
    if (editBody.trim()) {
      onUpdate(comment.id, editBody.trim());
    }
    setEditing(false);
  };

  const threadEl = (
    <div className="comment-thread">
      <div
        className="comment-thread__header"
        onClick={() => { setCollapsed(c => !c); }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(c => !c); }}
        aria-expanded={!collapsed}
      >
        <span className="comment-thread__location">📝 {lineLabel}</span>
        <span className="comment-thread__toggle">{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <>
          <div className="comment-thread__body">
            {editing ? (
              <textarea
                className="comment-thread__edit-input"
                value={editBody}
                onChange={e => { setEditBody(e.target.value); }}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
              />
            ) : (
              <p className="comment-thread__text">{comment.body}</p>
            )}
          </div>
          <div className="comment-thread__actions">
            {!editing && (
              <button className="comment-thread__btn comment-thread__btn--edit" onClick={() => { setEditing(true); setEditBody(comment.body); }}>
                Edit
              </button>
            )}
            {editing && (
              <>
                <button className="comment-thread__btn comment-thread__btn--save" onClick={handleSaveEdit}>
                  Save
                </button>
                <button className="comment-thread__btn comment-thread__btn--cancel" onClick={() => { setEditing(false); }}>
                  Cancel
                </button>
              </>
            )}
            <button className="comment-thread__btn comment-thread__btn--delete" onClick={() => { onDelete(comment.id); }}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(threadEl, portalContainer);
};
