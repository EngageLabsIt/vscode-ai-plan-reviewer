import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Builds a Map from source line number → DOM element for all .annotatable-block elements
 * inside the given container ref. Rebuilds whenever html changes (i.e., when new HTML is rendered).
 * Uses useLayoutEffect to run after the DOM is committed but before paint.
 */
export function useBlockMapping(bodyRef: RefObject<HTMLDivElement | null>, html: string): Map<number, HTMLElement> {
  const [blockMap, setBlockMap] = useState<Map<number, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    if (bodyRef.current === null) return;
    const map = new Map<number, HTMLElement>();
    const blocks = bodyRef.current.querySelectorAll<HTMLElement>('.annotatable-block[data-line]');
    blocks.forEach((el) => {
      const line = parseInt(el.getAttribute('data-line')!, 10);
      if (!isNaN(line)) {
        map.set(line, el);
      }
    });
    setBlockMap(map);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  return blockMap;
}
