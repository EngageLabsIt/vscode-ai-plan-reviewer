import React from 'react';
import type { Comment } from '../../../shared/models';
import { LineGutter } from './LineGutter';
import { CommentCard } from '../comments/CommentCard';
import { CommentForm } from '../comments/CommentForm';

// ---------------------------------------------------------------------------
// CodeBlockProps
// ---------------------------------------------------------------------------

interface CodeBlockProps {
  lineHtmls: string[];
  startLine: number;
  commentsByEndLine: Map<number, Comment[]>;
  formTargetLine: number | null;
  onAddLineComment?: (lineNumber: number) => void;
}

// ---------------------------------------------------------------------------
// CodeBlock
// ---------------------------------------------------------------------------

export const CodeBlock: React.FC<CodeBlockProps> = ({
  lineHtmls,
  startLine,
  commentsByEndLine,
  formTargetLine,
  onAddLineComment,
}) => {

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
                />
              ))}
              {formTargetLine === lineNumber && (
                <CommentForm />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
