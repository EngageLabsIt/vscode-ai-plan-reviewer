import { useEffect, useState, type RefObject } from 'react';

/**
 * Builds a Map from source line number → DOM element for all .annotatable-block elements
 * inside the given container ref. Rebuilds whenever the container's innerHTML changes
 * (i.e., when new HTML is rendered).
 */
export function useBlockMapping(bodyRef: RefObject<HTMLDivElement | null>): Map<number, HTMLElement> {
  const [blockMap, setBlockMap] = useState<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyRef.current?.innerHTML]);

  return blockMap;
}
