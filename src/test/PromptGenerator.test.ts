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
    createdAt: '2026-01-01T00:00:00Z',
    carriedFromId: null,
    targetStartChar: null,
    targetEndChar: null,
    selectedText: null,
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

// Multi-line content for citation tests (lines 1-10)
const multiLineContent = [
  '# Architecture',          // line 1
  '',                         // line 2
  'Layer one details here.',  // line 3
  'Layer two details here.',  // line 4
  'Consider refactoring.',    // line 5
  'Line six content.',        // line 6
  'Line seven content.',      // line 7
  'Line eight content.',      // line 8
  'Line nine content.',       // line 9
  'Line ten content.',        // line 10
].join('\n');

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

  describe('citation — blockquote of plan text', () => {
    it('reference appears in bold on its own line', () => {
      const comment = makeComment({ sectionId: null, targetStart: 5, targetEnd: 5 });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).toContain('**[Line 5]**');
    });

    it('line comment cites the exact line as blockquote', () => {
      const comment = makeComment({ sectionId: null, targetStart: 5, targetEnd: 5 });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).toContain('> Consider refactoring.');
    });

    it('range comment cites all lines in range as blockquote', () => {
      const comment = makeComment({ type: 'range', sectionId: null, targetStart: 3, targetEnd: 5 });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).toContain('> Layer one details here.');
      expect(result).toContain('> Layer two details here.');
      expect(result).toContain('> Consider refactoring.');
    });

    it('section comment cites section startLine..endLine', () => {
      const section = makeSection({ id: 's1', heading: 'Architecture', startLine: 1, endLine: 3 });
      const comment = makeComment({ sectionId: 's1', targetStart: 1, targetEnd: 1 });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        sections: [section],
        mode: 'same_session',
      });

      expect(result).toContain('> # Architecture');
      expect(result).toContain('> ');
      expect(result).toContain('> Layer one details here.');
    });

    it('range exceeding 8 lines is truncated with > ...', () => {
      const longContent = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join('\n');
      const comment = makeComment({ type: 'range', sectionId: null, targetStart: 1, targetEnd: 12 });
      const result = generator.generate({
        ...baseOpts,
        versionContent: longContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).toContain('> Line 8');
      expect(result).not.toContain('> Line 9');
      expect(result).toContain('> ...');
    });

    it('comment on out-of-range line has no citation', () => {
      const comment = makeComment({ sectionId: null, targetStart: 99, targetEnd: 99, body: 'out of range' });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).toContain('**[Line 99]**');
      expect(result).toContain('out of range');
      // No blockquote lines should appear right before the body
      const entryIdx = result.indexOf('**[Line 99]**');
      const bodyIdx = result.indexOf('out of range', entryIdx);
      const between = result.slice(entryIdx + '**[Line 99]**'.length, bodyIdx);
      expect(between).not.toContain('>');
    });

    it('multiple comments are separated by blank lines', () => {
      const c1 = makeComment({ id: 'c1', targetStart: 3, targetEnd: 3, body: 'First comment' });
      const c2 = makeComment({ id: 'c2', targetStart: 5, targetEnd: 5, body: 'Second comment' });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [c1, c2],
        mode: 'same_session',
      });

      const firstIdx = result.indexOf('First comment');
      const secondIdx = result.indexOf('Second comment');
      const between = result.slice(firstIdx + 'First comment'.length, secondIdx);
      expect(between).toContain('\n\n');
    });

    it('uses selectedText for citation when present', () => {
      const comment = makeComment({
        targetStart: 3, targetEnd: 5,
        selectedText: 'frammento selezionato',
      });
      const result = generator.generate({ ...baseOpts, versionContent: multiLineContent, comments: [comment], mode: 'same_session' });
      expect(result).toContain('> frammento selezionato');
      expect(result).not.toContain('> Layer one details here.');
    });

    it('falls back to full line when selectedText is null', () => {
      const comment = makeComment({ targetStart: 3, targetEnd: 3, selectedText: null });
      const result = generator.generate({ ...baseOpts, versionContent: multiLineContent, comments: [comment], mode: 'same_session' });
      expect(result).toContain('> Layer one details here.');
    });

    it('no category label appears in output', () => {
      const comment = makeComment({ category: 'suggestion', targetStart: 3, targetEnd: 3, body: 'Some feedback' });
      const result = generator.generate({
        ...baseOpts,
        versionContent: multiLineContent,
        comments: [comment],
        mode: 'same_session',
      });

      expect(result).not.toContain('suggestion');
    });
  });
});
