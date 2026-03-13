import React from 'react';
import type { Comment, Plan, Version } from '../../shared/models';
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
  onApprove: () => void;
  onSelectVersion: (vn: number) => void;
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
// Config
// ---------------------------------------------------------------------------

const CHIP_CONFIG = [
  { modifier: 'issue',      icon: 'cancel',        count: (c: CommentCounts) => c.issue },
  { modifier: 'suggestion', icon: 'lightbulb',     count: (c: CommentCounts) => c.suggestion },
  { modifier: 'question',   icon: 'help',           count: (c: CommentCounts) => c.question },
  { modifier: 'approval',   icon: 'task_alt',       count: (c: CommentCounts) => c.approval },
] as const;

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
  onApprove,
  onSelectVersion,
}) => {
  const counts = countComments(comments);

  return (
    <div className="review-toolbar" role="toolbar" aria-label="Review toolbar">

      {/* ── LEFT ─────────────────────────────────────── */}
      <div className="review-toolbar__left">
        <span className="review-toolbar__plan-title" title={plan.title}>{plan.title}</span>
        <span className={statusBadgeClass(plan.status)} aria-label={`Status: ${statusLabel(plan.status)}`}>
          {statusLabel(plan.status)}
        </span>
        <select
          className="review-toolbar__version-select"
          aria-label="Version"
          value={versionNumber}
          onChange={(e) => { onSelectVersion(Number(e.target.value)); }}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.versionNumber}>
              v{v.versionNumber}
            </option>
          ))}
        </select>
      </div>

      {/* ── SPACER ───────────────────────────────────── */}
      <div className="review-toolbar__spacer" />

      {/* ── CENTER: comment counts ────────────────────── */}
      <div className="review-toolbar__counts">
        {CHIP_CONFIG.map(({ modifier, icon, count }) => (
          <span
            key={modifier}
            className={`review-toolbar__count-chip review-toolbar__count-chip--${modifier}`}
          >
            <span className="material-symbols-outlined">{icon}</span>{count(counts)}
          </span>
        ))}
      </div>

      {/* ── SPACER ───────────────────────────────────── */}
      <div className="review-toolbar__spacer" />

      {/* ── RIGHT: actions ───────────────────────────── */}
      <div className="review-toolbar__right">
        {/* Navigator toggle — blue pill with total count */}
        <button
          className={`review-toolbar__btn review-toolbar__btn--comments${navigatorOpen ? ' active' : ''}`}
          onClick={onToggleNavigator}
          aria-pressed={navigatorOpen}
          title={navigatorOpen ? 'Hide comment navigator' : 'Show comment navigator'}
        >
          <span className="material-symbols-outlined">chat_bubble</span>
          {counts.total}
        </button>

        {/* Generate Prompt */}
        <button
          className="review-toolbar__btn review-toolbar__btn--ghost"
          onClick={onGeneratePrompt}
          title="Generate review prompt (Ctrl+Shift+G)"
        >
          <span className="material-symbols-outlined">rocket_launch</span>
          Generate Prompt
        </button>

        {/* Approve */}
        <button
          className="review-toolbar__btn review-toolbar__btn--primary"
          onClick={onApprove}
          title="Approve this plan"
        >
          <span className="material-symbols-outlined">check</span>
          Approve
        </button>
      </div>

    </div>
  );
};
