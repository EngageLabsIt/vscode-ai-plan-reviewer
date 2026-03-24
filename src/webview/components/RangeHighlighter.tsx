import React, { useEffect, type RefObject } from 'react';
import type { Comment } from '../../shared/models';
import { useTextSelection } from '../hooks/useTextSelection';

interface RangeHighlighterProps {
  bodyRef: RefObject<HTMLDivElement | null>;
  comments: Comment[];
  onAddRangeComment: (targetStart: number, targetEnd: number, selectedText: string) => void;
}

export const RangeHighlighter: React.FC<RangeHighlighterProps> = ({
  bodyRef,
  comments,
  onAddRangeComment,
}) => {
  const { selection, clearSelection } = useTextSelection(bodyRef);

  // Apply <mark> highlights for saved range comments
  useEffect(() => {
    const container = bodyRef.current;
    if (container === null) return;

    // Remove existing marks
    const existingMarks = container.querySelectorAll('mark.range-hl');
    existingMarks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent === null) return;
      while (mark.firstChild !== null) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    });

    // Apply new marks for unresolved range/line comments with selectedText
    const rangeComments = comments.filter(
      (c) => !c.resolved && c.selectedText !== null && c.selectedText.length > 0
    );

    for (const comment of rangeComments) {
      if (comment.selectedText === null) continue;
      // Find text node containing the selected text within the target block
      const startEl = container.querySelector<HTMLElement>(
        `[data-line="${comment.targetStart}"]`
      );
      if (startEl === null) continue;

      // Walk text nodes to find and wrap the selected text
      const walker = document.createTreeWalker(startEl, NodeFilter.SHOW_TEXT);
      const searchText = comment.selectedText;
      let node: Node | null;
      let found = false;

      while ((node = walker.nextNode()) !== null && !found) {
        const text = node.textContent ?? '';
        const idx = text.indexOf(searchText);
        if (idx === -1) continue;

        // Split text node and wrap match in <mark>
        const textNode = node as Text;
        const after = textNode.splitText(idx + searchText.length);
        const match = textNode.splitText(idx);
        // match is now the text node with exactly searchText
        const mark = document.createElement('mark');
        mark.className = 'range-hl';
        match.parentNode?.insertBefore(mark, after);
        mark.appendChild(match);
        found = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, bodyRef.current?.innerHTML]);

  if (selection === null) return null;

  return (
    <div
      className="range-toolbar"
      style={{
        position: 'fixed',
        left: selection.rect.left,
        top: selection.rect.top - 44,
        zIndex: 1000,
      }}
    >
      <button
        className="range-toolbar__btn"
        title="Aggiungi commento al testo selezionato"
        onMouseDown={(e) => {
          // Use mousedown to fire before selection is cleared
          e.preventDefault();
          const { targetStart, targetEnd, text } = selection;
          clearSelection();
          onAddRangeComment(targetStart, targetEnd, text);
        }}
      >
        +
      </button>
    </div>
  );
};
