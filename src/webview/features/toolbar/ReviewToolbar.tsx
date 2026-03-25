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
    <div className='review-toolbar' role='toolbar' aria-label='Review toolbar'>
      {/* ── LEFT ─────────────────────────────────────── */}
      <div className='review-toolbar__left'>
        <span className='review-toolbar__plan-title' title={plan.title}>
          {plan.title}
        </span>
        <select
          className='review-toolbar__version-select'
          aria-label='Version'
          value={versionNumber}
          onChange={(e) => {
            onSelectVersion(Number(e.target.value));
          }}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.versionNumber}>
              v{v.versionNumber}
            </option>
          ))}
        </select>
      </div>

      {/* ── SPACER ───────────────────────────────────── */}
      <div className='review-toolbar__spacer' />

      {/* ── RIGHT: actions ───────────────────────────── */}
      <div className='review-toolbar__right'>
        {/* Search toggle */}
        <button
          className={`review-toolbar__btn review-toolbar__btn--ghost${searchOpen ? ' active' : ''}`}
          onClick={onToggleSearch}
          aria-pressed={searchOpen}
          title='Search in plan (Ctrl+F)'
        >
          <span className='material-symbols-outlined'>search</span>
        </button>

        {/* Split button: Global Review (primary) + Comment Navigator toggle (chevron) */}
        <div className='review-toolbar__split-btn'>
          <button
            className={`review-toolbar__split-btn__primary${hasGlobalComment ? ' active' : ''}`}
            onClick={onGlobalComment}
            aria-pressed={hasGlobalComment}
            title={
              hasGlobalComment ? 'Edit global review' : 'Add global review'
            }
          >
            <span className='material-symbols-outlined'>rate_review</span>
            {hasGlobalComment ? 'Edit Review' : 'Global Review'}
            {comments.length > 0 && (
              <span className='review-toolbar__split-btn__badge'>
                {comments.length}
              </span>
            )}
          </button>
          <button
            className={`review-toolbar__split-btn__chevron${navigatorOpen ? ' active' : ''}`}
            onClick={onToggleNavigator}
            aria-pressed={navigatorOpen}
            title={
              navigatorOpen
                ? 'Hide comment navigator'
                : 'Show comment navigator'
            }
          >
            <span className='material-symbols-outlined'>
              {navigatorOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Generate Prompt */}
        <button
          className='review-toolbar__btn review-toolbar__btn--ghost'
          onClick={onGeneratePrompt}
          title='Generate review prompt (Ctrl+Shift+G)'
        >
          <span className='material-symbols-outlined'>rocket_launch</span>
          Generate Prompt
        </button>
      </div>
    </div>
  );
};
