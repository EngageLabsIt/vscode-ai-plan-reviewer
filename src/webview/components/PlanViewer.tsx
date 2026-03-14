import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Comment, Section } from '../../shared/models';
import { LineGutter } from './LineGutter';
import { CommentCard } from './CommentCard';
import { CommentForm } from './CommentForm';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanViewerProps {
  content: string;
  sections: Section[];
  versionNumber: number;
  sectionComments?: Comment[];
  allComments?: Comment[];
  onCommentSection?: (sectionId: string) => void;
  onAddLineComment?: (lineNumber: number) => void;
  onLineShiftClick?: (lineNumber: number) => void;
  activeCommentLine?: number | null;
  commentRange?: { start: number; end: number } | null;
  onEdit?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
  onResolve?: (id: string) => void;
  searchMatches?: number[];
  searchCurrentLine?: number | null;
  commentFormState?: { type: 'line'; lineNumber: number } | { type: 'range'; startLine: number; endLine: number } | { type: 'section'; sectionId: string } | null;
  onCommentSubmit?: (body: string) => void;
  onCommentCancel?: () => void;
  onSelectionComment?: (startLine: number, endLine: number, startChar: number | null, endChar: number | null, selectedText: string) => void;
}

type TextLine = { kind: 'text'; lineNumber: number; text: string };
type CodeBlock = { kind: 'code'; startLine: number; lang: string; lines: string[] };
type LineEntry = TextLine | CodeBlock;

// ---------------------------------------------------------------------------
// parseLines — segment raw markdown content into per-line entries
// ---------------------------------------------------------------------------

function parseLines(content: string): LineEntry[] {
  const rawLines = content.split('\n');
  const entries: LineEntry[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*(\w*)/);

    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2] ?? '';
      const startLine = i + 1; // 1-based line number of the opening fence
      const codeLines: string[] = [];
      i++; // skip opening fence line

      while (i < rawLines.length) {
        const codeLine = rawLines[i];
        // closing fence: same or longer sequence of same char
        if (codeLine.match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`))) {
          i++; // skip closing fence line
          break;
        }
        codeLines.push(codeLine);
        i++;
      }

      entries.push({ kind: 'code', startLine, lang, lines: codeLines });
    } else {
      entries.push({ kind: 'text', lineNumber: i + 1, text: line });
      i++;
    }
  }

  return entries;
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
// textLineComponents — strip the <p> wrapper ReactMarkdown adds
// ---------------------------------------------------------------------------

const textLineComponents: Components = {
  p: ({ children }) => <>{children}</>,
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
  sections,
  versionNumber,
  sectionComments = [],
  allComments,
  onCommentSection,
  onAddLineComment,
  onLineShiftClick,
  activeCommentLine,
  commentRange,
  onEdit,
  onDelete,
  onResolve,
  searchMatches = [],
  searchCurrentLine = null,
  commentFormState,
  onCommentSubmit,
  onCommentCancel,
  onSelectionComment,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [selectionState, setSelectionState] = useState<{ startLine: number; endLine: number; startCharOffset: number | null; endCharOffset: number | null; selectedText: string; x: number; y: number } | null>(null);
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
      return;
    }
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) {
      setSelectionState(null);
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
      return;
    }

    const startLine = parseInt(startRow.getAttribute('data-line') ?? '', 10);
    const endLine = parseInt(endRow.getAttribute('data-line') ?? '', 10);

    if (isNaN(startLine) || isNaN(endLine)) {
      setSelectionState(null);
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
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // Determine inline form target line
  const formTargetLine: number | null = (() => {
    if (commentFormState === null || commentFormState === undefined) return null;
    if (commentFormState.type === 'line') return commentFormState.lineNumber;
    if (commentFormState.type === 'range') return commentFormState.endLine;
    if (commentFormState.type === 'section') {
      const sec = sections.find((s) => s.id === commentFormState.sectionId);
      return sec !== undefined ? sec.startLine : null;
    }
    return null;
  })();

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

  // Parse content into per-line entries
  const entries = useMemo(() => parseLines(content), [content]);
  const totalLines = useMemo(() => Math.max(1, content.split('\n').length), [content]);

  return (
    <div className="plan-viewer-container">
    <div ref={viewerRef} className="plan-viewer" aria-label={`Plan version ${versionNumber}`} onMouseUp={handleMouseUp}>
      {entries.map((entry) => {
        if (entry.kind === 'code') {
          const { startLine, lang, lines } = entry;
          const blockEnd = startLine + lines.length + 1;
          const lastContentLine = startLine + lines.length - 1;
          const hasMatch = searchMatches.some(l => l >= startLine && l <= blockEnd);
          const isCurrent = searchCurrentLine !== null
            && searchCurrentLine >= startLine
            && searchCurrentLine <= blockEnd;

          // Break-point = lines in block with comments or formTargetLine
          const breakLineSet = new Set<number>();
          for (let ln = startLine; ln <= lastContentLine; ln++) {
            if (commentsByEndLine.has(ln)) breakLineSet.add(ln);
          }
          if (formTargetLine !== null && formTargetLine >= startLine && formTargetLine <= lastContentLine) {
            breakLineSet.add(formTargetLine);
          }
          const sortedBreaks = [...breakLineSet].sort((a, b) => a - b);

          // Build segments
          interface Segment { firstLine: number; codeLines: string[]; endLine: number; }
          const segments: Segment[] = [];
          let segFirstLine = startLine;
          for (const bp of sortedBreaks) {
            segments.push({
              firstLine: segFirstLine,
              codeLines: lines.slice(segFirstLine - startLine, bp - startLine + 1),
              endLine: bp,
            });
            segFirstLine = bp + 1;
          }
          if (segFirstLine <= lastContentLine) {
            segments.push({
              firstLine: segFirstLine,
              codeLines: lines.slice(segFirstLine - startLine),
              endLine: lastContentLine,
            });
          } else if (segments.length === 0) {
            segments.push({ firstLine: startLine, codeLines: [], endLine: lastContentLine });
          }

          return (
            <div
              key={`cb-${startLine}`}
              data-line={startLine}
              id={isCurrent ? `line-${searchCurrentLine}` : undefined}
              className={[
                'code-block-container',
                hasMatch ? 'line-row--search-match' : '',
                isCurrent ? 'line-row--search-current' : '',
              ].filter(Boolean).join(' ')}
            >
              {segments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  <div className="line-row code-block-row">
                    <div className="code-block-gutter">
                      {seg.codeLines.map((_, i) => (
                        <LineGutter key={i} lineNumber={seg.firstLine + i} onAddComment={onAddLineComment} />
                      ))}
                    </div>
                    <div className="line-content">
                      {seg.codeLines.length > 0 && (
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                          {`\`\`\`${lang}\n${seg.codeLines.join('\n')}\n\`\`\``}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                  {(commentsByEndLine.get(seg.endLine) ?? []).map((c) => (
                    <div key={c.id} className="line-row">
                      <div className="line-gutter" aria-hidden="true" />
                      <div className="line-divider" aria-hidden="true" />
                      <div className="line-content">
                        <CommentCard
                          comment={c}
                          onEdit={onEdit ?? (() => {})}
                          onDelete={onDelete ?? (() => {})}
                          onResolve={onResolve ?? (() => {})}
                        />
                      </div>
                    </div>
                  ))}
                  {formTargetLine === seg.endLine
                    && onCommentSubmit !== undefined
                    && onCommentCancel !== undefined && (
                      <div className="line-row">
                        <div className="line-gutter" aria-hidden="true" />
                        <div className="line-divider" aria-hidden="true" />
                        <div className="line-content">
                          <CommentForm onSubmit={onCommentSubmit} onCancel={onCommentCancel} />
                        </div>
                      </div>
                    )}
                </React.Fragment>
              ))}
            </div>
          );
        }

        // TextLine
        const { lineNumber, text } = entry;

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
              searchMatches.includes(lineNumber) ? 'line-row--search-match' : '',
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
              {text.trim() ? (
                matchedSection !== undefined && onCommentSection !== undefined ? (
                  <div className="line-heading-wrapper">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={textLineComponents}
                    >
                      {text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={textLineComponents}
                  >
                    {text}
                  </ReactMarkdown>
                )
              ) : null}
              {comments.map((c) => (
                <SectionCommentBadge key={c.id} comment={c} />
              ))}
              {inlineComments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  onEdit={onEdit ?? (() => {})}
                  onDelete={onDelete ?? (() => {})}
                  onResolve={onResolve ?? (() => {})}
                />
              ))}
              {formTargetLine === lineNumber && onCommentSubmit !== undefined && onCommentCancel !== undefined && (
                <CommentForm
                  onSubmit={onCommentSubmit}
                  onCancel={onCommentCancel}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Floating selection comment button */}
      {selectionState !== null && (commentFormState === null || commentFormState === undefined) && (
        <button
          className="selection-comment-btn"
          style={{ position: 'fixed', left: selectionState.x, top: selectionState.y - 36 }}
          aria-label="Add comment on selection"
          title="Add comment on selection"
          onClick={() => {
            const s = selectionState;
            setSelectionState(null);
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
