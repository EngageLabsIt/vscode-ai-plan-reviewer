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

export class PromptGenerator {
  generate(opts: GenerateOptions): string {
    const { planTitle, versionNumber, versionContent, comments, sections, mode } = opts;

    const issues = comments.filter((c) => c.category === 'issue');
    const suggestions = comments.filter((c) => c.category === 'suggestion');
    const questions = comments.filter((c) => c.category === 'question');
    const approvals = comments.filter((c) => c.category === 'approval');

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

    const formatCommentList = (items: Comment[]): string =>
      items.map((c) => `- ${formatRef(c)}: ${c.body}`).join('\n');

    const feedbackParts: string[] = [];

    if (issues.length > 0) {
      feedbackParts.push(`### Issues (must fix)\n\n${formatCommentList(issues)}`);
    }

    if (suggestions.length > 0) {
      feedbackParts.push(`### Suggestions (recommended improvements)\n\n${formatCommentList(suggestions)}`);
    }

    if (questions.length > 0) {
      feedbackParts.push(`### Questions (clarification needed)\n\n${formatCommentList(questions)}`);
    }

    if (approvals.length > 0) {
      feedbackParts.push(`### Approved sections (keep as-is)\n\n${formatCommentList(approvals)}`);
    }

    const feedbackBody = feedbackParts.join('\n\n');

    const closingInstructions = [
      'Please generate an updated version of the plan that:',
      '1. Resolves all issues',
      '2. Applies the suggested improvements where appropriate',
      '3. Addresses all clarification questions',
      '4. Preserves all approved sections unchanged',
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
