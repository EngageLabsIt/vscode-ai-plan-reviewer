import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { usePlanMessages } from './hooks/usePlanMessages';
import { useSearch } from './features/search/useSearch';
import { ReviewToolbar } from './features/toolbar/ReviewToolbar';
import { CommentNavigator } from './features/comments/CommentNavigator';
import { SearchBar } from './features/search/SearchBar';
import { PromptPreview } from './features/prompt/PromptPreview';
import { CommentContext } from './features/comments/CommentContext';
import { PlanReviewView } from './components/PlanReviewView';
import type { Comment } from '../shared/models';
import type { CommentFormState } from './features/comments/CommentContext';
import './styles/annotations.css';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const vscode = useVsCodeApi();
  const { loadedPlan, loadedPlanRef } = usePlanMessages(vscode);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [commentFormState, setCommentFormState] =
    useState<CommentFormState | null>(null);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(
    null,
  );
  const activeCommentLineRef = useRef<number | null>(null);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [globalCommentEditCount, setGlobalCommentEditCount] = useState(0);

  useEffect(() => {
    setGlobalCommentEditCount(0);
  }, [loadedPlan?.versionId]);

  const {
    searchOpen,
    searchQuery,
    searchMatches,
    searchIndex,
    handleToggleSearch,
    setSearchQuery,
    handleSearchNext,
    handleSearchPrev,
    handleSearchClose,
  } = useSearch(loadedPlan?.content);

  // ── Active comment line setter ─────────────────────────────────────────────
  const setActiveLine = useCallback((value: number | null) => {
    activeCommentLineRef.current = value;
    setActiveCommentLine(value);
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
    vscode.postMessage({
      type: 'approvePlan',
      payload: { planId: loadedPlan.plan.id },
    });
  }, [loadedPlan, vscode]);

  // ── Select version ─────────────────────────────────────────────────────────
  const handleSelectVersion = useCallback(
    (versionNumber: number): void => {
      const current = loadedPlanRef.current;
      if (current === null) return;
      vscode.postMessage({
        type: 'requestPlan',
        payload: { planId: current.plan.id, versionNumber },
      });
    },
    [vscode],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        handleToggleSearch();
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
  }, [handleToggleSearch]);

  const handleEditComment = useCallback(
    (id: string, body: string): void => {
      vscode.postMessage({ type: 'updateComment', payload: { id, body } });
    },
    [vscode],
  );

  const handleDeleteComment = useCallback(
    (id: string): void => {
      vscode.postMessage({ type: 'deleteComment', payload: { id } });
    },
    [vscode],
  );

  const handleCommentFormSubmit = useCallback(
    (body: string): void => {
      if (commentFormState === null || loadedPlan === null) return;
      const category: Comment['category'] = 'suggestion';

      if (commentFormState.type === 'section') {
        const section = loadedPlan.sections.find(
          (s) => s.id === commentFormState.sectionId,
        );
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
            carriedFromId: null,
            targetStartChar: null,
            targetEndChar: null,
            selectedText: null,
          },
        });
      } else if (commentFormState.type === 'line') {
        vscode.postMessage({
          type: 'addComment',
          payload: {
            versionId: loadedPlan.versionId,
            type: 'line',
            sectionId: null,
            targetStart: commentFormState.lineNumber,
            targetEnd: commentFormState.lineNumber,
            body,
            category,
            carriedFromId: null,
            targetStartChar: commentFormState.startCharOffset ?? null,
            targetEndChar: commentFormState.endCharOffset ?? null,
            selectedText: commentFormState.selectedText ?? null,
          },
        });
      } else if (commentFormState.type === 'range') {
        vscode.postMessage({
          type: 'addComment',
          payload: {
            versionId: loadedPlan.versionId,
            type: 'range',
            sectionId: null,
            targetStart: commentFormState.startLine,
            targetEnd: commentFormState.endLine,
            body,
            category,
            carriedFromId: null,
            targetStartChar: commentFormState.startCharOffset ?? null,
            targetEndChar: commentFormState.endCharOffset ?? null,
            selectedText: commentFormState.selectedText ?? null,
          },
        });
      } else if (commentFormState.type === 'global') {
        vscode.postMessage({
          type: 'addComment',
          payload: {
            versionId: loadedPlan.versionId,
            type: 'global',
            sectionId: null,
            targetStart: 0,
            targetEnd: 0,
            body,
            category: 'suggestion' as const,
            carriedFromId: null,
            targetStartChar: null,
            targetEndChar: null,
            selectedText: null,
          },
        });
      }

      setCommentFormState(null);
      setActiveLine(null);
    },
    [commentFormState, loadedPlan, vscode, setActiveLine],
  );

  const handleCommentFormCancel = useCallback((): void => {
    setCommentFormState(null);
    setActiveLine(null);
  }, [setActiveLine]);

  const handleGlobalComment = useCallback((): void => {
    if (loadedPlan === null) return;
    const existingGlobal = loadedPlan.comments.find((c) => c.type === 'global');
    if (existingGlobal !== undefined) {
      setGlobalCommentEditCount((n) => n + 1);
    } else {
      setCommentFormState({ type: 'global' });
    }
  }, [loadedPlan]);

  // ── Render ────────────────────────────────────────────────────────────────
  const commentContextValue = useMemo(
    () => ({
      comments: loadedPlan?.comments ?? [],
      onEdit: handleEditComment,
      onDelete: handleDeleteComment,
      commentFormState,
      activeCommentLine,
      openCommentForm: setCommentFormState,
      closeCommentForm: handleCommentFormCancel,
      onCommentSubmit: handleCommentFormSubmit,
    }),
    [
      loadedPlan,
      handleEditComment,
      handleDeleteComment,
      commentFormState,
      activeCommentLine,
      handleCommentFormCancel,
      handleCommentFormSubmit,
    ],
  );

  return (
    <CommentContext.Provider value={commentContextValue}>
      <div className='plan-reviewer-app'>
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
              onGlobalComment={handleGlobalComment}
              hasGlobalComment={loadedPlan.comments.some(
                (c) => c.type === 'global',
              )}
            />
            <div className='plan-content-area'>
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
              <PlanReviewView
                html={loadedPlan.html}
                comments={loadedPlan.comments}
                onUpdateComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                globalCommentEditRequested={globalCommentEditCount}
                searchMatches={searchMatches}
                searchIndex={searchIndex}
              />
              <CommentNavigator isOpen={navigatorOpen} />
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
          <p className='plan-reviewer-placeholder'>
            Plan Reviewer — Ready. Use &ldquo;Plan Reviewer: New Review&rdquo;
            to start.
          </p>
        )}
      </div>
    </CommentContext.Provider>
  );
};
