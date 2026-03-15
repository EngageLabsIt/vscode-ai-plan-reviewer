import React, { useCallback, useState } from 'react';

interface LineGutterProps {
  lineNumber: number;
  onAddComment?: (lineNumber: number) => void;
}

const LineGutterComponent: React.FC<LineGutterProps> = ({ lineNumber, onAddComment }) => {
  const [hovered, setHovered] = useState(false);

  const handleAddComment = (): void => {
    onAddComment?.(lineNumber);
  };

  return (
    <div
      className="line-gutter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered ? (
        <span
          className="line-gutter-add"
          role="button"
          aria-label={`Add comment on line ${lineNumber}`}
          tabIndex={0}
          onClick={handleAddComment}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleAddComment();
            }
          }}
        >
          &#x2295;
        </span>
      ) : (
        <span className="line-gutter-number">{lineNumber}</span>
      )}
    </div>
  );
};

export const LineGutter = React.memo(LineGutterComponent);
