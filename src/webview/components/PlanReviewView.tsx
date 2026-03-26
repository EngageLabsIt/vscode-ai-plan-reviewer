import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import type { Comment } from '../../shared/models';
import { MarkdownBody } from './MarkdownBody';
import { CommentThread } from './CommentThread';
import { CommentForm } from '../features/comments/CommentForm';
import { RangeHighlighter } from './RangeHighlighter';
import { useBlockMapping } from '../hooks/useBlockMapping';
import { useComments } from '../features/comments/CommentContext';

interface PlanReviewViewProps {
  html: string;
  comments: Comment[];
  onUpdateComment: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  globalCommentEditRequested?: number;
  searchMatches?: number[];
  searchIndex?: number;
}

export const PlanReviewView: React.FC<PlanReviewViewProps> = ({
  html,
  comments,
  onUpdateComment,
  onDeleteComment,
  globalCommentEditRequested = 0,
  searchMatches = [],
  searchIndex = 0,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const globalAnchorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const blockMap = useBlockMapping(bodyRef, html);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [markerPositions, setMarkerPositions] = useState<
    { fixedTop: number; fixedRight: number; isCurrent: boolean }[]
  >([]);

  const { openCommentForm, commentFormState } = useComments();

  // Lines already commented (line/range) → hide the + button
  // Excludes 'section' and 'global' because they have different anchors
  const commentedLines = useMemo(
    () =>
      new Set(
        comments
          .filter((c) => c.type !== 'global' && c.type !== 'section')
          .flatMap((c) => {
            const lines: number[] = [];
            for (let i = c.targetStart; i <= c.targetEnd; i++) lines.push(i);
            return lines;
          }),
      ),
    [comments],
  );

  // Anchor line for the form: derived from commentFormState (no local state)
  const pendingLine: number | null = useMemo(() => {
    if (
      commentFormState === null ||
      commentFormState.type === 'global' ||
      commentFormState.type === 'section'
    ) {
      return null;
    }
    if (commentFormState.type === 'line') return commentFormState.lineNumber;
    return commentFormState.endLine; // range — anchor below last line
  }, [commentFormState]);

  // Hover tracking via event delegation — resolves CSS :hover unreliability for li elements
  const handleMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const block = (e.target as Element).closest<HTMLElement>(
        '.annotatable-block[data-line]',
      );
      if (block === null) return;
      const line = parseInt(block.getAttribute('data-line')!, 10);
      if (!isNaN(line)) {
        setHoveredLine((prev) => (prev === line ? prev : line));
      }
    },
    [],
  );

  const handleMouseLeave = useCallback((): void => {
    setHoveredLine(null);
  }, []);

  // Handler for per-block + button
  const handleBlockAdd = useCallback(
    (lineNumber: number): void => {
      openCommentForm({
        type: 'line',
        lineNumber,
        startCharOffset: null,
        endCharOffset: null,
        selectedText: null,
      });
    },
    [openCommentForm],
  );

  // Handler for text selection (range)
  const handleRangeAdd = useCallback(
    (targetStart: number, targetEnd: number, selectedText: string): void => {
      if (targetStart === targetEnd) {
        openCommentForm({
          type: 'line',
          lineNumber: targetStart,
          startCharOffset: null,
          endCharOffset: null,
          selectedText,
        });
      } else {
        openCommentForm({
          type: 'range',
          startLine: targetStart,
          endLine: targetEnd,
          startCharOffset: null,
          endCharOffset: null,
          selectedText,
        });
      }
    },
    [openCommentForm],
  );

  // Portal container for inline form (line/range)
  const [formContainer, setFormContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFormContainer(null);
    if (pendingLine === null) return;

    const anchor = blockMap.get(pendingLine);
    if (anchor === undefined) return;

    const container = document.createElement('div');
    container.className = 'comment-form-portal';
    anchor.insertAdjacentElement('afterend', container);
    setFormContainer(container);

    return () => {
      container.remove();
      setFormContainer(null);
    };
  }, [pendingLine, blockMap]);

  // Portal container for global comment form
  const [globalFormContainer, setGlobalFormContainer] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    setGlobalFormContainer(null);
    if (commentFormState?.type !== 'global') return;
    if (globalAnchorRef.current === null) return;

    const container = document.createElement('div');
    container.className = 'comment-form-portal comment-form-portal--global';
    globalAnchorRef.current.insertAdjacentElement('afterend', container);
    setGlobalFormContainer(container);

    return () => {
      container.remove();
      setGlobalFormContainer(null);
    };
  }, [commentFormState]);

  // Existing global comment
  const globalComment = useMemo(
    () => comments.find((c) => c.type === 'global') ?? null,
    [comments],
  );

  // PBI-004: recalculate scrollbar marker positions using fixed coordinates.
  // position: absolute inside overflow-y: auto scrolls away with content —
  // use position: fixed with getBoundingClientRect() instead.
  const recalcMarkers = useCallback(() => {
    const view = viewRef.current;
    const body = bodyRef.current;
    if (view === null || body === null || searchMatches.length === 0) {
      setMarkerPositions([]);
      return;
    }
    const viewRect = view.getBoundingClientRect();
    const { scrollHeight, scrollTop } = view;
    const fixedRight = window.innerWidth - viewRect.right;
    const currentLine = searchMatches[searchIndex - 1];
    setMarkerPositions(
      searchMatches.map((line) => {
        const el = body.querySelector<HTMLElement>(
          `.annotatable-block[data-line="${line}"]`,
        );
        // Absolute offset from the top of the scrollable content (scroll-invariant)
        const elOffsetFromTop =
          el !== null
            ? el.getBoundingClientRect().top - viewRect.top + scrollTop
            : 0;
        const fixedTop =
          viewRect.top + (elOffsetFromTop / scrollHeight) * viewRect.height;
        return { fixedTop, fixedRight, isCurrent: line === currentLine };
      }),
    );
  }, [searchMatches, searchIndex]);

  // PBI-002: apply/remove search highlight classes from annotatable blocks
  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;
    const matchSet = new Set(searchMatches);
    const currentLine =
      searchMatches.length > 0 ? searchMatches[searchIndex - 1] : undefined;
    body
      .querySelectorAll<HTMLElement>('.annotatable-block[data-line]')
      .forEach((el) => {
        el.classList.remove(
          'line-row--search-match',
          'line-row--search-current',
        );
        const line = parseInt(el.getAttribute('data-line')!, 10);
        if (matchSet.has(line)) {
          el.classList.add(
            line === currentLine
              ? 'line-row--search-current'
              : 'line-row--search-match',
          );
        }
      });
  }, [searchMatches, searchIndex, html]);

  // PBI-003: scroll smooth to current match
  useEffect(() => {
    if (searchMatches.length === 0) return;
    const currentLine = searchMatches[searchIndex - 1];
    if (currentLine === undefined) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(
      `.annotatable-block[data-line="${currentLine}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchMatches, searchIndex, html]);

  // PBI-004: recalc markers when search state or content changes
  useEffect(() => {
    recalcMarkers();
  }, [recalcMarkers, html]);

  // PBI-004: recalc markers on container resize
  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const observer = new ResizeObserver(recalcMarkers);
    observer.observe(view);
    return () => {
      observer.disconnect();
    };
  }, [recalcMarkers]);

  return (
    <div
      ref={viewRef}
      className='plan-review-view'
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      {/* Anchor for global comment (top of page) */}
      <div ref={globalAnchorRef} className='global-comment-anchor' />

      {/* Global comment thread */}
      {globalComment !== null && (
        <CommentThread
          comment={globalComment}
          anchorElement={globalAnchorRef.current ?? undefined}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          editRequested={globalCommentEditRequested}
        />
      )}

      {/* Global comment form */}
      {globalFormContainer !== null &&
        createPortal(<CommentForm />, globalFormContainer)}

      <MarkdownBody ref={bodyRef} html={html} />

      {/* + buttons per-block (portaled inside each .annotatable-block) */}
      {Array.from(blockMap.entries()).map(([lineNumber, el]) => {
        if (commentedLines.has(lineNumber)) return null;
        const isVisible = hoveredLine === lineNumber;
        return createPortal(
          <button
            className={`block-comment-btn${isVisible ? ' block-comment-btn--visible' : ''}`}
            title='Add comment'
            aria-label={`Add comment to line ${lineNumber}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent deselecting text
              handleBlockAdd(lineNumber);
            }}
          >
            <span className='material-symbols-outlined'>add_comment</span>
          </button>,
          el,
          String(lineNumber),
        );
      })}

      {/* Comment threads for line/range/section */}
      {comments
        .filter((c) => c.type !== 'global')
        .map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            anchorElement={blockMap.get(
              comment.type === 'range'
                ? blockMap.has(comment.targetEnd)
                  ? comment.targetEnd
                  : comment.targetStart
                : comment.targetStart,
            )}
            onUpdate={onUpdateComment}
            onDelete={onDeleteComment}
          />
        ))}

      {/* Inline form for line/range */}
      {formContainer !== null && createPortal(<CommentForm />, formContainer)}

      <RangeHighlighter
        bodyRef={bodyRef}
        comments={comments}
        onAddRangeComment={handleRangeAdd}
      />

      {markerPositions.map(({ fixedTop, fixedRight, isCurrent }, i) => (
        <div
          key={i}
          aria-hidden='true'
          className={`search-scrollbar-marker${
            isCurrent ? ' search-scrollbar-marker--current' : ''
          }`}
          style={{ position: 'fixed', top: `${fixedTop}px`, right: `${fixedRight}px` }}
        />
      ))}
    </div>
  );
};
