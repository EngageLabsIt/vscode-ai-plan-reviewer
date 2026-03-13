import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Comment, Section } from '../../shared/models';
import { LineGutter } from './LineGutter';
import '../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanViewerProps {
  content: string;
  sections: Section[];
  versionNumber: number;
  sectionComments?: Comment[];
  onCommentSection?: (sectionId: string) => void;
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
// PlanViewer
// ---------------------------------------------------------------------------

export const PlanViewer: React.FC<PlanViewerProps> = ({
  content,
  sections,
  versionNumber,
  sectionComments = [],
  onCommentSection,
}) => {
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
                  <LineGutter key={idx} lineNumber={startLine + idx} />
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
        const matchedSection = sections.find((s) => s.startLine === lineNumber);
        const comments = matchedSection ? (commentsBySection.get(matchedSection.id) ?? []) : [];

        return (
          <div className="line-row" key={lineNumber}>
            <LineGutter lineNumber={lineNumber} />
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
            </div>
          </div>
        );
      })}
    </div>
  );
};
