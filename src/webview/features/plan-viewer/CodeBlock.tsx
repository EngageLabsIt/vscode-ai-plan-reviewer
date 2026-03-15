import React, { useMemo } from 'react';
import hljs from 'highlight.js';
import type { Comment } from '../../../shared/models';
import { LineGutter } from './LineGutter';
import { CommentCard } from '../comments/CommentCard';
import { CommentForm } from '../comments/CommentForm';

// ---------------------------------------------------------------------------
// splitHighlightedLines
// Splits hljs HTML output into per-line strings, preserving open <span> tags
// across line boundaries so each line renders with correct highlighting.
// ---------------------------------------------------------------------------

const TAG_REGEX = /<(\/?)span([^>]*)>/g;

function splitHighlightedLines(html: string): string[] {
  const rawLines = html.split('\n');
  const result: string[] = [];
  let openTags: string[] = [];

  for (const line of rawLines) {
    // Prepend open tags inherited from previous line
    const lineContent = openTags.join('') + line;

    // Track which tags are open after this line
    const currentTags = [...openTags];
    let match: RegExpExecArray | null;

    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(line)) !== null) {
      if (match[1] === '/') {
        currentTags.pop();
      } else {
        currentTags.push(`<span${match[2]}>`);
      }
    }

    // Close all open tags at end of this line
    result.push(lineContent + '</span>'.repeat(currentTags.length));

    // Carry open tags to the next line
    openTags = currentTags;
  }

  return result;
}

// ---------------------------------------------------------------------------
// CodeBlockProps
// ---------------------------------------------------------------------------

interface CodeBlockProps {
  lines: string[];
  lang: string;
  startLine: number;
  commentsByEndLine: Map<number, Comment[]>;
  formTargetLine: number | null;
  onAddLineComment?: (lineNumber: number) => void;
  onEdit?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
  onResolve?: (id: string) => void;
  onCommentSubmit?: (body: string) => void;
  onCommentCancel?: () => void;
}

// ---------------------------------------------------------------------------
// CodeBlock
// ---------------------------------------------------------------------------

export const CodeBlock: React.FC<CodeBlockProps> = ({
  lines,
  lang,
  startLine,
  commentsByEndLine,
  formTargetLine,
  onAddLineComment,
  onEdit,
  onDelete,
  onResolve,
  onCommentSubmit,
  onCommentCancel,
}) => {
  const lineHtmls = useMemo(() => {
    const code = lines.join('\n');
    let highlighted: string;
    try {
      const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
      highlighted = result.value;
    } catch {
      // Fallback: escape HTML and render plain
      highlighted = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    return splitHighlightedLines(highlighted);
  }, [lines, lang]);

  return (
    <>
      {lineHtmls.map((lineHtml, i) => {
        const lineNumber = startLine + i;
        return (
          <div
            key={lineNumber}
            id={`line-${lineNumber}`}
            data-line={lineNumber}
            className="line-row"
          >
            <LineGutter lineNumber={lineNumber} onAddComment={onAddLineComment} />
            <div className="line-divider" aria-hidden="true" />
            <div className="line-content">
              <div
                className="code-line-content"
                dangerouslySetInnerHTML={{ __html: lineHtml }}
              />
              {(commentsByEndLine.get(lineNumber) ?? []).map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  onEdit={onEdit ?? (() => {})}
                  onDelete={onDelete ?? (() => {})}
                  onResolve={onResolve ?? (() => {})}
                />
              ))}
              {formTargetLine === lineNumber
                && onCommentSubmit !== undefined
                && onCommentCancel !== undefined && (
                  <CommentForm onSubmit={onCommentSubmit} onCancel={onCommentCancel} />
                )}
            </div>
          </div>
        );
      })}
    </>
  );
};
