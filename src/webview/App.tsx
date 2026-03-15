import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { PlanViewer } from './features/plan-viewer/PlanViewer';
import { ReviewToolbar } from './features/toolbar/ReviewToolbar';
import { CommentNavigator } from './features/comments/CommentNavigator';
import { SearchBar } from './features/search/SearchBar';
import { PromptPreview } from './features/prompt/PromptPreview';
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
  | { type: 'line';    lineNumber: number; startCharOffset: number | null; endCharOffset: number | null; selectedText: string | null }
  | { type: 'range';   startLine: number; endLine: number; startCharOffset: number | null; endCharOffset: number | null; selectedText: string | null };

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
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
    setCommentFormState({ type: 'line', lineNumber, startCharOffset: null, endCharOffset: null, selectedText: null });
  }, [activeCommentLine]);

  const handleLineShiftClick = useCallback((lineNumber: number): void => {
    if (activeCommentLine === null) return;
    setCommentFormState({
      type: 'range',
      startLine: Math.min(activeCommentLine, lineNumber),
      endLine: Math.max(activeCommentLine, lineNumber),
      startCharOffset: null,
      endCharOffset: null,
      selectedText: null,
    });
  }, [activeCommentLine]);

  const handleEditComment = useCallback((id: string, body: string): void => {
    vscode.postMessage({ type: 'updateComment', payload: { id, body } });
  }, [vscode]);

  const handleDeleteComment = useCallback((id: string): void => {
    vscode.postMessage({ type: 'deleteComment', payload: { id } });
  }, [vscode]);

  const handleResolveComment = useCallback((id: string): void => {
    vscode.postMessage({ type: 'resolveComment', payload: { id } });
  }, [vscode]);

  const handleCommentFormSubmit = useCallback((body: string): void => {
    if (commentFormState === null || loadedPlan === null) return;
    const category: Comment['category'] = 'suggestion';

    if (commentFormState.type === 'section') {
      const section = loadedPlan.sections.find((s) => s.id === commentFormState.sectionId);
      if (section === undefined) return;
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'section', sectionId: section.id, targetStart: section.startLine, targetEnd: section.endLine, body, category, resolved: false, carriedFromId: null, targetStartChar: null, targetEndChar: null, selectedText: null } });
    } else if (commentFormState.type === 'line') {
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'line', sectionId: null, targetStart: commentFormState.lineNumber, targetEnd: commentFormState.lineNumber, body, category, resolved: false, carriedFromId: null, targetStartChar: commentFormState.startCharOffset ?? null, targetEndChar: commentFormState.endCharOffset ?? null, selectedText: commentFormState.selectedText ?? null } });
    } else {
      vscode.postMessage({ type: 'addComment', payload: { versionId: loadedPlan.versionId, type: 'range', sectionId: null, targetStart: commentFormState.startLine, targetEnd: commentFormState.endLine, body, category, resolved: false, carriedFromId: null, targetStartChar: commentFormState.startCharOffset ?? null, targetEndChar: commentFormState.endCharOffset ?? null, selectedText: commentFormState.selectedText ?? null } });
    }

    setCommentFormState(null);
    setActiveCommentLine(null);
  }, [commentFormState, loadedPlan, vscode]);

  const handleSelectionComment = useCallback((startLine: number, endLine: number, startChar: number | null, endChar: number | null, selectedText: string): void => {
    if (startLine === endLine) {
      setActiveCommentLine(startLine);
      setCommentFormState({ type: 'line', lineNumber: startLine, startCharOffset: startChar, endCharOffset: endChar, selectedText });
    } else {
      setActiveCommentLine(startLine);
      setCommentFormState({ type: 'range', startLine, endLine, startCharOffset: startChar, endCharOffset: endChar, selectedText });
    }
  }, []);

  const handleCommentFormCancel = useCallback((): void => {
    setCommentFormState(null);
    setActiveCommentLine(null);
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length === 0 || loadedPlan === null) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const lines = loadedPlan.content.split('\n');
    const matches: number[] = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) {
        matches.push(i + 1);
      }
    });
    setSearchMatches(matches);
    setSearchIndex(matches.length > 0 ? 1 : 0);
  }, [searchQuery, loadedPlan]);

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

  const searchCurrentLine = searchMatches.length > 0 && searchIndex > 0
    ? searchMatches[searchIndex - 1]
    : null;

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
            onToggleSearch={handleToggleSearch}
            searchOpen={searchOpen}
            onGeneratePrompt={handleGeneratePrompt}
            onApprove={handleApprove}
            onSelectVersion={handleSelectVersion}
          />
          {/* <PlanTimeline
            versions={loadedPlan.versions}
            currentVersionNumber={loadedPlan.versionNumber}
            onSelectVersion={handleSelectVersion}
            collapsed={timelineCollapsed}
            onToggleCollapse={handleTimelineToggle}
          /> */}
          <div className="plan-content-area">
            {searchOpen && (
              <SearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                currentIndex={searchIndex}
                totalMatches={searchMatches.length}
                onNext={handleSearchNext}
                onPrev={handleSearchPrev}
                onClose={handleSearchClose}
              />
            )}
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
              searchMatches={searchMatches}
              searchCurrentLine={searchCurrentLine}
              commentFormState={commentFormState}
              onCommentSubmit={handleCommentFormSubmit}
              onCommentCancel={handleCommentFormCancel}
              onSelectionComment={handleSelectionComment}
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
