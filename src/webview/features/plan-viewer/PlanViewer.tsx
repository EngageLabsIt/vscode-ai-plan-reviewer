import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, RenderedLine, Section } from '../../../shared/models';
import { LineGutter } from './LineGutter';
import { CommentCard } from '../comments/CommentCard';
import { CommentForm } from '../comments/CommentForm';
import { CodeBlock } from './CodeBlock';
import { useComments } from '../comments/CommentContext';
import '../../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanViewerProps {
  content: string;
  renderedLines: RenderedLine[];
  sections: Section[];
  versionNumber: number;
  sectionComments?: Comment[];
  allComments?: Comment[];
  onCommentSection?: (sectionId: string) => void;
  onAddLineComment?: (lineNumber: number) => void;
  onLineShiftClick?: (lineNumber: number) => void;
  commentRange?: { start: number; end: number } | null;
  searchMatches?: number[];
  searchCurrentLine?: number | null;
  onSelectionComment?: (startLine: number, endLine: number, startChar: number | null, endChar: number | null, selectedText: string) => void;
}

// ---------------------------------------------------------------------------
// SectionCommentBadge — inline badge rendered below a heading
// ---------------------------------------------------------------------------

interface SectionCommentBadgeProps {
  comment: Comment;
}

const SectionCommentBadge: React.FC<SectionCommentBadgeProps> = ({ comment }) => {
  const labelClass = [
    'section-comment-badge__label',
    comment.carriedFromId !== null ? 'section-comment-badge--carried' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="section-comment-badge" aria-label={`Section comment: ${comment.body}`}>
      <span className={labelClass} aria-hidden="true">
        📌 Section comment
      </span>
      <span className="section-comment-badge__body">{comment.body}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// isLineVisible helper
// ---------------------------------------------------------------------------

function isLineVisible(lineNumber: number, sections: Section[], collapsed: Set<number>): boolean {
  for (const sec of sections) {
    if (collapsed.has(sec.startLine) && lineNumber > sec.startLine && lineNumber <= sec.endLine) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Char-offset helpers for CSS Custom Highlight API
// ---------------------------------------------------------------------------

function getTextOffset(container: Element, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    if (node === targetNode) return count + targetOffset;
    count += (node.textContent ?? '').length;
  }
  return count;
}

function findTextPosition(container: Element, charOffset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const len = (node.textContent ?? '').length;
    if (count + len >= charOffset) return { node: node as Text, offset: charOffset - count };
    count += len;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PlanViewer
// ---------------------------------------------------------------------------

export const PlanViewer: React.FC<PlanViewerProps> = ({
  content,
  renderedLines,
  sections,
  versionNumber,
  sectionComments = [],
  allComments,
  onCommentSection,
  onAddLineComment,
  onLineShiftClick,
  commentRange,
  searchMatches = [],
  searchCurrentLine = null,
  onSelectionComment,
}) => {
  const { activeCommentLine, commentFormState } = useComments();
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [selectionState, setSelectionState] = useState<{
    startLine: number; endLine: number;
    startCharOffset: number | null; endCharOffset: number | null;
    selectedText: string;
  } | null>(null);
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Scroll to current search match
  useEffect(() => {
    if (searchCurrentLine !== null && viewerRef.current !== null) {
      const row = viewerRef.current.querySelector(`#line-${searchCurrentLine}`);
      if (row !== null) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [searchCurrentLine]);

  // Apply CSS Custom Highlight API for saved comment ranges
  useEffect(() => {
    // @ts-expect-error CSS Highlight API not yet in TS lib
    if (typeof CSS === 'undefined' || CSS.highlights === undefined) return;
    // @ts-expect-error
    CSS.highlights.delete('comment-selection');
    if (viewerRef.current === null) return;

    const ranges: Range[] = [];
    for (const c of (allComments ?? [])) {
      if (c.targetStartChar === null || c.targetEndChar === null || c.resolved) continue;
      const startEl = viewerRef.current.querySelector(`#line-${c.targetStart} .line-content`);
      const endEl   = viewerRef.current.querySelector(`#line-${c.targetEnd} .line-content`);
      if (startEl === null || endEl === null) continue;
      const startPos = findTextPosition(startEl, c.targetStartChar);
      const endPos   = findTextPosition(endEl, c.targetEndChar);
      if (startPos === null || endPos === null) continue;
      const r = document.createRange();
      r.setStart(startPos.node, startPos.offset);
      r.setEnd(endPos.node, endPos.offset);
      ranges.push(r);
    }
    if (ranges.length > 0) {
      // @ts-expect-error
      CSS.highlights.set('comment-selection', new Highlight(...ranges));
    }
    return () => {
      // @ts-expect-error
      CSS.highlights?.delete('comment-selection');
    };
  }, [allComments, content]);

  // Handle text selection for floating comment button
  const handleMouseUp = useCallback((e: React.MouseEvent): void => {
    const selection = window.getSelection();
    if (selection === null || selection.isCollapsed) {
      setSelectionState(null);
      setSelectionPos(null);
      return;
    }
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) {
      setSelectionState(null);
      setSelectionPos(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const startEl = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer as Element;
    const endEl = range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : range.endContainer as Element;

    const startRow = startEl?.closest<HTMLElement>('[data-line]');
    const endRow = endEl?.closest<HTMLElement>('[data-line]');

    if (startRow === null || startRow === undefined || endRow === null || endRow === undefined) {
      setSelectionState(null);
      setSelectionPos(null);
      return;
    }

    const startLine = parseInt(startRow.getAttribute('data-line') ?? '', 10);
    const endLine = parseInt(endRow.getAttribute('data-line') ?? '', 10);

    if (isNaN(startLine) || isNaN(endLine)) {
      setSelectionState(null);
      setSelectionPos(null);
      return;
    }

    const startContent = startRow.querySelector('.line-content');
    const endContent = endRow.querySelector('.line-content');
    const startCharOffset = startContent !== null
      ? getTextOffset(startContent, range.startContainer, range.startOffset)
      : null;
    const endCharOffset = endContent !== null
      ? getTextOffset(endContent, range.endContainer, range.endOffset)
      : null;

    setSelectionState({
      startLine: Math.min(startLine, endLine),
      endLine: Math.max(startLine, endLine),
      startCharOffset,
      endCharOffset,
      selectedText,
    });
    setSelectionPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Determine inline form target line
  const formTargetLine = useMemo<number | null>(() => {
    if (commentFormState == null) return null;
    if (commentFormState.type === 'line') return commentFormState.lineNumber;
    if (commentFormState.type === 'range') return commentFormState.endLine;
    if (commentFormState.type === 'section') {
      const sec = sections.find((s) => s.id === commentFormState.sectionId);
      return sec !== undefined ? sec.startLine : null;
    }
    return null;
  }, [commentFormState, sections]);

  // Group section comments by sectionId for O(1) lookup
  const commentsBySection = useMemo<Map<string, Comment[]>>(() => {
    const map = new Map<string, Comment[]>();
    for (const c of sectionComments) {
      if (c.sectionId !== null) {
        const existing = map.get(c.sectionId) ?? [];
        existing.push(c);
        map.set(c.sectionId, existing);
      }
    }
    return map;
  }, [sectionComments]);

  // Group inline (line/range) comments by their end line
  const commentsByEndLine = useMemo<Map<number, Comment[]>>(() => {
    const map = new Map<number, Comment[]>();
    for (const c of (allComments ?? [])) {
      if (c.type === 'line' || c.type === 'range') {
        const bucket = map.get(c.targetEnd) ?? [];
        bucket.push(c);
        map.set(c.targetEnd, bucket);
      }
    }
    return map;
  }, [allComments]);

  // O(1) lookup set for search match lines
  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

  const totalLines = useMemo(
    () => renderedLines.reduce((max, e) => Math.max(max, e.kind === 'code' ? e.startLine + e.lineHtmls.length - 1 : e.lineNumber), 1),
    [renderedLines]
  );

  return (
    <div className="plan-viewer-container">
    <div ref={viewerRef} className="plan-viewer" aria-label={`Plan version ${versionNumber}`} onMouseUp={handleMouseUp}>
      {renderedLines.map((entry) => {
        if (entry.kind === 'code') {
          const { startLine, lineHtmls } = entry;
          const blockEnd = startLine + lineHtmls.length - 1;
          const hasMatch = Array.from({ length: blockEnd - startLine + 1 }, (_, i) => startLine + i).some(l => searchMatchSet.has(l));

          return (
            <div
              key={`cb-${startLine}`}
              className={[
                'code-block-container',
                hasMatch ? 'line-row--search-match' : '',
              ].filter(Boolean).join(' ')}
              data-line={startLine}
            >
              <CodeBlock
                lineHtmls={lineHtmls}
                startLine={startLine}
                commentsByEndLine={commentsByEndLine}
                formTargetLine={formTargetLine}
                onAddLineComment={onAddLineComment}
              />
            </div>
          );
        }

        // TextLine
        const { lineNumber, html } = entry;

        if (!isLineVisible(lineNumber, sections, collapsedSections)) return null;

        const matchedSection = sections.find((s) => s.startLine === lineNumber);
        const comments = matchedSection ? (commentsBySection.get(matchedSection.id) ?? []) : [];
        const inlineComments = commentsByEndLine.get(lineNumber) ?? [];

        return (
          <div
            className={[
              'line-row',
              lineNumber === activeCommentLine ? 'line-row--active-anchor' : '',
              commentRange !== null && commentRange !== undefined && lineNumber >= commentRange.start && lineNumber <= commentRange.end
                ? 'line-row--range-selected' : '',
              selectionState !== null && lineNumber >= Math.min(selectionState.startLine, selectionState.endLine) && lineNumber <= Math.max(selectionState.startLine, selectionState.endLine)
                ? 'line-row--selecting' : '',
              searchMatchSet.has(lineNumber) ? 'line-row--search-match' : '',
              searchCurrentLine === lineNumber ? 'line-row--search-current' : '',
            ].filter(Boolean).join(' ')}
            id={`line-${lineNumber}`}
            data-line={lineNumber}
            key={lineNumber}
            onClick={(e: React.MouseEvent) => {
              if (e.shiftKey && onLineShiftClick !== undefined) {
                onLineShiftClick(lineNumber);
              }
            }}
          >
            <LineGutter lineNumber={lineNumber} onAddComment={onAddLineComment} />
            <div className="line-divider" aria-hidden="true" />
            <div className="line-content">
              {html ? (
                matchedSection !== undefined && onCommentSection !== undefined ? (
                  <div className="line-heading-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: html }} />
                )
              ) : null}
              {comments.map((c) => (
                <SectionCommentBadge key={c.id} comment={c} />
              ))}
              {inlineComments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                />
              ))}
              {formTargetLine === lineNumber && (
                <CommentForm />
              )}
            </div>
          </div>
        );
      })}

      {/* Floating selection comment button */}
      {selectionState !== null && selectionPos !== null && (commentFormState === null || commentFormState === undefined) && (
        <button
          className="selection-comment-btn"
          style={{ position: 'fixed', left: selectionPos.x, top: selectionPos.y - 36 }}
          aria-label="Add comment on selection"
          title="Add comment on selection"
          onClick={() => {
            const s = selectionState;
            setSelectionState(null);
            setSelectionPos(null);
            window.getSelection()?.removeAllRanges();
            if (onSelectionComment !== undefined) {
              onSelectionComment(s.startLine, s.endLine, s.startCharOffset, s.endCharOffset, s.selectedText);
            }
          }}
        >
          <span className="material-symbols-outlined">add_comment</span>
        </button>
      )}
    </div>
    {searchMatches.length > 0 && (
      <div className="search-scrollbar-overlay" aria-hidden="true">
        {searchMatches.map((line) => (
          <div
            key={line}
            className={[
              'search-scrollbar-marker',
              line === searchCurrentLine ? 'search-scrollbar-marker--current' : '',
            ].filter(Boolean).join(' ')}
            style={{ top: `${((line - 1) / totalLines) * 100}%` }}
          />
        ))}
      </div>
    )}
    </div>
  );
};
