import type { Comment, Section } from './models';

export type PromptMode = 'same_session' | 'new_session';

export interface GenerateOptions {
  planTitle: string;
  versionNumber: number;
  versionContent: string;
  comments: Comment[];
  sections: Section[];
  mode: PromptMode;
}

function extractLines(content: string, start: number, end: number, maxLines = 8): string {
  const lines = content.split('\n');
  const slice = lines.slice(start - 1, end); // 1-based → 0-based
  const truncated = slice.length > maxLines;
  const visible = truncated ? slice.slice(0, maxLines) : slice;
  const quoted = visible.map((l) => `> ${l}`).join('\n');
  return truncated ? `${quoted}\n> ...` : quoted;
}

export class PromptGenerator {
  generate(opts: GenerateOptions): string {
    const { planTitle, versionNumber, versionContent, comments, sections, mode } = opts;

    const formatRef = (comment: Comment): string => {
      if (comment.sectionId !== null) {
        const section = sections.find((s) => s.id === comment.sectionId);
        if (section !== undefined) {
          return `[Section "${section.heading}"]`;
        }
      }
      if (comment.targetStart === comment.targetEnd) {
        return `[Line ${comment.targetStart}]`;
      }
      return `[Lines ${comment.targetStart}–${comment.targetEnd}]`;
    };

    const formatEntry = (comment: Comment): string => {
      const ref = formatRef(comment);
      const lines = versionContent.split('\n');
      const lineCount = lines.length;

      let start = comment.targetStart;
      let end = comment.targetEnd;

      if (comment.sectionId !== null) {
        const section = sections.find((s) => s.id === comment.sectionId);
        if (section) {
          start = section.startLine;
          end = section.endLine;
        }
      }

      const citation = (() => {
        if (comment.selectedText !== null && comment.selectedText.length > 0) {
          return `> ${comment.selectedText}`;
        }
        return start >= 1 && start <= lineCount
          ? extractLines(versionContent, start, Math.min(end, lineCount))
          : '';
      })();

      const parts = [`**${ref}**`];
      if (citation) parts.push(citation);
      parts.push(comment.body);
      return parts.join('\n\n');
    };

    const feedbackBody = comments.length > 0
      ? `### Suggestions\n\n${comments.map(formatEntry).join('\n\n')}`
      : '';

    const closingInstructions = [
      'Please generate an updated version of the plan that:',
      '1. Applies the suggested improvements where appropriate',
    ].join('\n');

    if (mode === 'same_session') {
      const heading = `## Plan Review — Iteration ${versionNumber}`;
      const intro = 'The plan has been reviewed. Here is the feedback to apply to the next version:';

      return [heading, '', intro, '', feedbackBody, '', closingInstructions].join('\n');
    }

    const heading = `## Review Feedback — Iteration ${versionNumber}`;
    const intro = 'The plan has been reviewed. Here is the feedback to apply to the next version:';

    return [
      `## Plan to Review`,
      '',
      `**${planTitle}**`,
      '',
      versionContent,
      '',
      '---',
      '',
      heading,
      '',
      intro,
      '',
      feedbackBody,
      '',
      closingInstructions,
    ].join('\n');
  }
}
