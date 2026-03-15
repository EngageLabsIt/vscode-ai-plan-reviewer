import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, Section } from '../../../shared/models';
import { PromptGenerator } from '../../../shared/PromptGenerator';
import type { PromptMode } from '../../../shared/PromptGenerator';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';

interface PromptPreviewProps {
  planTitle: string;
  versionNumber: number;
  versionContent: string;
  planCreatedAt: string;
  versionId: string;
  comments: Comment[];
  sections: Section[];
  onClose: () => void;
}

const generator = new PromptGenerator();

const OLD_PLAN_MS = 4 * 60 * 60 * 1000;

export const PromptPreview: React.FC<PromptPreviewProps> = ({
  planTitle,
  versionNumber,
  versionContent,
  planCreatedAt,
  versionId,
  comments,
  sections,
  onClose,
}) => {
  const vscode = useVsCodeApi();
  const [mode, setMode] = useState<PromptMode>('same_session');
  const [copied, setCopied] = useState(false);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const sameSessionBtnRef = useRef<HTMLButtonElement>(null);
  const newSessionBtnRef = useRef<HTMLButtonElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnBottomRef = useRef<HTMLButtonElement>(null);

  const isOldPlan = useMemo(
    () => Date.now() - Date.parse(planCreatedAt) > OLD_PLAN_MS,
    [planCreatedAt],
  );

  const showWarning = isOldPlan && mode === 'same_session';

  const ageHours = useMemo(() => {
    const ms = Date.now() - Date.parse(planCreatedAt);
    return Math.floor(ms / (60 * 60 * 1000));
  }, [planCreatedAt]);

  const prompt = useMemo(
    () =>
      generator.generate({
        planTitle,
        versionNumber,
        versionContent,
        comments,
        sections,
        mode,
      }),
    [planTitle, versionNumber, versionContent, comments, sections, mode],
  );

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = [
        closeBtnRef.current,
        sameSessionBtnRef.current,
        newSessionBtnRef.current,
        copyBtnRef.current,
        closeBtnBottomRef.current,
      ].filter((el): el is HTMLElement => el !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleCopy = useCallback((): void => {
    void navigator.clipboard.writeText(prompt).then(() => {
      vscode.postMessage({
        type: 'saveReviewPrompt',
        payload: { versionId, prompt },
      });
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    });
  }, [prompt, versionId, vscode]);

  return (
    <div
      className="prompt-preview__backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="prompt-preview"
        role="dialog"
        aria-modal={true}
        aria-labelledby="prompt-preview-title"
      >
        <div className="prompt-preview__header">
          <h3 id="prompt-preview-title" className="prompt-preview__title">
            Generate Review Prompt — v{versionNumber}
          </h3>
          <button
            ref={closeBtnRef}
            className="prompt-preview__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {showWarning && (
          <div className="prompt-preview__old-plan-warning" role="alert">
            This plan was created {ageHours} hours ago. Copilot might not remember it. Use &lsquo;Full context&rsquo; mode?
          </div>
        )}

        <div className="prompt-preview__mode-bar" role="group" aria-label="Prompt mode">
          <button
            ref={sameSessionBtnRef}
            className={
              mode === 'same_session'
                ? 'prompt-preview__mode-btn prompt-preview__mode-btn--active'
                : 'prompt-preview__mode-btn'
            }
            onClick={() => { setMode('same_session'); }}
            aria-pressed={mode === 'same_session'}
          >
            Same session
          </button>
          <button
            ref={newSessionBtnRef}
            className={
              mode === 'new_session'
                ? 'prompt-preview__mode-btn prompt-preview__mode-btn--active'
                : 'prompt-preview__mode-btn'
            }
            onClick={() => { setMode('new_session'); }}
            aria-pressed={mode === 'new_session'}
          >
            Full context
          </button>
        </div>

        <div className="prompt-preview__body">
          <div className="prompt-preview__content" aria-label="Generated review prompt">
            {prompt}
          </div>
        </div>

        <div className="prompt-preview__footer">
          <span className="prompt-preview__footer-feedback">
            {copied ? '✓ Copied to clipboard! Paste in Copilot Chat.' : ''}
          </span>
          <button
            ref={copyBtnRef}
            className="prompt-preview__btn prompt-preview__btn--primary"
            onClick={handleCopy}
          >
            Copy to Clipboard
          </button>
          <button
            ref={closeBtnBottomRef}
            className="prompt-preview__btn prompt-preview__btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
