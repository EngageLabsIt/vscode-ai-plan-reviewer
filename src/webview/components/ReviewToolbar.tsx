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
  onToggleSearch: () => void;
  searchOpen: boolean;
  onGeneratePrompt: () => void;
  onApprove: () => void;
  onSelectVersion: (vn: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// ReviewToolbar
// ---------------------------------------------------------------------------

export const ReviewToolbar: React.FC<ReviewToolbarProps> = ({
  plan,
  versionNumber,
  versions,
  comments,
  onToggleNavigator,
  navigatorOpen,
  onToggleSearch,
  searchOpen,
  onGeneratePrompt,
  onApprove,
  onSelectVersion,
}) => {
  return (
    <div className="review-toolbar" role="toolbar" aria-label="Review toolbar">

      {/* ── LEFT ─────────────────────────────────────── */}
      <div className="review-toolbar__left">
        <span className="review-toolbar__plan-title" title={plan.title}>{plan.title}</span>
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

      {/* ── RIGHT: actions ───────────────────────────── */}
      <div className="review-toolbar__right">
        {/* Search toggle */}
        <button
          className={`review-toolbar__btn review-toolbar__btn--ghost${searchOpen ? ' active' : ''}`}
          onClick={onToggleSearch}
          aria-pressed={searchOpen}
          title="Search in plan (Ctrl+F)"
        >
          <span className="material-symbols-outlined">search</span>
        </button>

        {/* Navigator toggle — blue pill with total count */}
        <button
          className={`review-toolbar__btn review-toolbar__btn--comments${navigatorOpen ? ' active' : ''}`}
          onClick={onToggleNavigator}
          aria-pressed={navigatorOpen}
          title={navigatorOpen ? 'Hide comment navigator' : 'Show comment navigator'}
        >
          <span className="material-symbols-outlined">chat_bubble</span>
          {comments.length}
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
      </div>
    </div>
  );
};
