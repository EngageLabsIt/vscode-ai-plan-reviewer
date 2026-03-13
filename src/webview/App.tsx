import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { PlanViewer } from './components/PlanViewer';
import { DiffViewer } from './components/DiffViewer';
import { ReviewToolbar } from './components/ReviewToolbar';
import { PlanTimeline } from './components/PlanTimeline';
import { CommentNavigator } from './components/CommentNavigator';
import { CommentForm } from './components/CommentForm';
import { PromptPreview } from './components/PromptPreview';
import type { HostMessage } from '../../shared/messages';
import type { Comment, DiffLine, MappedComment, Plan, Section, Version } from '../../shared/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadedPlan {
  plan: Plan;
  versionId: string;
  content: string;
  sections: Section[];
  versionNumber: number;
  versions: Version[];
  comments: Comment[];
}

interface CommentFormSection {
  sectionId: string;
  heading: string;
}

interface DiffState {
  diffLines: DiffLine[];
  mappedComments: MappedComment[];
  oldVersionNumber: number;
  newVersionNumber: number;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const vscode = useVsCodeApi();
  const [loadedPlan, setLoadedPlan] = useState<LoadedPlan | null>(null);
  const loadedPlanRef = useRef<LoadedPlan | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [commentFormSection, setCommentFormSection] = useState<CommentFormSection | null>(null);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [diffActive, setDiffActive] = useState(false);
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [diffPair, setDiffPair] = useState<{ oldVN: number; newVN: number } | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'side-by-side'>('inline');
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  // Signal readiness to the extension host
  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
  }, [vscode]);

  // Listen for messages from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent<HostMessage>): void => {
      const message = event.data;

      if (message.type === 'planLoaded') {
        const { plan, version, versions, sections, comments } = message.payload;
        const next: LoadedPlan = {
          plan,
          versionId: version.id,
          content: version.content,
          sections,
          versionNumber: version.versionNumber,
          versions,
          comments,
        };
        setLoadedPlan(next);
        loadedPlanRef.current = next;
        return;
      }

      if (message.type === 'commentAdded') {
        setLoadedPlan((prev) =>
          prev !== null
            ? { ...prev, comments: [...prev.comments, message.payload] }
            : prev,
        );
        return;
      }

      if (message.type === 'commentUpdated') {
        const updated = message.payload;
        setLoadedPlan((prev) =>
          prev !== null
            ? {
                ...prev,
                comments: prev.comments.map((c) => (c.id === updated.id ? updated : c)),
              }
            : prev,
        );
        return;
      }

      if (message.type === 'commentDeleted') {
        const { commentId } = message.payload;
        setLoadedPlan((prev) =>
          prev !== null
            ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
            : prev,
        );
        return;
      }

      if (message.type === 'planStatusUpdated') {
        const { planId, status } = message.payload;
        setLoadedPlan((prev) =>
          prev !== null && prev.plan.id === planId
            ? { ...prev, plan: { ...prev.plan, status } }
            : prev,
        );
        return;
      }

      if (message.type === 'error') {
        console.error('[Plan Reviewer]', message.payload.message);
        return;
      }

      if (message.type === 'diffLoaded') {
        const { diffLines, mappedComments, oldVersionNumber, newVersionNumber } = message.payload;
        setDiffState({ diffLines, mappedComments, oldVersionNumber, newVersionNumber });
        return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // ── Navigator toggle ───────────────────────────────────────────────────────
  const handleToggleNavigator = useCallback((): void => {
    setNavigatorOpen((open) => !open);
  }, []);

  // ── Prompt preview ─────────────────────────────────────────────────────────
  const handleGeneratePrompt = useCallback((): void => {
    if (loadedPlan === null) return;
    setPromptPreviewOpen(true);
  }, [loadedPlan]);

  const handleClosePromptPreview = useCallback((): void => {
    setPromptPreviewOpen(false);
  }, []);

  // ── Diff toggle ────────────────────────────────────────────────────────────
  const handleToggleDiff = useCallback((): void => {
    setDiffActive((active) => {
      if (active) {
        // Turning off — clear diff state
        setDiffState(null);
        setDiffPair(null);
        return false;
      }

      // Turning on — request diff for current version vs previous
      const current = loadedPlanRef.current;
      if (current === null || current.versionNumber <= 1) {
        // No previous version to compare against
        return false;
      }

      const oldVN = current.versionNumber - 1;
      const newVN = current.versionNumber;
      setDiffPair({ oldVN, newVN });

      vscode.postMessage({
        type: 'requestDiff',
        payload: {
          planId: current.plan.id,
          versionNumberOld: oldVN,
          versionNumberNew: newVN,
        },
      });

      return true;
    });
  }, [vscode]);

  // ── Diff pair navigation ───────────────────────────────────────────────────
  const handleDiffPrev = useCallback((): void => {
    const current = loadedPlanRef.current;
    if (current === null || diffPair === null) return;
    if (diffPair.oldVN <= 1) return;
    const newPair = { oldVN: diffPair.oldVN - 1, newVN: diffPair.newVN - 1 };
    setDiffPair(newPair);
    vscode.postMessage({
      type: 'requestDiff',
      payload: {
        planId: current.plan.id,
        versionNumberOld: newPair.oldVN,
        versionNumberNew: newPair.newVN,
      },
    });
  }, [vscode, diffPair]);

  const handleDiffNext = useCallback((): void => {
    const current = loadedPlanRef.current;
    if (current === null || diffPair === null) return;
    if (diffPair.newVN >= current.versions.length) return;
    const newPair = { oldVN: diffPair.oldVN + 1, newVN: diffPair.newVN + 1 };
    setDiffPair(newPair);
    vscode.postMessage({
      type: 'requestDiff',
      payload: {
        planId: current.plan.id,
        versionNumberOld: newPair.oldVN,
        versionNumberNew: newPair.newVN,
      },
    });
  }, [vscode, diffPair]);

  // ── Diff view mode toggle ─────────────────────────────────────────────────
  const handleToggleDiffViewMode = useCallback((): void => {
    setDiffViewMode((mode) => (mode === 'inline' ? 'side-by-side' : 'inline'));
  }, []);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const handleTimelineToggle = useCallback((): void => {
    setTimelineCollapsed((c) => !c);
  }, []);

  const handleSelectVersion = useCallback((versionNumber: number): void => {
    const current = loadedPlanRef.current;
    if (current === null) return;
    vscode.postMessage({
      type: 'requestPlan',
      payload: { planId: current.plan.id, versionNumber },
    });
  }, [vscode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        if (loadedPlanRef.current !== null) {
          setPromptPreviewOpen(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ── Section comment handlers ───────────────────────────────────────────────

  const handleCommentSection = useCallback((sectionId: string): void => {
    const current = loadedPlanRef.current;
    if (current === null) return;
    const section = current.sections.find((s) => s.id === sectionId);
    if (section === undefined) return;
    setCommentFormSection({ sectionId, heading: section.heading });
  }, []);

  const handleCommentFormSubmit = useCallback((
    body: string,
    category: Comment['category'],
  ): void => {
    if (commentFormSection === null || loadedPlan === null) return;

    const section = loadedPlan.sections.find((s) => s.id === commentFormSection.sectionId);
    if (section === undefined) return;

    vscode.postMessage({
      type: 'addComment',
      payload: {
        versionId: loadedPlan.versionId,
        type: 'section',
        sectionId: section.id,
        targetStart: section.startLine,
        targetEnd: section.endLine,
        body,
        category,
        resolved: false,
        carriedFromId: null,
      },
    });

    setCommentFormSection(null);
  }, [commentFormSection, loadedPlan, vscode]);

  const handleCommentFormCancel = useCallback((): void => {
    setCommentFormSection(null);
  }, []);

  // ── Derived: section-scoped comments only ─────────────────────────────────
  const sectionComments = useMemo<Comment[]>(() => {
    if (loadedPlan === null) return [];
    return loadedPlan.comments.filter((c) => c.type === 'section');
  }, [loadedPlan]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="plan-reviewer-app">
      {loadedPlan !== null ? (
        <>
          <ReviewToolbar
            plan={loadedPlan.plan}
            versionNumber={loadedPlan.versionNumber}
            versions={loadedPlan.versions}
            comments={loadedPlan.comments}
            onToggleNavigator={handleToggleNavigator}
            navigatorOpen={navigatorOpen}
            onGeneratePrompt={handleGeneratePrompt}
            onToggleDiff={handleToggleDiff}
            diffActive={diffActive}
            diffPair={diffPair}
            onDiffPrev={handleDiffPrev}
            onDiffNext={handleDiffNext}
            diffViewMode={diffViewMode}
            onToggleDiffViewMode={handleToggleDiffViewMode}
          />
          <PlanTimeline
            versions={loadedPlan.versions}
            currentVersionNumber={loadedPlan.versionNumber}
            planStatus={loadedPlan.plan.status}
            onSelectVersion={handleSelectVersion}
            collapsed={timelineCollapsed}
            onToggleCollapse={handleTimelineToggle}
          />
          <div className="plan-content-area">
            {diffActive && diffState !== null ? (
              <DiffViewer
                diffLines={diffState.diffLines}
                mappedComments={diffState.mappedComments}
                oldVersionNumber={diffState.oldVersionNumber}
                newVersionNumber={diffState.newVersionNumber}
                viewMode={diffViewMode}
              />
            ) : (
              <PlanViewer
                content={loadedPlan.content}
                sections={loadedPlan.sections}
                versionNumber={loadedPlan.versionNumber}
                sectionComments={sectionComments}
                onCommentSection={handleCommentSection}
              />
            )}
            <CommentNavigator
              comments={loadedPlan.comments}
              sections={loadedPlan.sections}
              isOpen={navigatorOpen}
            />
          </div>

          {/* CommentForm modal — rendered when a section is selected */}
          {commentFormSection !== null && (
            <CommentForm
              sectionHeading={commentFormSection.heading}
              onSubmit={handleCommentFormSubmit}
              onCancel={handleCommentFormCancel}
            />
          )}

          {promptPreviewOpen && (
            <PromptPreview
              planTitle={loadedPlan.plan.title}
              versionNumber={loadedPlan.versionNumber}
              versionContent={loadedPlan.content}
              planCreatedAt={loadedPlan.plan.createdAt}
              versionId={loadedPlan.versionId}
              comments={loadedPlan.comments}
              sections={loadedPlan.sections}
              onClose={handleClosePromptPreview}
            />
          )}
        </>
      ) : (
        <p className="plan-reviewer-placeholder">
          Plan Reviewer — Ready. Use &ldquo;Plan Reviewer: New Review&rdquo; to start.
        </p>
      )}
    </div>
  );
};
