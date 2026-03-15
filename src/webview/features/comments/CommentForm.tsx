import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/planViewer.css';

interface CommentFormProps {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({ onSubmit, onCancel }) => {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [onCancel]);

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>): void => {
    const ta = e.currentTarget;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (body.trim().length > 0) {
        onSubmit(body.trim());
      }
    }
  }, [body, onSubmit]);

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    if (body.trim().length > 0) {
      onSubmit(body.trim());
    }
  }, [body, onSubmit]);

  return (
    <div className="comment-form-inline">
      <form onSubmit={handleSubmit} noValidate>
        <textarea
          ref={textareaRef}
          className="comment-form-inline__textarea"
          value={body}
          onChange={(e) => { setBody(e.target.value); }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Add a comment… (Ctrl+Enter to submit)"
        />
        <div className="comment-form-inline__actions">
          <button type="button" className="comment-form-inline__btn comment-form-inline__btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="comment-form-inline__btn comment-form-inline__btn--submit" aria-label="Add comment" title="Add comment (Ctrl+Enter)">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </form>
    </div>
  );
};
