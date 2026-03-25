import type {
  Plan,
  Version,
  Section,
  Comment,
  DiffLine,
  MappedComment,
} from './models';

// Host → WebView
export type HostMessage =
  | {
      type: 'planLoaded';
      payload: {
        plan: Plan;
        version: Version;
        versions: Version[];
        sections: Section[];
        comments: Comment[];
        html: string;
      };
    }
  | { type: 'commentAdded'; payload: Comment }
  | { type: 'commentUpdated'; payload: Comment }
  | { type: 'commentDeleted'; payload: { commentId: string } }
  | {
      type: 'planStatusUpdated';
      payload: { planId: string; status: Plan['status'] };
    }
  | {
      type: 'diffLoaded';
      payload: {
        diffLines: DiffLine[];
        oldVersionNumber: number;
        newVersionNumber: number;
        mappedComments: MappedComment[];
      };
    }
  | { type: 'error'; payload: { message: string } };

// WebView → Host
export type WebViewMessage =
  | { type: 'addComment'; payload: Omit<Comment, 'id' | 'createdAt'> }
  | { type: 'updateComment'; payload: { id: string; body?: string } }
  | { type: 'deleteComment'; payload: { id: string } }
  | { type: 'requestPlan'; payload: { planId: string; versionNumber?: number } }
  | {
      type: 'requestDiff';
      payload: {
        planId: string;
        versionNumberOld: number;
        versionNumberNew: number;
      };
    }
  | {
      type: 'updatePlanStatus';
      payload: { planId: string; status: Plan['status']; note?: string };
    }
  | { type: 'saveReviewPrompt'; payload: { versionId: string; prompt: string } }
  | { type: 'ready' };
