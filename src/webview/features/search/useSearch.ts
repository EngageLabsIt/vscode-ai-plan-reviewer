import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSearchReturn {
  searchOpen: boolean;
  searchQuery: string;
  searchMatches: number[];
  searchIndex: number;
  handleToggleSearch: () => void;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  handleSearchNext: () => void;
  handleSearchPrev: () => void;
  handleSearchClose: () => void;
  searchCurrentLine: number | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch(content: string | undefined): UseSearchReturn {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);

  useEffect(() => {
    if (searchQuery.length === 0 || content === undefined) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const lines = content.split('\n');
    const matches: number[] = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) {
        matches.push(i + 1);
      }
    });
    setSearchMatches(matches);
    setSearchIndex(matches.length > 0 ? 1 : 0);
  }, [searchQuery, content]);

  const handleToggleSearch = useCallback((): void => {
    setSearchOpen((open) => {
      if (open) {
        setSearchQuery('');
        setSearchMatches([]);
        setSearchIndex(0);
      }
      return !open;
    });
  }, []);

  const handleSearchNext = useCallback((): void => {
    if (searchMatches.length === 0) return;
    setSearchIndex((prev) => (prev >= searchMatches.length ? 1 : prev + 1));
  }, [searchMatches.length]);

  const handleSearchPrev = useCallback((): void => {
    if (searchMatches.length === 0) return;
    setSearchIndex((prev) => (prev <= 1 ? searchMatches.length : prev - 1));
  }, [searchMatches.length]);

  const handleSearchClose = useCallback((): void => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setSearchIndex(0);
  }, []);

  const searchCurrentLine =
    searchMatches.length > 0 && searchIndex > 0 ? searchMatches[searchIndex - 1] : null;

  return {
    searchOpen,
    searchQuery,
    searchMatches,
    searchIndex,
    handleToggleSearch,
    setSearchQuery,
    handleSearchNext,
    handleSearchPrev,
    handleSearchClose,
    searchCurrentLine,
  };
}
