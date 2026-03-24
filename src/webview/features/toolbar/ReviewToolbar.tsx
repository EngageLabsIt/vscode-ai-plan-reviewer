import React from 'react';
import type { Comment, Plan, Version } from '../../../shared/models';
import '../../styles/planViewer.css';

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
  onGlobalComment: () => void;
  hasGlobalComment: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<Plan['status'], { label: string; badgeClass: string }> = {
  in_review: { label: 'In Review', badgeClass: 'review-toolbar__badge review-toolbar__badge--in-review' },
  archived:  { label: 'Archived',  badgeClass: 'review-toolbar__badge review-toolbar__badge--archived' },
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
  onToggleSearch,
  searchOpen,
  onGeneratePrompt,
  onApprove,
  onSelectVersion,
  onGlobalComment,
  hasGlobalComment,
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

        {/* Global Review */}
        <button
          className={`review-toolbar__btn review-toolbar__btn--ghost${hasGlobalComment ? ' active' : ''}`}
          onClick={onGlobalComment}
          title={hasGlobalComment ? 'Modifica review globale del piano' : 'Aggiungi review globale del piano'}
        >
          <span className="material-symbols-outlined">rate_review</span>
          {hasGlobalComment ? 'Modifica Review' : 'Review Globale'}
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
