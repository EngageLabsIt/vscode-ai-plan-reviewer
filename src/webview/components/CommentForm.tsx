import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment } from '../../shared/models';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = Comment['category'];

export type CommentTarget =
  | { type: 'line';    lineNumber: number }
  | { type: 'range';   startLine: number; endLine: number }
  | { type: 'section'; heading: string };

function targetLabel(t: CommentTarget): string {
  if (t.type === 'line')   return `Line ${t.lineNumber}`;
  if (t.type === 'range')  return `Lines ${t.startLine}–${t.endLine}`;
  return `Section: ${t.heading}`;
}

interface CommentFormProps {
  target: CommentTarget;
  onSubmit: (body: string, category: Category) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface CategoryOption {
  value: Category;
  label: string;
  icon: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'issue',      label: 'Issue',      icon: '🔴' },
  { value: 'suggestion', label: 'Suggestion',  icon: '💡' },
  { value: 'question',   label: 'Question',   icon: '❓' },
  { value: 'approval',   label: 'Approval',   icon: '✅' },
];

// ---------------------------------------------------------------------------
// CommentForm
// ---------------------------------------------------------------------------

export const CommentForm: React.FC<CommentFormProps> = ({
  target,
  onSubmit,
  onCancel,
}) => {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Category>('suggestion');
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setBody(e.target.value);
    if (validationError !== null && e.target.value.trim().length > 0) {
      setValidationError(null);
    }
  }, [validationError]);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    setCategory(e.target.value as Category);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    if (body.trim().length === 0) {
      setValidationError('Comment body must not be empty.');
      textareaRef.current?.focus();
      return;
    }
    onSubmit(body.trim(), category);
  }, [body, category, onSubmit]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    // Close only when clicking the backdrop itself, not the dialog
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <div
      className="comment-form__backdrop"
      onClick={handleBackdropClick}
      aria-label="Close comment form"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-form-heading"
        className="comment-form"
      >
        <h2 id="comment-form-heading" className="comment-form__header">
          Comment on: <span className="comment-form__section-name">{targetLabel(target)}</span>
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="comment-form__field">
            <label htmlFor="comment-form-body" className="comment-form__label">
              Comment
            </label>
            <textarea
              id="comment-form-body"
              ref={textareaRef}
              className={[
                'comment-form__textarea',
                validationError !== null ? 'comment-form__textarea--error' : '',
              ].join(' ').trim()}
              value={body}
              onChange={handleBodyChange}
              rows={5}
              aria-describedby={validationError !== null ? 'comment-form-error' : undefined}
              aria-invalid={validationError !== null}
              placeholder="Enter your comment…"
            />
            {validationError !== null && (
              <p id="comment-form-error" className="comment-form__error" role="alert">
                {validationError}
              </p>
            )}
          </div>

          <div className="comment-form__field">
            <label htmlFor="comment-form-category" className="comment-form__label">
              Category
            </label>
            <select
              id="comment-form-category"
              className="comment-form__select"
              value={category}
              onChange={handleCategoryChange}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="comment-form__actions">
            <button
              type="button"
              className="comment-form__btn comment-form__btn--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="comment-form__btn comment-form__btn--submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
