import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, Section } from '../../shared/models';
import { CommentCard } from './CommentCard';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentNavigatorProps {
  comments: Comment[];
  sections: Section[];
  isOpen: boolean;
  onEdit?:    (id: string, body: string) => void;
  onDelete?:  (id: string) => void;
  onResolve?: (id: string) => void;
}

type TabId = 'comments' | 'sections';

const highlightTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;
const HIGHLIGHT_DURATION_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationLabel(comment: Comment): string {
  if (comment.type === 'line') return `Line ${comment.targetStart}`;
  if (comment.type === 'range') return `Lines ${comment.targetStart}–${comment.targetEnd}`;
  return 'Section';
}

function bodyPreview(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 50 ? `${trimmed.slice(0, 50)}\u2026` : trimmed;
}

function scrollToLine(targetStart: number): void {
  const el = document.querySelector<HTMLElement>(`[data-start-line="${targetStart}"]`);
  if (el === null) return;

  const row = el.closest<HTMLElement>('.line-row') ?? el;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });

  clearTimeout(highlightTimers.get(row));
  row.classList.add('line-highlighted');
  highlightTimers.set(row, window.setTimeout(() => {
    row.classList.remove('line-highlighted');
    highlightTimers.delete(row);
  }, HIGHLIGHT_DURATION_MS));
}

// ---------------------------------------------------------------------------
// SectionRow
// ---------------------------------------------------------------------------

interface SectionRowProps {
  section: Section;
  commentCount: number;
  sectionComments?: Comment[];
}

const SectionRow: React.FC<SectionRowProps> = ({ section, commentCount, sectionComments = [] }) => {
  const handleClick = useCallback((): void => {
    scrollToLine(section.startLine);
  }, [section.startLine]);

  return (
    <div className="comment-navigator__section-item">
      <button
        className="comment-navigator__section-row"
        onClick={handleClick}
        aria-label={`${section.heading}, ${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
        title={section.heading}
      >
        <span className="comment-navigator__section-heading">{section.heading}</span>
        {commentCount > 0 && (
          <span className="comment-navigator__section-count" aria-hidden="true">
            {commentCount}
          </span>
        )}
      </button>
      {sectionComments.length > 0 && (
        <ul className="comment-navigator__section-comment-list" role="list">
          {sectionComments.map((c) => (
            <li key={c.id} role="listitem">
              <button
                className="comment-navigator__section-comment-item"
                onClick={() => { scrollToLine(c.targetStart); }}
                title={c.body}
                aria-label={`Section comment: ${c.body}`}
              >
                <span className="comment-navigator__item-icon" aria-hidden="true">💡</span>
                <span className="comment-navigator__item-preview">{bodyPreview(c.body)}</span>
                {c.resolved && (
                  <span className="comment-navigator__item-resolved" aria-label="Resolved">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CommentNavigator
// ---------------------------------------------------------------------------

export const CommentNavigator: React.FC<CommentNavigatorProps> = ({
  comments,
  sections,
  isOpen,
  onEdit,
  onDelete,
  onResolve,
}) => {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('comments');

  // ── Panel width (resizable) ───────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLElement>(null);

  // ── Per-section comment counts (for Sections tab) ─────────────────────────
  const sectionCommentCounts = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      if (c.sectionId !== null && c.type === 'section') {
        map.set(c.sectionId, (map.get(c.sectionId) ?? 0) + 1);
      }
    }
    return map;
  }, [comments]);

  // ── Per-section comment objects (section-type only, for Sections tab) ──────
  const sectionCommentsBySection = useMemo<Map<string, Comment[]>>(() => {
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.type === 'section' && c.sectionId !== null) {
        const existing = map.get(c.sectionId) ?? [];
        map.set(c.sectionId, [...existing, c]);
      }
    }
    return map;
  }, [comments]);

  // ── Tab handlers ──────────────────────────────────────────────────────────
  const handleSelectCommentsTab = useCallback((): void => {
    setActiveTab('comments');
  }, []);

  const handleSelectSectionsTab = useCallback((): void => {
    setActiveTab('sections');
  }, []);

  // ── Resize logic ──────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = (): void => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const navigatorClass = [
    'comment-navigator',
    isOpen ? 'comment-navigator--open' : 'comment-navigator--closed',
  ].join(' ');

  const panelStyle = isOpen ? { width: `${panelWidth}px` } : undefined;

  const headerTitle =
    activeTab === 'comments'
      ? `Comments`
      : `Sections (${sections.length})`;

  return (
    <aside
      ref={panelRef}
      className={navigatorClass}
      style={panelStyle}
      aria-label="Comment navigator"
      aria-hidden={!isOpen}
    >
      {/* Drag handle — left border */}
      <div
        className="comment-navigator__resize-handle"
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-label="Resize comment navigator"
        aria-orientation="vertical"
      />

      {/* Panel header with title */}
      <div className="comment-navigator__header">
        <span className="comment-navigator__header-title">{headerTitle}</span>
      </div>

      {/* Tab bar */}
      <div className="comment-navigator__tabs" role="tablist" aria-label="Navigator tabs">
        <button
          role="tab"
          id="tab-comments"
          aria-selected={activeTab === 'comments'}
          aria-controls="tabpanel-comments"
          className={[
            'comment-navigator__tab',
            activeTab === 'comments' ? 'comment-navigator__tab--active' : '',
          ].join(' ').trim()}
          onClick={handleSelectCommentsTab}
        >
          Comments
        </button>
      </div>

      {/* ── Comments tab panel ─────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="tabpanel-comments"
        aria-labelledby="tab-comments"
        hidden={activeTab !== 'comments'}
        className="comment-navigator__tabpanel"
      >

        {/* Flat comment list */}
        <div className="comment-navigator__body">
          {comments.length === 0 ? (
            <p className="comment-navigator__empty">No comments yet.</p>
          ) : (
            <ul className="comment-navigator__group-list" role="list">
              {comments.map((c) => (
                <li key={c.id} role="listitem">
                  <CommentCard
                    comment={c}
                    onEdit={onEdit ?? (() => {})}
                    onDelete={onDelete ?? (() => {})}
                    onResolve={onResolve ?? (() => {})}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </aside>
  );
};
