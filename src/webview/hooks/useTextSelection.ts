import { useEffect, useState, type RefObject } from 'react';

export interface TextSelectionState {
  text: string;
  targetStart: number;
  targetEnd: number;
  rect: DOMRect;
}

export function useTextSelection(bodyRef: RefObject<HTMLDivElement | null>): {
  selection: TextSelectionState | null;
  clearSelection: () => void;
} {
  const [selection, setSelection] = useState<TextSelectionState | null>(null);

  useEffect(() => {
    const handler = (): void => {
      const sel = window.getSelection();
      if (sel === null || sel.isCollapsed || bodyRef.current === null) {
        setSelection(null);
        return;
      }

      const selectedText = sel.toString().trim();
      if (selectedText.length === 0) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // Find the annotatable-block containing the selection start/end.
      // Use parentNode (never null) instead of parentElement (can be null for
      // direct children of <li> in VS Code's Chromium webview).
      const startNode = (
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentNode
          : range.startContainer
      ) as Element | null;
      const endNode = (
        range.endContainer.nodeType === Node.TEXT_NODE
          ? range.endContainer.parentNode
          : range.endContainer
      ) as Element | null;

      if (
        startNode === null ||
        endNode === null ||
        bodyRef.current === null ||
        !bodyRef.current.contains(startNode) ||
        !bodyRef.current.contains(endNode)
      ) {
        setSelection(null);
        return;
      }

      const startBlock = startNode.closest<HTMLElement>('.annotatable-block');
      const endBlock = endNode.closest<HTMLElement>('.annotatable-block');

      if (startBlock === null || endBlock === null) {
        setSelection(null);
        return;
      }

      const targetStart = parseInt(
        startBlock.getAttribute('data-line') ?? '',
        10,
      );
      const targetEndAttr = endBlock.getAttribute('data-line') ?? '';
      const targetEnd = parseInt(targetEndAttr, 10);

      if (isNaN(targetStart) || isNaN(targetEnd)) {
        setSelection(null);
        return;
      }

      // Get the rect of the collapsed end of the range (position of the last selected character)
      const endRange = range.cloneRange();
      endRange.collapse(false);
      const endRect = endRange.getBoundingClientRect();

      setSelection({
        text: selectedText,
        targetStart,
        targetEnd: Math.max(targetStart, targetEnd),
        rect: endRect,
      });
    };

    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [bodyRef]);

  const clearSelection = (): void => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  return { selection, clearSelection };
}
