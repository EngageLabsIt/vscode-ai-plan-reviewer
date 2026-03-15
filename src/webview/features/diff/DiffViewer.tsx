import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { DiffLine, MappedComment } from '../../../shared/models';
import '../../styles/planViewer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffViewerProps {
  diffLines: DiffLine[];
  mappedComments: MappedComment[];
  oldVersionNumber: number;
  newVersionNumber: number;
  viewMode: 'inline' | 'side-by-side';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineRowClass(type: DiffLine['type']): string {
  switch (type) {
    case 'added':     return 'diff-line diff-line--added';
    case 'removed':   return 'diff-line diff-line--removed';
    // 'modified' is handled by rendering two separate rows; this fallback
    // is only used if lineRowClass is called directly for a modified line.
    case 'modified':  return 'diff-line diff-line--removed';
    default:          return 'diff-line diff-line--unchanged';
  }
}

function gutterLabel(lineNumberOld: number | null, lineNumberNew: number | null): string {
  const old = lineNumberOld !== null ? String(lineNumberOld) : '-';
  const next = lineNumberNew !== null ? String(lineNumberNew) : '-';
  return `${old} \u2192 ${next}`;
}

function statusIcon(status: MappedComment['status']): string {
  switch (status) {
    case 'probably_resolved':   return '\u2705';
    case 'probably_unresolved': return '\u26a0\ufe0f';
    case 'orphaned':            return '\ud83d\udeab';
  }
}

// ---------------------------------------------------------------------------
// InlineDiffRow
// ---------------------------------------------------------------------------

interface InlineDiffRowProps {
  diffLine: DiffLine;
  indicators: MappedComment[];
}

const InlineDiffRow: React.FC<InlineDiffRowProps> = ({ diffLine, indicators }) => (
  <div className={lineRowClass(diffLine.type)} role="row">
    <span className="diff-line__gutter" aria-label={`Lines ${gutterLabel(diffLine.lineNumberOld, diffLine.lineNumberNew)}`}>
      {gutterLabel(diffLine.lineNumberOld, diffLine.lineNumberNew)}
    </span>
    <span className="diff-line__content">
      {diffLine.content}
      {indicators.length > 0 && (
        <span className="diff-line__indicators" aria-label="Comment indicators">
          {indicators.map((mc) => (
            <span
              key={mc.comment.id}
              className="diff-line__indicator"
              title={mc.comment.body}
              aria-label={`Comment: ${mc.comment.body} (${mc.status})`}
            >
              {statusIcon(mc.status)}
            </span>
          ))}
        </span>
      )}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// InlineDiff
// ---------------------------------------------------------------------------

interface InlineDiffProps {
  diffLines: DiffLine[];
  commentsByNewLine: Map<number, MappedComment[]>;
  commentsByOldLine: Map<number, MappedComment[]>;
}

const InlineDiff: React.FC<InlineDiffProps> = ({ diffLines, commentsByNewLine, commentsByOldLine }) => (
  <div className="diff-viewer__inline" role="table" aria-label="Inline diff">
    {diffLines.map((dl, idx) => {
      // 'modified' lines render as two rows: removed (old content) + added (new content)
      if (dl.type === 'modified') {
        const oldIndicators: MappedComment[] =
          dl.lineNumberOld !== null ? (commentsByOldLine.get(dl.lineNumberOld) ?? []) : [];
        const newIndicators: MappedComment[] =
          dl.lineNumberNew !== null ? (commentsByNewLine.get(dl.lineNumberNew) ?? []) : [];
        return (
          <React.Fragment key={idx}>
            <InlineDiffRow
              diffLine={{ ...dl, type: 'removed', content: dl.oldContent ?? dl.content }}
              indicators={oldIndicators}
            />
            <InlineDiffRow
              diffLine={{ ...dl, type: 'added', content: dl.content }}
              indicators={newIndicators}
            />
          </React.Fragment>
        );
      }

      // For removed lines, use old line number to look up indicators.
      // For added/unchanged, use new line number.
      let indicators: MappedComment[] = [];
      if (dl.type === 'removed' && dl.lineNumberOld !== null) {
        indicators = commentsByOldLine.get(dl.lineNumberOld) ?? [];
      } else if (dl.lineNumberNew !== null) {
        indicators = commentsByNewLine.get(dl.lineNumberNew) ?? [];
      }
      return (
        <InlineDiffRow
          key={idx}
          diffLine={dl}
          indicators={indicators}
        />
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// SideBySideDiff
// ---------------------------------------------------------------------------

interface SideBySideDiffProps {
  diffLines: DiffLine[];
  commentsByNewLine: Map<number, MappedComment[]>;
  commentsByOldLine: Map<number, MappedComment[]>;
}

const SideBySideDiff: React.FC<SideBySideDiffProps> = ({ diffLines, commentsByNewLine, commentsByOldLine }) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const handleLeftScroll = useCallback((): void => {
    if (rightRef.current !== null && leftRef.current !== null) {
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
  }, []);

  const handleRightScroll = useCallback((): void => {
    if (leftRef.current !== null && rightRef.current !== null) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="diff-viewer--side-by-side">
      {/* Left column: old content (removed + unchanged) */}
      <div
        ref={leftRef}
        className="diff-column diff-column--old"
        role="table"
        aria-label="Old version"
        onScroll={handleLeftScroll}
      >
        {diffLines.map((dl, idx) => {
          if (dl.type === 'added') {
            // Added lines have no old-side content — render an empty spacer row
            return (
              <div key={idx} className="diff-line diff-line--empty" role="row" aria-hidden="true">
                <span className="diff-line__gutter">{'\u00a0'}</span>
                <span className="diff-line__content">{'\u00a0'}</span>
              </div>
            );
          }

          // 'modified' lines show the old content on the left side
          if (dl.type === 'modified') {
            const indicators: MappedComment[] =
              dl.lineNumberOld !== null ? (commentsByOldLine.get(dl.lineNumberOld) ?? []) : [];
            return (
              <div key={idx} className="diff-line diff-line--removed" role="row">
                <span className="diff-line__gutter">
                  {dl.lineNumberOld !== null ? dl.lineNumberOld : '-'}
                </span>
                <span className="diff-line__content">
                  {dl.oldContent ?? dl.content}
                  {indicators.length > 0 && (
                    <span className="diff-line__indicators">
                      {indicators.map((mc) => (
                        <span
                          key={mc.comment.id}
                          className="diff-line__indicator"
                          title={mc.comment.body}
                        >
                          {statusIcon(mc.status)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </div>
            );
          }

          const indicators: MappedComment[] =
            dl.lineNumberOld !== null
              ? (commentsByOldLine.get(dl.lineNumberOld) ?? [])
              : [];

          const rowClass = dl.type === 'removed'
            ? 'diff-line diff-line--removed'
            : 'diff-line diff-line--unchanged';

          return (
            <div key={idx} className={rowClass} role="row">
              <span className="diff-line__gutter">
                {dl.lineNumberOld !== null ? dl.lineNumberOld : '-'}
              </span>
              <span className="diff-line__content">
                {dl.content}
                {indicators.length > 0 && (
                  <span className="diff-line__indicators">
                    {indicators.map((mc) => (
                      <span
                        key={mc.comment.id}
                        className="diff-line__indicator"
                        title={mc.comment.body}
                      >
                        {statusIcon(mc.status)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right column: new content (added + unchanged) */}
      <div
        ref={rightRef}
        className="diff-column diff-column--new"
        role="table"
        aria-label="New version"
        onScroll={handleRightScroll}
      >
        {diffLines.map((dl, idx) => {
          if (dl.type === 'removed') {
            // Removed lines have no new-side content — render an empty spacer row
            return (
              <div key={idx} className="diff-line diff-line--empty" role="row" aria-hidden="true">
                <span className="diff-line__gutter">{'\u00a0'}</span>
                <span className="diff-line__content">{'\u00a0'}</span>
              </div>
            );
          }

          // 'modified' lines show the new content on the right side
          if (dl.type === 'modified') {
            const indicators: MappedComment[] =
              dl.lineNumberNew !== null ? (commentsByNewLine.get(dl.lineNumberNew) ?? []) : [];
            return (
              <div key={idx} className="diff-line diff-line--added" role="row">
                <span className="diff-line__gutter">
                  {dl.lineNumberNew !== null ? dl.lineNumberNew : '-'}
                </span>
                <span className="diff-line__content">
                  {dl.content}
                  {indicators.length > 0 && (
                    <span className="diff-line__indicators">
                      {indicators.map((mc) => (
                        <span
                          key={mc.comment.id}
                          className="diff-line__indicator"
                          title={mc.comment.body}
                        >
                          {statusIcon(mc.status)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </div>
            );
          }

          const indicators: MappedComment[] =
            dl.lineNumberNew !== null
              ? (commentsByNewLine.get(dl.lineNumberNew) ?? [])
              : [];

          const rowClass = dl.type === 'added'
            ? 'diff-line diff-line--added'
            : 'diff-line diff-line--unchanged';

          return (
            <div key={idx} className={rowClass} role="row">
              <span className="diff-line__gutter">
                {dl.lineNumberNew !== null ? dl.lineNumberNew : '-'}
              </span>
              <span className="diff-line__content">
                {dl.content}
                {indicators.length > 0 && (
                  <span className="diff-line__indicators">
                    {indicators.map((mc) => (
                      <span
                        key={mc.comment.id}
                        className="diff-line__indicator"
                        title={mc.comment.body}
                      >
                        {statusIcon(mc.status)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrphanedPanel
// ---------------------------------------------------------------------------

interface OrphanedPanelProps {
  orphaned: MappedComment[];
}

const OrphanedPanel: React.FC<OrphanedPanelProps> = ({ orphaned }) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = useCallback((): void => {
    setCollapsed((c) => !c);
  }, []);

  if (orphaned.length === 0) {
    return null;
  }

  return (
    <div className="diff-orphaned-panel">
      <button
        className="diff-orphaned-panel__toggle"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        aria-controls="diff-orphaned-list"
      >
        {'\ud83d\udeab'} Orphaned Comments ({orphaned.length})
        <span className="diff-orphaned-panel__chevron" aria-hidden="true">
          {collapsed ? '\u25b6' : '\u25bc'}
        </span>
      </button>
      {!collapsed && (
        <ul id="diff-orphaned-list" className="diff-orphaned-panel__list">
          {orphaned.map((mc) => (
            <li key={mc.comment.id} className="diff-orphaned-panel__item">
              <span className="diff-orphaned-panel__category">[{mc.comment.category}]</span>
              {' '}
              {mc.comment.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// DiffViewer
// ---------------------------------------------------------------------------

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffLines,
  mappedComments,
  oldVersionNumber,
  newVersionNumber,
  viewMode,
}) => {
  // Group non-orphaned mapped comments by their new target start line
  const commentsByNewLine = useMemo<Map<number, MappedComment[]>>(() => {
    const map = new Map<number, MappedComment[]>();
    for (const mc of mappedComments) {
      if (mc.status !== 'orphaned' && mc.newTargetStart !== null) {
        const existing = map.get(mc.newTargetStart) ?? [];
        existing.push(mc);
        map.set(mc.newTargetStart, existing);
      }
    }
    return map;
  }, [mappedComments]);

  // Group removed/old-anchored comments by their old target start line
  // (so they can be shown on removed lines in the diff)
  const commentsByOldLine = useMemo<Map<number, MappedComment[]>>(() => {
    const map = new Map<number, MappedComment[]>();
    for (const mc of mappedComments) {
      if (mc.status !== 'orphaned') {
        const oldStart = mc.comment.targetStart;
        const existing = map.get(oldStart) ?? [];
        existing.push(mc);
        map.set(oldStart, existing);
      }
    }
    return map;
  }, [mappedComments]);

  const orphaned = useMemo<MappedComment[]>(
    () => mappedComments.filter((mc) => mc.status === 'orphaned'),
    [mappedComments],
  );

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <span className="diff-viewer__version-label">
          v{oldVersionNumber} {'\u2194'} v{newVersionNumber}
        </span>
      </div>

      {viewMode === 'inline' ? (
        <InlineDiff
          diffLines={diffLines}
          commentsByNewLine={commentsByNewLine}
          commentsByOldLine={commentsByOldLine}
        />
      ) : (
        <SideBySideDiff
          diffLines={diffLines}
          commentsByNewLine={commentsByNewLine}
          commentsByOldLine={commentsByOldLine}
        />
      )}

      <OrphanedPanel orphaned={orphaned} />
    </div>
  );
};
