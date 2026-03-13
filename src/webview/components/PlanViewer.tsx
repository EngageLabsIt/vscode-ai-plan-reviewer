import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Comment, Section } from '../../shared/models';
import { LineGutter } from './LineGutter';
import { CommentCard } from './CommentCard';
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
  onEdit?: (id: string, body: string, category: Comment['category']) => void;
  onDelete?: (id: string) => void;
  onResolve?: (id: string) => void;
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
// Category icon helper
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<Comment['category'], string> = {
  issue:      '🔴',
  suggestion: '💡',
  question:   '❓',
  approval:   '✅',
};

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
      <span className="section-comment-badge__category" aria-hidden="true">
        {CATEGORY_ICONS[comment.category]}
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
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

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

  return (
    <div className="plan-viewer" aria-label={`Plan version ${versionNumber}`}>
      {entries.map((entry) => {
        if (entry.kind === 'code') {
          const { startLine, lang, lines } = entry;
          const fenced = `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``;
          return (
            <div className="line-row code-block-row" key={`cb-${startLine}`}>
              <div className="code-block-gutter">
                {lines.map((_, idx) => (
                  <LineGutter key={idx} lineNumber={startLine + idx} onAddComment={onAddLineComment} />
                ))}
              </div>
              <div className="line-content">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {fenced}
                </ReactMarkdown>
              </div>
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
            ].filter(Boolean).join(' ')}
            id={`line-${lineNumber}`}
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
                    <button
                      className="section-collapse-toggle"
                      aria-label={collapsedSections.has(lineNumber) ? 'Expand section' : 'Collapse section'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapsedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(lineNumber)) {
                            next.delete(lineNumber);
                          } else {
                            next.add(lineNumber);
                          }
                          return next;
                        });
                      }}
                    >
                      {collapsedSections.has(lineNumber) ? '▶' : '▼'}
                    </button>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={textLineComponents}
                    >
                      {text}
                    </ReactMarkdown>
                    <button
                      className="section-comment-trigger"
                      aria-label="Comment on section"
                      title="Comment on section"
                      onClick={() => { onCommentSection(matchedSection.id); }}
                    >
                      💬
                    </button>
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
            </div>
          </div>
        );
      })}
    </div>
  );
};
