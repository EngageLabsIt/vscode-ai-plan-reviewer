export interface Plan {
  id: string;
  title: string;
  source: 'copilot' | 'manual' | 'other';
  createdAt: string;
  updatedAt: string;
  status: 'in_review' | 'approved' | 'archived' | 'needs_revision';
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
  type: 'line' | 'range' | 'section';
  targetStart: number;
  targetEnd: number;
  sectionId: string | null;
  body: string;
  category: 'suggestion' | 'issue' | 'question' | 'approval';
  resolved: boolean;
  createdAt: string;
  carriedFromId: string | null;
}

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
