import React, { useCallback } from 'react';
import type { Plan, Version } from '../../shared/models';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlanTimelineProps {
  versions: Version[];
  currentVersionNumber: number;
  planStatus: Plan['status'];
  onSelectVersion: (versionNumber: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatElapsed(olderIso: string, newerIso: string): string {
  const ms = new Date(newerIso).getTime() - new Date(olderIso).getTime();
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d later`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m later` : `${hours}h later`;
  }
  return `${minutes}m later`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PlanTimeline: React.FC<PlanTimelineProps> = ({
  versions,
  currentVersionNumber,
  planStatus,
  onSelectVersion,
  collapsed,
  onToggleCollapse,
}) => {
  const handleNodeClick = useCallback(
    (versionNumber: number): void => {
      if (versionNumber !== currentVersionNumber) {
        onSelectVersion(versionNumber);
      }
    },
    [currentVersionNumber, onSelectVersion],
  );

  const isApproved = planStatus === 'approved';
  const lastVersionNumber = versions.length > 0 ? versions[versions.length - 1].versionNumber : -1;

  return (
    <div className={`plan-timeline${collapsed ? ' plan-timeline--collapsed' : ''}`}>
      <button
        className="plan-timeline__toggle"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Espandi timeline' : 'Comprimi timeline'}
      >
        <span className="plan-timeline__toggle-label">Timeline</span>
        <span className="plan-timeline__toggle-chevron" aria-hidden="true">
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <div className="plan-timeline__scroll" role="list" aria-label="Versioni del piano">
          <div className="plan-timeline__nodes">
            {versions.map((version, idx) => {
              const isCurrent = version.versionNumber === currentVersionNumber;
              const isLast = version.versionNumber === lastVersionNumber;
              const nodeApproved = isApproved && isLast;

              const prevVersion = idx > 0 ? versions[idx - 1] : null;
              const elapsed =
                prevVersion !== null
                  ? formatElapsed(prevVersion.createdAt, version.createdAt)
                  : null;

              return (
                <div key={version.id} className="plan-timeline__node-group" role="listitem">
                  {idx > 0 && (
                    <div className="plan-timeline__connector" aria-hidden="true">
                      <span className="plan-timeline__arrow">→</span>
                      {elapsed !== null && elapsed !== '' && (
                        <span className="plan-timeline__elapsed">{elapsed}</span>
                      )}
                    </div>
                  )}
                  <div
                    className={[
                      'plan-timeline__node',
                      isCurrent ? 'plan-timeline__node--current' : '',
                      nodeApproved ? 'plan-timeline__node--approved' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button
                      className="plan-timeline__circle"
                      onClick={() => handleNodeClick(version.versionNumber)}
                      aria-current={isCurrent ? 'true' : undefined}
                      aria-label={`Versione ${version.versionNumber}${isCurrent ? ' (corrente)' : ''}`}
                      title={`v${version.versionNumber} — ${formatDate(version.createdAt)}${nodeApproved ? ' ✅ Approvato' : ''}`}
                    >
                      <span className="plan-timeline__version-label">
                        v{version.versionNumber}
                        {nodeApproved && ' ✅'}
                      </span>
                    </button>
                    <span className="plan-timeline__date" aria-hidden="true">
                      {formatDate(version.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
