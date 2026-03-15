import { useEffect, useRef, useState } from 'react';
import type { HostMessage } from '../../shared/messages';
import type { Comment, Plan, Section, Version } from '../../shared/models';
import type { WebViewMessage } from '../../shared/messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VsCodeApi {
  postMessage(message: WebViewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

export interface LoadedPlan {
  plan: Plan;
  versionId: string;
  content: string;
  sections: Section[];
  versionNumber: number;
  versions: Version[];
  comments: Comment[];
}

export interface UsePlanMessagesReturn {
  loadedPlan: LoadedPlan | null;
  setLoadedPlan: React.Dispatch<React.SetStateAction<LoadedPlan | null>>;
  loadedPlanRef: React.RefObject<LoadedPlan | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlanMessages(vscodeApi: VsCodeApi): UsePlanMessagesReturn {
  const [loadedPlan, setLoadedPlan] = useState<LoadedPlan | null>(null);
  const loadedPlanRef = useRef<LoadedPlan | null>(null);

  // Signal readiness to the extension host
  useEffect(() => {
    vscodeApi.postMessage({ type: 'ready' });
  }, [vscodeApi]);

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
          prev !== null ? { ...prev, comments: [...prev.comments, message.payload] } : prev,
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

      if (message.type === 'diffLoaded') {
        // diffLoaded is handled elsewhere (not used in App.tsx currently)
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

  return { loadedPlan, setLoadedPlan, loadedPlanRef };
}
