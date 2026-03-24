import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../extension/core/services/DiffEngine';
import { CommentMapper } from '../extension/core/services/CommentMapper';
import type { Comment } from '../shared/models';

const engine = new DiffEngine();
const mapper = new CommentMapper();

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    versionId: 'v1',
    type: 'line',
    targetStart: 1,
    targetEnd: 1,
    sectionId: null,
    body: 'Test comment',
    category: 'suggestion',
    createdAt: '2026-01-01T00:00:00Z',
    carriedFromId: null,
    targetStartChar: null,
    targetEndChar: null,
    ...overrides,
  };
}

describe('CommentMapper', () => {
  it('returns empty array when no comments provided', () => {
    const diff = engine.compute('a\nb\n', 'a\nb\n');
    const result = mapper.map([], diff);
    expect(result).toHaveLength(0);
  });

  it('comment on unchanged line → probably_unresolved with mapped line number', () => {
    // 'a' stays at line 1, 'b' stays at line 2
    const diff = engine.compute('a\nb\nc\n', 'a\nb\nc\n');
    const comment = makeComment({ targetStart: 2, targetEnd: 2 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(2);
    expect(result.newTargetEnd).toBe(2);
  });

  it('comment on removed line adjacent to addition → probably_resolved', () => {
    // old: a, b, c  →  new: a, REPLACED, c
    // line 2 ('b') removed and immediately replaced by 'REPLACED'
    const diff = engine.compute('a\nb\nc\n', 'a\nREPLACED\nc\n');
    const comment = makeComment({ targetStart: 2, targetEnd: 2 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('probably_resolved');
    expect(result.newTargetStart).not.toBeNull();
  });

  it('comment on purely deleted line → orphaned with null positions', () => {
    // old: a, b, c  →  new: a, c  (b deleted, nothing inserted)
    const diff = engine.compute('a\nb\nc\n', 'a\nc\n');
    const comment = makeComment({ targetStart: 2, targetEnd: 2 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('orphaned');
    expect(result.newTargetStart).toBeNull();
    expect(result.newTargetEnd).toBeNull();
  });

  it('comment at end of file with trailing deletion → orphaned', () => {
    // old: a, b, c  →  new: a, b  (c deleted at end, no following addition)
    const diff = engine.compute('a\nb\nc\n', 'a\nb\n');
    const comment = makeComment({ targetStart: 3, targetEnd: 3 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('orphaned');
    expect(result.newTargetStart).toBeNull();
  });

  it('comment on line that shifts due to insertion above → probably_unresolved at new position', () => {
    // old: a, b  →  new: INSERTED, a, b
    // 'b' was line 2, now line 3
    const diff = engine.compute('a\nb\n', 'INSERTED\na\nb\n');
    const comment = makeComment({ targetStart: 2, targetEnd: 2 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(3);
  });

  it('range comment spanning unchanged lines → probably_unresolved with both ends mapped', () => {
    const diff = engine.compute('a\nb\nc\nd\n', 'a\nb\nc\nd\n');
    const comment = makeComment({ type: 'range', targetStart: 2, targetEnd: 4 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(2);
    expect(result.newTargetEnd).toBe(4);
  });

  it('maps multiple comments independently in the same diff', () => {
    // old: a, b, c, d  →  new: a, NEW, c, d  (b removed + NEW added, c and d shift)
    const diff = engine.compute('a\nb\nc\nd\n', 'a\nNEW\nc\nd\n');

    const commentOnB = makeComment({ id: 'c-b', targetStart: 2, targetEnd: 2 });   // removed → resolved
    const commentOnC = makeComment({ id: 'c-c', targetStart: 3, targetEnd: 3 });   // unchanged at 3→3
    const commentOnD = makeComment({ id: 'c-d', targetStart: 4, targetEnd: 4 });   // unchanged at 4→4

    const results = mapper.map([commentOnB, commentOnC, commentOnD], diff);
    expect(results[0].status).toBe('probably_resolved');
    expect(results[1].status).toBe('probably_unresolved');
    expect(results[1].newTargetStart).toBe(3);
    expect(results[2].status).toBe('probably_unresolved');
    expect(results[2].newTargetStart).toBe(4);
  });

  it('preserves the original comment object inside MappedComment', () => {
    const diff = engine.compute('a\nb\n', 'a\nb\n');
    const comment = makeComment({ id: 'original-id', body: 'keep this' });

    const [result] = mapper.map([comment], diff);
    expect(result.comment).toBe(comment);
  });

  it('range comment where insertion above shifts both start and end', () => {
    // old: a, b, c, d  →  new: INSERTED, a, b, c, d
    // range comment spanning lines 2–3 (b–c) should shift to 3–4
    const diff = engine.compute('a\nb\nc\nd\n', 'INSERTED\na\nb\nc\nd\n');
    const comment = makeComment({ type: 'range', targetStart: 2, targetEnd: 3 });

    const [result] = mapper.map([comment], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(3);
    expect(result.newTargetEnd).toBe(4);
  });
});
