import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment } from '../../../shared/models';
import { CommentCard } from './CommentCard';
import { useComments } from './CommentContext';
import '../../styles/planViewer.css';
import {
  NAVIGATOR_MIN_WIDTH,
  NAVIGATOR_MAX_WIDTH,
  NAVIGATOR_DEFAULT_WIDTH,
} from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentNavigatorProps {
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// CommentNavigator
// ---------------------------------------------------------------------------

export const CommentNavigator: React.FC<CommentNavigatorProps> = ({
  isOpen,
}) => {
  const { comments } = useComments();

  // ── Panel width (resizable) ───────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(NAVIGATOR_DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(NAVIGATOR_DEFAULT_WIDTH);
  const panelRef = useRef<HTMLElement>(null);

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
      const newWidth = Math.min(NAVIGATOR_MAX_WIDTH, Math.max(NAVIGATOR_MIN_WIDTH, dragStartWidth.current + delta));
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

      {/* Panel header */}
      <div className="comment-navigator__header">
        <span className="comment-navigator__header-title">Comments</span>
      </div>

      {/* Tab bar */}
      <div className="comment-navigator__tabs" role="tablist" aria-label="Navigator tabs">
        <button
          role="tab"
          id="tab-comments"
          aria-selected={true}
          aria-controls="tabpanel-comments"
          className="comment-navigator__tab comment-navigator__tab--active"
        >
          Comments
        </button>
      </div>

      {/* Comments tab panel */}
      <div
        role="tabpanel"
        id="tabpanel-comments"
        aria-labelledby="tab-comments"
        className="comment-navigator__tabpanel"
      >
        <div className="comment-navigator__body">
          {comments.length === 0 ? (
            <p className="comment-navigator__empty">No comments yet.</p>
          ) : (
            <ul className="comment-navigator__group-list" role="list">
              {comments.map((c: Comment) => (
                <li key={c.id} role="listitem">
                  <CommentCard comment={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </aside>
  );
};
