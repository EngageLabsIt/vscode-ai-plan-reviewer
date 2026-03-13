import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, Plan, Version } from '../../shared/models';
import { useVsCodeApi } from '../hooks/useVsCodeApi';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewToolbarProps {
  plan: Plan;
  versionNumber: number;
  versions: Version[];
  comments: Comment[];
  onToggleNavigator: () => void;
  navigatorOpen: boolean;
  onGeneratePrompt: () => void;
  onToggleDiff: () => void;
  diffActive: boolean;
  diffPair?: { oldVN: number; newVN: number } | null;
  onDiffPrev?: () => void;
  onDiffNext?: () => void;
  diffViewMode?: 'inline' | 'side-by-side';
  onToggleDiffViewMode?: () => void;
}

interface CommentCounts {
  issue: number;
  suggestion: number;
  question: number;
  approval: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countComments(comments: Comment[]): CommentCounts {
  const counts = { issue: 0, suggestion: 0, question: 0, approval: 0, total: 0 };
  for (const c of comments) {
    if (c.category === 'issue') counts.issue++;
    else if (c.category === 'suggestion') counts.suggestion++;
    else if (c.category === 'question') counts.question++;
    else if (c.category === 'approval') counts.approval++;
    counts.total++;
  }
  return counts;
}

function statusLabel(status: Plan['status']): string {
  switch (status) {
    case 'in_review':      return 'In Review';
    case 'approved':       return 'Approved';
    case 'archived':       return 'Archived';
    case 'needs_revision': return 'Needs Revision';
    default:               return '';
  }
}

function statusBadgeClass(status: Plan['status']): string {
  switch (status) {
    case 'in_review':      return 'review-toolbar__badge review-toolbar__badge--in-review';
    case 'approved':       return 'review-toolbar__badge review-toolbar__badge--approved';
    case 'archived':       return 'review-toolbar__badge review-toolbar__badge--archived';
    case 'needs_revision': return 'review-toolbar__badge review-toolbar__badge--needs-revision';
    default:               return 'review-toolbar__badge';
  }
}

// ---------------------------------------------------------------------------
// QuickApproveModal
// ---------------------------------------------------------------------------

interface QuickApproveModalProps {
  onClose: () => void;
  onSubmit: (note: string) => void;
}

const QuickApproveModal: React.FC<QuickApproveModalProps> = ({ onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on Escape; trap focus inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      // Focus-trap: cycle between textarea, submit, close
      const focusable = [
        textareaRef.current,
        submitBtnRef.current,
        closeBtnRef.current,
      ].filter((el): el is HTMLElement => el !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [onClose]);

  const handleSubmit = useCallback((): void => {
    onSubmit(note.trim());
  }, [note, onSubmit]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      className="review-toolbar__modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        className="review-toolbar__modal"
        role="dialog"
        aria-modal={true}
        aria-labelledby="quick-approve-title"
      >
        <h3 id="quick-approve-title" className="review-toolbar__modal-title">
          Quick Approve
        </h3>
        <p className="review-toolbar__modal-desc">
          Optionally add a note before approving.
        </p>
        <textarea
          ref={textareaRef}
          className="review-toolbar__modal-textarea"
          placeholder="Approval note (optional)…"
          value={note}
          onChange={(e) => { setNote(e.target.value); }}
          rows={4}
          aria-label="Approval note"
        />
        <div className="review-toolbar__modal-actions">
          <button
            ref={submitBtnRef}
            className="review-toolbar__btn review-toolbar__btn--primary"
            onClick={handleSubmit}
          >
            Approve
          </button>
          <button
            ref={closeBtnRef}
            className="review-toolbar__btn review-toolbar__btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CommentCountsBar
// ---------------------------------------------------------------------------

interface CommentCountsBarProps {
  counts: CommentCounts;
}

const CommentCountsBar: React.FC<CommentCountsBarProps> = ({ counts }) => {
  const fullLabel =
    `${counts.issue} issue${counts.issue !== 1 ? 's' : ''}, ` +
    `${counts.suggestion} suggestion${counts.suggestion !== 1 ? 's' : ''}, ` +
    `${counts.question} question${counts.question !== 1 ? 's' : ''}, ` +
    `${counts.approval} approval${counts.approval !== 1 ? 's' : ''}`;

  return (
    <div className="review-toolbar__counts" title={fullLabel} aria-label={fullLabel}>
      {/* Full counts — hidden below 500 px via CSS */}
      <span className="review-toolbar__counts-full">
        <span className="review-toolbar__count-item">
          🔴 <span>{counts.issue}</span>{' '}
          {counts.issue === 1 ? 'issue' : 'issues'}
        </span>
        <span className="review-toolbar__count-sep" aria-hidden="true"> · </span>
        <span className="review-toolbar__count-item">
          💡 <span>{counts.suggestion}</span>{' '}
          {counts.suggestion === 1 ? 'suggestion' : 'suggestions'}
        </span>
        <span className="review-toolbar__count-sep" aria-hidden="true"> · </span>
        <span className="review-toolbar__count-item">
          ❓ <span>{counts.question}</span>{' '}
          {counts.question === 1 ? 'question' : 'questions'}
        </span>
        <span className="review-toolbar__count-sep" aria-hidden="true"> · </span>
        <span className="review-toolbar__count-item">
          ✅ <span>{counts.approval}</span>{' '}
          {counts.approval === 1 ? 'approval' : 'approvals'}
        </span>
      </span>

      {/* Compact total — shown only below 500 px via CSS */}
      <span
        className="review-toolbar__counts-compact"
        title={fullLabel}
        aria-hidden="true"
      >
        💬 {counts.total}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ReviewToolbar
// ---------------------------------------------------------------------------

export const ReviewToolbar: React.FC<ReviewToolbarProps> = ({
  plan,
  versionNumber,
  versions,
  comments,
  onToggleNavigator,
  navigatorOpen,
  onGeneratePrompt,
  onToggleDiff,
  diffActive,
  diffPair,
  onDiffPrev,
  onDiffNext,
  diffViewMode,
  onToggleDiffViewMode,
}) => {
  const vscode = useVsCodeApi();
  const [quickApproveOpen, setQuickApproveOpen] = useState(false);

  const counts = useMemo(() => countComments(comments), [comments]);

  const handleRequestChanges = useCallback((): void => {
    vscode.postMessage({
      type: 'updatePlanStatus',
      payload: { planId: plan.id, status: 'needs_revision' },
    });
  }, [vscode, plan.id]);

  const handleApprove = useCallback((): void => {
    vscode.postMessage({
      type: 'updatePlanStatus',
      payload: { planId: plan.id, status: 'approved' },
    });
  }, [vscode, plan.id]);

  const handleQuickApproveSubmit = useCallback((note: string): void => {
    vscode.postMessage({
      type: 'updatePlanStatus',
      payload: { planId: plan.id, status: 'approved', ...(note.length > 0 ? { note } : {}) },
    });
    setQuickApproveOpen(false);
  }, [vscode, plan.id]);

  const handleOpenQuickApprove = useCallback((): void => {
    setQuickApproveOpen(true);
  }, []);

  const handleCloseQuickApprove = useCallback((): void => {
    setQuickApproveOpen(false);
  }, []);

  const navigatorLabel = navigatorOpen ? '◀ Comments' : 'Comments ▶';

  return (
    <>
      <div className="review-toolbar" role="toolbar" aria-label="Review toolbar">
        {/* ── Left: title + status ──────────────────────────────── */}
        <div className="review-toolbar__left">
          <span className="review-toolbar__title" title={plan.title}>
            {plan.title}
          </span>
          <span className={statusBadgeClass(plan.status)} aria-label={`Status: ${statusLabel(plan.status)}`}>
            {statusLabel(plan.status)}
          </span>
        </div>

        {/* ── Center: comment counts ────────────────────────────── */}
        <div className="review-toolbar__center">
          <CommentCountsBar counts={counts} />
        </div>

        {/* ── Right: actions ───────────────────────────────────── */}
        <div className="review-toolbar__right">
          {/* Diff toggle */}
          <button
            className={`review-toolbar__btn ${diffActive ? 'review-toolbar__btn--primary' : 'review-toolbar__btn--ghost'} review-toolbar__btn--diff`}
            onClick={onToggleDiff}
            aria-pressed={diffActive}
            title="Toggle Diff View (Ctrl+Shift+D)"
          >
            {'\u26a1'} Diff
          </button>

          {/* Version selector — replaced by navigable pair label when diff is active */}
          {diffActive ? (
            <span className="review-toolbar__version-label review-toolbar__version-label--diff-nav">
              <button
                className="review-toolbar__btn review-toolbar__btn--ghost review-toolbar__btn--nav"
                onClick={onDiffPrev}
                disabled={diffPair === null || diffPair === undefined || diffPair.oldVN <= 1}
                aria-label="Previous version pair"
                title="Previous version pair"
              >
                {'\u25c0'}
              </button>
              <span aria-label={diffPair != null ? `Comparing v${diffPair.oldVN} with v${diffPair.newVN}` : ''}>
                {diffPair != null
                  ? `v${diffPair.oldVN} \u2194 v${diffPair.newVN}`
                  : '\u2194'}
              </span>
              <button
                className="review-toolbar__btn review-toolbar__btn--ghost review-toolbar__btn--nav"
                onClick={onDiffNext}
                disabled={diffPair === null || diffPair === undefined || diffPair.newVN >= versions.length}
                aria-label="Next version pair"
                title="Next version pair"
              >
                {'\u25b6'}
              </button>
              <button
                className="review-toolbar__btn review-toolbar__btn--ghost"
                onClick={onToggleDiffViewMode}
                title="Toggle diff view mode"
                aria-label={diffViewMode === 'inline' ? 'Switch to side-by-side view' : 'Switch to inline view'}
              >
                {diffViewMode === 'inline' ? 'Inline' : 'Side-by-side'}
              </button>
            </span>
          ) : (
            <select
              className="review-toolbar__version-select"
              aria-label="Version"
              value={versionNumber}
              onChange={(e) => {
                vscode.postMessage({
                  type: 'requestPlan',
                  payload: { planId: plan.id, versionNumber: Number(e.target.value) },
                });
              }}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.versionNumber}>
                  v{v.versionNumber}
                </option>
              ))}
            </select>
          )}

          <button
            className="review-toolbar__btn review-toolbar__btn--secondary"
            onClick={handleRequestChanges}
            title="Mark as needing further review"
          >
            Request Changes
          </button>

          <button
            className="review-toolbar__btn review-toolbar__btn--primary"
            onClick={handleApprove}
            title="Approve this plan"
          >
            Approve
          </button>

          <button
            className="review-toolbar__btn review-toolbar__btn--primary"
            onClick={handleOpenQuickApprove}
            title="Approve with an optional note"
          >
            Quick Approve
          </button>

          {(plan.status === 'in_review' || plan.status === 'needs_revision') && counts.total > 0 && (
            <button
              className="review-toolbar__btn review-toolbar__btn--ghost"
              onClick={onGeneratePrompt}
              title="Generate review prompt (Ctrl+Shift+G)"
            >
              Generate Prompt
            </button>
          )}

          <button
            className="review-toolbar__btn review-toolbar__btn--ghost"
            onClick={onToggleNavigator}
            aria-pressed={navigatorOpen}
            title={navigatorOpen ? 'Hide comment navigator' : 'Show comment navigator'}
          >
            {navigatorLabel}
          </button>
        </div>
      </div>

      {quickApproveOpen && (
        <QuickApproveModal
          onClose={handleCloseQuickApprove}
          onSubmit={handleQuickApproveSubmit}
        />
      )}
    </>
  );
};
