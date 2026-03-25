import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  currentIndex: number;
  totalMatches: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  currentIndex,
  totalMatches,
  onNext,
  onPrev,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  return (
    <div className='search-bar'>
      <span className='material-symbols-outlined search-bar__icon'>search</span>
      <input
        ref={inputRef}
        className='search-bar__input'
        type='text'
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder='Search...'
      />
      <span className='search-bar__count'>
        {totalMatches > 0 ? `${currentIndex} / ${totalMatches}` : '0 / 0'}
      </span>
      <button
        className='search-bar__btn'
        onClick={onPrev}
        aria-label='Previous match'
        title='Previous match (Shift+Enter)'
      >
        <span className='material-symbols-outlined'>arrow_upward</span>
      </button>
      <button
        className='search-bar__btn'
        onClick={onNext}
        aria-label='Next match'
        title='Next match (Enter)'
      >
        <span className='material-symbols-outlined'>arrow_downward</span>
      </button>
      <button
        className='search-bar__btn'
        onClick={onClose}
        aria-label='Close search'
        title='Close search (Escape)'
      >
        <span className='material-symbols-outlined'>close</span>
      </button>
    </div>
  );
};
