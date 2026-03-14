import { describe, it, expect } from 'vitest';
import { PromptGenerator } from '../shared/PromptGenerator';
import type { Comment, Section } from '../shared/models';

const generator = new PromptGenerator();

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    versionId: 'v1',
    type: 'line',
    targetStart: 5,
    targetEnd: 5,
    sectionId: null,
    body: 'Default comment body',
    category: 'suggestion',
    resolved: false,
    createdAt: '2026-01-01T00:00:00Z',
    carriedFromId: null,
    targetStartChar: null,
    targetEndChar: null,
    ...overrides,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 's1',
    versionId: 'v1',
    heading: 'Overview',
    startLine: 1,
    endLine: 10,
    level: 2,
    orderIndex: 0,
    ...overrides,
  };
}

const baseOpts = {
  planTitle: 'Test Plan',
  versionNumber: 1,
  versionContent: '# Test Plan\n\nContent here.',
  comments: [],
  sections: [],
};

describe('PromptGenerator', () => {
  describe('same_session mode', () => {
    it('contains correct heading with version number', () => {
      const result = generator.generate({ ...baseOpts, mode: 'same_session' });
      expect(result).toContain('## Plan Review — Iteration 1');
    });

    it('does NOT include plan content in same_session mode', () => {
      const result = generator.generate({ ...baseOpts, mode: 'same_session' });
      expect(result).not.toContain('## Plan to Review');
      expect(result).not.toContain('# Test Plan');
    });

    it('contains closing instructions', () => {
      const result = generator.generate({ ...baseOpts, mode: 'same_session' });
      expect(result).toContain('Please generate an updated version of the plan');
      expect(result).toContain('Applies the suggested improvements');
    });
  });

  describe('new_session mode', () => {
    it('includes plan content section', () => {
      const result = generator.generate({ ...baseOpts, mode: 'new_session' });
      expect(result).toContain('## Plan to Review');
      expect(result).toContain('**Test Plan**');
      expect(result).toContain('Content here.');
    });

    it('contains correct heading with version number', () => {
      const result = generator.generate({ ...baseOpts, mode: 'new_session' });
      expect(result).toContain('## Review Feedback — Iteration 1');
    });

    it('plan content appears before feedback section', () => {
      const comment = makeComment({ body: 'Fix this' });
      const result = generator.generate({ ...baseOpts, comments: [comment], mode: 'new_session' });

      const planIdx = result.indexOf('## Plan to Review');
      const feedbackIdx = result.indexOf('## Review Feedback');
      expect(planIdx).toBeLessThan(feedbackIdx);
    });
  });

  describe('suggestions list', () => {
    it('suggestions appear under Suggestions section', () => {
      const comment = makeComment({ body: 'Consider refactoring' });
      const result = generator.generate({ ...baseOpts, comments: [comment], mode: 'same_session' });

      expect(result).toContain('### Suggestions');
      expect(result).toContain('Consider refactoring');
    });

    it('no comments → no Suggestions section present', () => {
      const result = generator.generate({ ...baseOpts, comments: [], mode: 'same_session' });
      expect(result).not.toContain('### Suggestions');
    });
  });

  describe('formatRef — reference formatting', () => {
    it('comment with matching sectionId shows section heading', () => {
      const section = makeSection({ id: 's-overview', heading: 'Architecture' });
      const comment = makeComment({ sectionId: 's-overview', targetStart: 5, targetEnd: 5 });
      const result = generator.generate({
        ...baseOpts,
        comments: [comment],
        sections: [section],
        mode: 'same_session',
      });

      expect(result).toContain('[Section "Architecture"]');
    });

    it('single-line comment with no section shows [Line N]', () => {
      const comment = makeComment({ sectionId: null, targetStart: 7, targetEnd: 7 });
      const result = generator.generate({ ...baseOpts, comments: [comment], mode: 'same_session' });

      expect(result).toContain('[Line 7]');
    });

    it('range comment with no section shows [Lines N–M]', () => {
      const comment = makeComment({ type: 'range', sectionId: null, targetStart: 3, targetEnd: 8 });
      const result = generator.generate({ ...baseOpts, comments: [comment], mode: 'same_session' });

      expect(result).toContain('[Lines 3–8]');
    });

    it('comment with sectionId that does not match any section falls back to line ref', () => {
      const comment = makeComment({ sectionId: 'non-existent', targetStart: 4, targetEnd: 4 });
      const result = generator.generate({
        ...baseOpts,
        comments: [comment],
        sections: [],
        mode: 'same_session',
      });

      expect(result).toContain('[Line 4]');
      expect(result).not.toContain('[Section');
    });
  });
});
