import React, { useEffect, useRef, useState } from 'react';

interface CommentFormProps {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  onCancel,
  placeholder = 'Aggiungi un suggerimento...',
}) => {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (body.trim()) onSubmit(body.trim());
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="annotation-comment-form">
      <textarea
        ref={textareaRef}
        className="annotation-comment-form__input"
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
      />
      <div className="annotation-comment-form__actions">
        <button
          className="annotation-comment-form__btn annotation-comment-form__btn--cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="annotation-comment-form__btn annotation-comment-form__btn--save"
          onClick={() => { if (body.trim()) onSubmit(body.trim()); }}
          disabled={!body.trim()}
        >
          Save
        </button>
      </div>
    </div>
  );
};
