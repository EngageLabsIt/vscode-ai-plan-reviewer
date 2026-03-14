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

    const feedbackBody = comments.length > 0
      ? `### Suggestions\n\n${comments.map((c) => `- ${formatRef(c)}: ${c.body}`).join('\n')}`
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
