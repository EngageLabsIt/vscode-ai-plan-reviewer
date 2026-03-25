export interface ParsedSection {
  heading: string;
  startLine: number; // 1-based
  endLine: number; // 1-based, inclusive
  level: number; // 1-6 for markdown headings, 0 for bold/numbered
  orderIndex: number;
}

// ---------------------------------------------------------------------------
// Strategy detection helpers
// ---------------------------------------------------------------------------

const HEADING_RE = /^(#{1,6})\s*(.*?)\s*$/;
const BOLD_RE = /^\*\*(.+?)\*\*\s*$/;
const NUMBERED_RE = /^(\d+)\.\s+(.+)$/;
const CODE_FENCE_RE = /^```/;

type Strategy = 'heading' | 'bold' | 'numbered';

function detectStrategy(lines: string[]): Strategy {
  let insideCodeBlock = false;

  for (const line of lines) {
    if (CODE_FENCE_RE.test(line)) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }
    if (insideCodeBlock) {
      continue;
    }
    if (HEADING_RE.test(line)) {
      return 'heading';
    }
  }

  insideCodeBlock = false;
  for (const line of lines) {
    if (CODE_FENCE_RE.test(line)) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }
    if (insideCodeBlock) {
      continue;
    }
    if (BOLD_RE.test(line)) {
      return 'bold';
    }
  }

  return 'numbered';
}

// ---------------------------------------------------------------------------
// Section-starter matchers per strategy
// ---------------------------------------------------------------------------

interface StarterInfo {
  heading: string;
  level: number;
}

function matchHeading(line: string): StarterInfo | null {
  const m = HEADING_RE.exec(line);
  if (!m) {
    return null;
  }
  const hashes = m[1] ?? '';
  const text = m[2] ?? '';
  return { heading: text.trim(), level: hashes.length };
}

function matchBold(line: string): StarterInfo | null {
  const m = BOLD_RE.exec(line);
  if (!m) {
    return null;
  }
  return { heading: (m[1] ?? '').trim(), level: 0 };
}

function matchNumbered(line: string): StarterInfo | null {
  const m = NUMBERED_RE.exec(line);
  if (!m) {
    return null;
  }
  return { heading: (m[2] ?? '').trim(), level: 0 };
}

type MatchFn = (line: string) => StarterInfo | null;

function matcherForStrategy(strategy: Strategy): MatchFn {
  switch (strategy) {
    case 'heading':
      return matchHeading;
    case 'bold':
      return matchBold;
    case 'numbered':
      return matchNumbered;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class MarkdownParser {
  /**
   * Extracts the plan title from the first markdown heading found.
   * Returns null if no heading exists (caller should use "Untitled Plan + timestamp").
   */
  extractTitle(content: string): string | null {
    // multiline flag: ^ matches at start of each line
    const m = /^#{1,6}\s*(.+)$/m.exec(content);
    if (!m) {
      return null;
    }
    return (m[1] ?? '').trim();
  }

  /**
   * Parses markdown content and returns sections using the heuristic chain:
   * 1. Markdown headings (# ## ### etc.)
   * 2. Bold lines (**...**)
   * 3. Numbered list items (1. 2. etc.)
   *
   * Each section spans from its starter line to the line before the next
   * starter (or the last line of the file), 1-based and inclusive.
   */
  parseSections(content: string): ParsedSection[] {
    const lines = content.split('\n');
    const totalLines = lines.length;

    if (totalLines === 0) {
      return [];
    }

    const strategy = detectStrategy(lines);
    const match = matcherForStrategy(strategy);

    // Collect starter positions, skipping content inside code fences.
    interface StarterEntry {
      lineIndex: number; // 0-based
      info: StarterInfo;
    }

    const starters: StarterEntry[] = [];
    let insideCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (CODE_FENCE_RE.test(line)) {
        insideCodeBlock = !insideCodeBlock;
        // A fence line itself is never a section starter.
        continue;
      }

      if (insideCodeBlock) {
        continue;
      }

      const info = match(line);
      if (info !== null) {
        starters.push({ lineIndex: i, info });
      }
    }

    if (starters.length === 0) {
      return [];
    }

    const sections: ParsedSection[] = [];

    for (let s = 0; s < starters.length; s++) {
      const current = starters[s]!;
      const nextStarterLineIndex =
        s + 1 < starters.length ? starters[s + 1]!.lineIndex : totalLines; // one past the last line

      // endLine is the last line of this section (1-based, inclusive).
      // The section runs up to (but not including) the next starter.
      // We subtract 1 from nextStarterLineIndex to get the last included
      // 0-based index, then +1 to convert to 1-based.
      const endLine1Based = nextStarterLineIndex; // (nextStarterLineIndex - 1) + 1

      sections.push({
        heading: current.info.heading,
        startLine: current.lineIndex + 1,
        endLine: endLine1Based,
        level: current.info.level,
        orderIndex: s,
      });
    }

    return sections;
  }
}
