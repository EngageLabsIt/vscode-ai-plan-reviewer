import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, Section } from '../../shared/models';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentNavigatorProps {
  comments: Comment[];
  sections: Section[];
  isOpen: boolean;
}

type Category = Comment['category'];
type TabId = 'comments' | 'sections';

interface CategoryMeta {
  key: Category;
  icon: string;
  label: string;
  shortLabel: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: CategoryMeta[] = [
  { key: 'issue',      icon: '🔴', label: 'Issues',      shortLabel: 'Issues'   },
  { key: 'question',   icon: '❓', label: 'Questions',   shortLabel: 'Q'        },
  { key: 'suggestion', icon: '💡', label: 'Suggestions', shortLabel: 'Sugg'     },
  { key: 'approval',   icon: '✅', label: 'Approvals',   shortLabel: 'Approval' },
];

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
  // The remark plugin writes data-start-line on inner elements (p, h1, ul…).
  // Walk up to the containing .line-row to scroll a stable wrapper.
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
// CommentItem
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: Comment;
  icon: string;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, icon }) => {
  const handleClick = useCallback((): void => {
    scrollToLine(comment.targetStart);
  }, [comment.targetStart]);

  return (
    <button
      className="comment-navigator__item"
      onClick={handleClick}
      title={comment.body}
      aria-label={`${locationLabel(comment)}: ${comment.body}`}
    >
      <span className="comment-navigator__item-icon" aria-hidden="true">{icon}</span>
      <span className="comment-navigator__item-body">
        <span className="comment-navigator__item-location">
          {locationLabel(comment)}
          {comment.carriedFromId !== null && (
            <span
              className="comment-navigator__item-carried"
              aria-label="Carried over from previous version"
              title="Carried over from previous version"
            >
              {' '}↩
            </span>
          )}
        </span>
        <span className="comment-navigator__item-preview">{bodyPreview(comment.body)}</span>
      </span>
      {comment.resolved && (
        <span className="comment-navigator__item-resolved" aria-label="Resolved">✓</span>
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------
// CategoryGroup
// ---------------------------------------------------------------------------

interface CategoryGroupProps {
  meta: CategoryMeta;
  comments: Comment[];
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({ meta, comments }) => {
  if (comments.length === 0) return null;

  return (
    <section className="comment-navigator__group" aria-label={meta.label}>
      <h3 className="comment-navigator__group-header">
        <span aria-hidden="true">{meta.icon}</span>
        {' '}{meta.label}{' '}
        <span className="comment-navigator__group-count">({comments.length})</span>
      </h3>
      <ul className="comment-navigator__group-list" role="list">
        {comments.map((c) => (
          <li key={c.id} role="listitem">
            <CommentItem comment={c} icon={meta.icon} />
          </li>
        ))}
      </ul>
    </section>
  );
};

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
          {sectionComments.map((c) => {
            const meta = CATEGORY_ORDER.find((m) => m.key === c.category);
            const icon = meta?.icon ?? '💬';
            return (
              <li key={c.id} role="listitem">
                <button
                  className="comment-navigator__section-comment-item"
                  onClick={() => { scrollToLine(c.targetStart); }}
                  title={c.body}
                  aria-label={`Section comment: ${c.body}`}
                >
                  <span className="comment-navigator__item-icon" aria-hidden="true">{icon}</span>
                  <span className="comment-navigator__item-preview">{bodyPreview(c.body)}</span>
                  {c.resolved && (
                    <span className="comment-navigator__item-resolved" aria-label="Resolved">✓</span>
                  )}
                </button>
              </li>
            );
          })}
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
}) => {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('comments');

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set<Category>(['issue', 'question', 'suggestion', 'approval']),
  );
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  // ── Panel width (resizable) ───────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLElement>(null);

  // ── Derived comment lists ─────────────────────────────────────────────────
  const filteredComments = useMemo<Comment[]>(() => {
    return comments.filter((c) => {
      if (!activeCategories.has(c.category)) return false;
      if (onlyUnresolved && c.resolved) return false;
      return true;
    });
  }, [comments, activeCategories, onlyUnresolved]);

  const groupedComments = useMemo<Record<Category, Comment[]>>(() => {
    const map: Record<Category, Comment[]> = {
      issue: [],
      question: [],
      suggestion: [],
      approval: [],
    };
    for (const c of filteredComments) {
      map[c.category].push(c);
    }
    return map;
  }, [filteredComments]);

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

  // ── Filter toggle handlers ────────────────────────────────────────────────
  const handleToggleCategory = useCallback((category: Category): void => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleToggleUnresolved = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setOnlyUnresolved(e.target.checked);
  }, []);

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
      // Dragging the left border leftward widens the panel.
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

  // Dynamic header title depending on active tab
  const headerTitle =
    activeTab === 'comments'
      ? `Comments (${filteredComments.length}/${comments.length})`
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
        <button
          role="tab"
          id="tab-sections"
          aria-selected={activeTab === 'sections'}
          aria-controls="tabpanel-sections"
          className={[
            'comment-navigator__tab',
            activeTab === 'sections' ? 'comment-navigator__tab--active' : '',
          ].join(' ').trim()}
          onClick={handleSelectSectionsTab}
        >
          Sections
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
        {/* Filter toolbar */}
        <div className="comment-navigator__filters" role="group" aria-label="Filter by category">
          {CATEGORY_ORDER.map((meta) => (
            <button
              key={meta.key}
              className={[
                'comment-navigator__filter-btn',
                activeCategories.has(meta.key)
                  ? 'comment-navigator__filter-btn--active'
                  : 'comment-navigator__filter-btn--inactive',
              ].join(' ')}
              onClick={() => { handleToggleCategory(meta.key); }}
              aria-pressed={activeCategories.has(meta.key)}
              title={`Toggle ${meta.label}`}
            >
              <span aria-hidden="true">{meta.icon}</span>
              {' '}{meta.shortLabel}
            </button>
          ))}
          <label className="comment-navigator__unresolved-label">
            <input
              type="checkbox"
              className="comment-navigator__unresolved-checkbox"
              checked={onlyUnresolved}
              onChange={handleToggleUnresolved}
              aria-label="Only unresolved comments"
            />
            <span>Unresolved only</span>
          </label>
        </div>

        {/* Counter */}
        <p className="comment-navigator__counter" aria-live="polite" aria-atomic="true">
          Showing {filteredComments.length} of {comments.length} comment
          {comments.length !== 1 ? 's' : ''}
        </p>

        {/* Comment groups */}
        <div className="comment-navigator__body">
          {filteredComments.length === 0 ? (
            <p className="comment-navigator__empty">No comments match the current filters.</p>
          ) : (
            CATEGORY_ORDER.map((meta) => (
              <CategoryGroup
                key={meta.key}
                meta={meta}
                comments={groupedComments[meta.key]}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Sections tab panel ─────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="tabpanel-sections"
        aria-labelledby="tab-sections"
        hidden={activeTab !== 'sections'}
        className="comment-navigator__tabpanel"
      >
        <div className="comment-navigator__body">
          {sections.length === 0 ? (
            <p className="comment-navigator__empty">No sections found in this plan.</p>
          ) : (
            <ul className="comment-navigator__group-list" role="list">
              {sections.map((section) => (
                <li key={section.id} role="listitem">
                  <SectionRow
                    section={section}
                    commentCount={sectionCommentCounts.get(section.id) ?? 0}
                    sectionComments={sectionCommentsBySection.get(section.id) ?? []}
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
