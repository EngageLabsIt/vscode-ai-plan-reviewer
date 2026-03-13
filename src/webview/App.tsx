import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { PlanViewer } from './components/PlanViewer';
import { ReviewToolbar } from './components/ReviewToolbar';
import { CommentNavigator } from './components/CommentNavigator';
import { CommentForm } from './components/CommentForm';
import { PromptPreview } from './components/PromptPreview';
import type { HostMessage } from '../../shared/messages';
import type { Comment, Plan, Section, Version } from '../../shared/models';

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

type CommentFormState =
  | { type: 'section'; sectionId: string; heading: string }
  | { type: 'line';    lineNumber: number }
  | { type: 'range';   startLine: number; endLine: number };

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const vscode = useVsCodeApi();
  const [loadedPlan, setLoadedPlan] = useState<LoadedPlan | null>(null);
  const loadedPlanRef = useRef<LoadedPlan | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [commentFormState, setCommentFormState] = useState<CommentFormState | null>(null);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

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

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = useCallback((): void => {
    if (loadedPlan === null) return;
    vscode.postMessage({ type: 'approvePlan', payload: { planId: loadedPlan.plan.id } });
  }, [loadedPlan, vscode]);

  // ── Select version ─────────────────────────────────────────────────────────
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
    setCommentFormState({ type: 'section', sectionId, heading: section.heading });
  }, []);

  const handleAddLineComment = useCallback((lineNumber: number): void => {
    if (activeCommentLine === lineNumber) {
      setActiveCommentLine(null);
      setCommentFormState(null);
      return;
    }
    setActiveCommentLine(lineNumber);
    setCommentFormState({ type: 'line', lineNumber });
  }, [activeCommentLine]);

  const handleLineShiftClick = useCallback((lineNumber: number): void => {
    if (activeCommentLine === null) return;
    setCommentFormState({
      type: 'range',
      startLine: Math.min(activeCommentLine, lineNumber),
      endLine: Math.max(activeCommentLine, lineNumber),
    });
  }, [activeCommentLine]);

  const handleEditComment = useCallback((id: string, body: string, category: Comment['category']): void => {
    vscode.postMessage({ type: 'updateComment', payload: { id, body, category } });
  }, [vscode]);

  const handleDeleteComment = useCallback((id: string): void => {
    vscode.postMessage({ type: 'deleteComment', payload: { id } });
  }, [vscode]);

  const handleResolveComment = useCallback((id: string): void => {
    vscode.postMessage({ type: 'resolveComment', payload: { id } });
  }, [vscode]);

  const handleCommentFormSubmit = useCallback((body: string, category: Comment['category']): void => {
    if (commentFormState === null || loadedPlan === null) return;

    if (commentFormState.type === 'section') {
      const section = loadedPlan.sections.find((s) => s.id === commentFormState.sectionId);
      if (section === undefined) return;
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'section', sectionId: section.id, targetStart: section.startLine, targetEnd: section.endLine, body, category, resolved: false, carriedFromId: null } });
    } else if (commentFormState.type === 'line') {
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'line', sectionId: null, targetStart: commentFormState.lineNumber, targetEnd: commentFormState.lineNumber, body, category, resolved: false, carriedFromId: null } });
    } else {
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'range', sectionId: null, targetStart: commentFormState.startLine, targetEnd: commentFormState.endLine, body, category, resolved: false, carriedFromId: null } });
    }

    setCommentFormState(null);
    setActiveCommentLine(null);
  }, [commentFormState, loadedPlan, vscode]);

  const handleCommentFormCancel = useCallback((): void => {
    setCommentFormState(null);
    setActiveCommentLine(null);
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
            onApprove={handleApprove}
            onSelectVersion={handleSelectVersion}
          />
          {/* <PlanTimeline
            versions={loadedPlan.versions}
            currentVersionNumber={loadedPlan.versionNumber}
            planStatus={loadedPlan.plan.status}
            onSelectVersion={handleSelectVersion}
            collapsed={timelineCollapsed}
            onToggleCollapse={handleTimelineToggle}
          /> */}
          <div className="plan-content-area">
            <PlanViewer
              content={loadedPlan.content}
              sections={loadedPlan.sections}
              versionNumber={loadedPlan.versionNumber}
              sectionComments={sectionComments}
              allComments={loadedPlan.comments}
              onCommentSection={handleCommentSection}
              onAddLineComment={handleAddLineComment}
              onLineShiftClick={handleLineShiftClick}
              activeCommentLine={activeCommentLine}
              commentRange={
                commentFormState?.type === 'range'
                  ? { start: commentFormState.startLine, end: commentFormState.endLine }
                  : null
              }
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
              onResolve={handleResolveComment}
            />
            <CommentNavigator
              comments={loadedPlan.comments}
              sections={loadedPlan.sections}
              isOpen={navigatorOpen}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
              onResolve={handleResolveComment}
            />
          </div>

          {/* CommentForm modal — rendered when a target is selected */}
          {commentFormState !== null && (
            <CommentForm
              target={
                commentFormState.type === 'section'
                  ? { type: 'section', heading: commentFormState.heading }
                  : commentFormState.type === 'line'
                    ? { type: 'line', lineNumber: commentFormState.lineNumber }
                    : { type: 'range', startLine: commentFormState.startLine, endLine: commentFormState.endLine }
              }
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
