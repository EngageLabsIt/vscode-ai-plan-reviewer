export interface Plan {
  id: string;
  title: string;
  source: 'copilot' | 'manual' | 'other';
  createdAt: string;
  updatedAt: string;
  status: 'in_review' | 'archived';
  tags: string[];
}

export interface Version {
  id: string;
  planId: string;
  versionNumber: number;
  content: string;
  reviewPrompt: string | null;
  createdAt: string;
}

export interface Section {
  id: string;
  versionId: string;
  heading: string;
  startLine: number;
  endLine: number;
  level: number;
  orderIndex: number;
}

export interface Comment {
  id: string;
  versionId: string;
  type: 'line' | 'range' | 'section' | 'global';
  targetStart: number;
  targetEnd: number;
  sectionId: string | null;
  body: string;
  category: 'suggestion';
  createdAt: string;
  carriedFromId: string | null;
  targetStartChar: number | null;
  targetEndChar: number | null;
  selectedText: string | null;
}

// ── Rendered markdown types ───────────────────────────────────────────────

export type RenderedLine =
  | { kind: 'text'; lineNumber: number; html: string }
  | { kind: 'code'; startLine: number; lineHtmls: string[] };

// ── Diff types ────────────────────────────────────────────────────────────

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  lineNumberOld: number | null;   // null for 'added' lines
  lineNumberNew: number | null;   // null for 'removed' lines
  content: string;                // new content (or unchanged content)
  oldContent?: string;            // only for type 'modified'
}

export interface MappedComment {
  comment: Comment;
  newTargetStart: number | null;  // null = orphaned
  newTargetEnd: number | null;
  status: 'probably_resolved' | 'probably_unresolved' | 'orphaned';
}
