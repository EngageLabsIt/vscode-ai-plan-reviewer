export const EXTENSION_ID = 'plan-reviewer';
export const WEBVIEW_VIEW_TYPE = 'planReviewer.reviewPanel';
export const COMMENT_CATEGORIES = ['suggestion'] as const;
export const COMMENT_TYPES = ['line', 'range', 'section', 'global'] as const;
export const PLAN_STATUSES = ['in_review', 'archived'] as const;
export const PLAN_SOURCES = ['copilot', 'manual', 'other'] as const;
