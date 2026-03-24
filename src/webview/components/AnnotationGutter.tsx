import React, { useEffect, useRef, useState, type RefObject } from 'react';
import type { Comment } from '../../shared/models';

interface GutterItem {
  line: number;
  top: number;
}

interface AnnotationGutterProps {
  bodyRef: RefObject<HTMLDivElement | null>;
  blockMap: Map<number, HTMLElement>;
  comments: Comment[];
  onAddComment: (lineNumber: number) => void;
  activeCommentLine: number | null;
}

export const AnnotationGutter: React.FC<AnnotationGutterProps> = ({
  bodyRef,
  blockMap,
  comments,
  onAddComment,
  activeCommentLine,
}) => {
  const [items, setItems] = useState<GutterItem[]>([]);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Set of lines that have unresolved comments
  const commentedLines = new Set(
    comments.filter(c => !c.resolved).map(c => c.targetStart)
  );

  // Rebuild gutter items when blockMap changes, using ResizeObserver for position updates
  useEffect(() => {
    if (bodyRef.current === null) return;

    const recalculate = (): void => {
      const container = bodyRef.current;
      if (container === null) return;
      const containerTop = container.getBoundingClientRect().top + window.scrollY;

      const newItems: GutterItem[] = [];
      blockMap.forEach((el, line) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY - containerTop;
        newItems.push({ line, top });
      });
      setItems(newItems);
    };

    recalculate();

    const observer = new ResizeObserver(recalculate);
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockMap, bodyRef]);

  return (
    <div ref={gutterRef} className="annotation-gutter" aria-hidden="true">
      {items.map(({ line, top }) => {
        const hasComments = commentedLines.has(line);
        return (
        <div
          key={line}
          className={[
            'gutter-item',
            activeCommentLine === line ? 'gutter-item--active' : '',
          ].filter(Boolean).join(' ')}
          style={{ position: 'absolute', top }}
        >
          {hasComments ? (
            <span className="gutter-dot" title={`Line ${line} has comments`} />
          ) : null}
          <button
            className="gutter-button"
            onClick={() => onAddComment(line)}
            title={`Add comment on line ${line}`}
            aria-label={`Add comment on line ${line}`}
          >
            +
          </button>
        </div>
        );
      })}
    </div>
  );
};
