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

      // Find the annotatable-block containing the selection start
      const startNode = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer as Element;
      const endNode = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : range.endContainer as Element;

      const startBlock = startNode?.closest<HTMLElement>('.annotatable-block');
      const endBlock = endNode?.closest<HTMLElement>('.annotatable-block');

      if (startBlock === null || startBlock === undefined || endBlock === null || endBlock === undefined) {
        setSelection(null);
        return;
      }

      const targetStart = parseInt(startBlock.getAttribute('data-line') ?? '', 10);
      const targetEndAttr = endBlock.getAttribute('data-line-end') ?? endBlock.getAttribute('data-line') ?? '';
      const targetEnd = parseInt(targetEndAttr, 10);

      if (isNaN(targetStart) || isNaN(targetEnd)) {
        setSelection(null);
        return;
      }

      setSelection({
        text: selectedText,
        targetStart,
        targetEnd: Math.max(targetStart, targetEnd),
        rect: range.getBoundingClientRect(),
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
