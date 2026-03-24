import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import type { RenderedLine } from '../../../shared/models';

// ---------------------------------------------------------------------------
// markdown-it instance for inline rendering
// ---------------------------------------------------------------------------

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

// ---------------------------------------------------------------------------
// splitHighlightedLines
// Splits hljs HTML output into per-line strings, preserving open <span> tags
// across line boundaries so each line renders with correct highlighting.
// Mirrors the same logic previously in CodeBlock.tsx.
// ---------------------------------------------------------------------------

const TAG_REGEX = /<(\/?)span([^>]*)>/g;

function splitHighlightedLines(html: string): string[] {
  const rawLines = html.split('\n');
  const result: string[] = [];
  let openTags: string[] = [];

  for (const line of rawLines) {
    const lineContent = openTags.join('') + line;
    const currentTags = [...openTags];
    let match: RegExpExecArray | null;

    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(line)) !== null) {
      if (match[1] === '/') {
        currentTags.pop();
      } else {
        currentTags.push(`<span${match[2]}>`);
      }
    }

    result.push(lineContent + '</span>'.repeat(currentTags.length));
    openTags = currentTags;
  }

  return result;
}

// ---------------------------------------------------------------------------
// renderTextLine — inline renderer with list-item detection
// ---------------------------------------------------------------------------

function renderTextLine(line: string): string {
  if (!line.trim()) return '';

  // Detect list item: optional indentation + marker (-, *, +, N., N)) + content
  const listMatch = line.match(/^(\s*)([-*+]|\d+[.)]) (.*)$/);
  if (listMatch) {
    const indent = listMatch[1].length;
    const marker = listMatch[2];
    const content = listMatch[3];
    const depth = Math.floor(indent / 2);
    const isOrdered = /^\d+[.)]$/.test(marker);
    const renderedContent = md.renderInline(content);
    const bulletHtml = isOrdered
      ? `<span class="md-list-marker">${marker}</span>`
      : `<span class="md-list-marker">\u2022</span>`;
    return `<span class="md-list-item md-list-item--depth-${depth}">${bulletHtml} ${renderedContent}</span>`;
  }

  return md.renderInline(line);
}

// ---------------------------------------------------------------------------
// renderLines — main export
// Parses markdown content line-by-line into RenderedLine entries.
// Code fences are syntax-highlighted with highlight.js server-side.
// Text lines are rendered with markdown-it inline rules.
// ---------------------------------------------------------------------------

export function renderLines(content: string): RenderedLine[] {
  const rawLines = content.split('\n');
  const entries: RenderedLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*(\w*)/);

    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2] ?? '';
      const startLine = i + 1; // 1-based line number of the opening fence line
      const codeLines: string[] = [];
      i++; // skip opening fence line

      while (i < rawLines.length) {
        const codeLine = rawLines[i];
        if (codeLine.match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`))) {
          i++; // skip closing fence line
          break;
        }
        codeLines.push(codeLine);
        i++;
      }

      const code = codeLines.join('\n');
      let highlighted: string;
      try {
        const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
        highlighted = result.value;
      } catch {
        highlighted = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      entries.push({ kind: 'code', startLine, lineHtmls: splitHighlightedLines(highlighted) });
    } else {
      const lineNumber = i + 1; // 1-based
      const html = renderTextLine(line);
      entries.push({ kind: 'text', lineNumber, html });
      i++;
    }
  }

  return entries;
}
