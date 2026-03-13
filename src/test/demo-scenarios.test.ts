/**
 * Functional tests derived from docs/plan-reviewer-demo.html.
 *
 * The demo HTML is the canonical behavioural specification of the extension.
 * Each test in this file is directly traceable to an interaction or output
 * visible in the demo: the comments used, the plan content, and the expected
 * prompt output are all taken verbatim from the demo's JS data section.
 *
 * Covered surfaces:
 *   - PromptGenerator  (same_session + new_session modes, all 4 categories)
 *   - DiffEngine       (realistic plan content: headings, code blocks, lists)
 *   - CommentMapper    (plan-revision scenario using demo's 4 comments)
 */

import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../extension/services/DiffEngine';
import { CommentMapper } from '../extension/services/CommentMapper';
import { PromptGenerator } from '../shared/PromptGenerator';
import type { Comment, Section } from '../shared/models';

// ── Demo data (verbatim from demo HTML) ──────────────────────────────────────

/**
 * The exact plan text used in the demo (PLAN template literal, lines 1-48).
 * Line numbers below are 1-based and match the demo's comment anchors.
 *
 *  1  # Implementation Plan: User Authentication API
 *  2  (empty)
 *  3  ## Step 1: Database Setup
 *  4  Create a PostgreSQL database with the following schema…
 *  5  We need tables for users, sessions, and refresh tokens.
 *  6  (empty)
 *  7  ```sql
 *  8  CREATE TABLE users (
 *  9    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 * 10    email VARCHAR(255) UNIQUE NOT NULL,
 * 11    password_hash VARCHAR(255) NOT NULL,
 * 12    created_at TIMESTAMP DEFAULT NOW()
 * 13  );
 * 14  (empty)
 * 15  CREATE TABLE sessions (
 * 16    id UUID PRIMARY KEY,
 * 17    user_id UUID REFERENCES users(id),
 * 18    expires_at TIMESTAMP NOT NULL
 * 19  );
 * 20  ```
 * 21  (empty)
 * 22  ## Step 2: API Endpoints
 * 23  Implement RESTful endpoints using Express.js with TypeScript.
 * 24  All endpoints should return proper HTTP status codes.
 * 25  (empty)
 * 26  - POST /auth/register — Create new user account
 * 27  - POST /auth/login — Authenticate and return JWT
 * 28  - POST /auth/refresh — Refresh expired token
 * 29  - DELETE /auth/logout — Invalidate session
 * 30  (empty)
 * 31  ## Step 3: JWT Token Strategy
 * 32  Use RS256 algorithm with rotating key pairs.
 * 33  Access tokens expire in 15 minutes, refresh tokens in 7 days.
 * 34  Store refresh tokens in the database for revocation support.
 * 35  (empty)
 * 36  ## Step 4: Middleware & Guards
 * 37  …
 * 45  ## Step 6: Testing Strategy
 * 46  Write integration tests for all auth flows…
 * 47  Mock the database layer for unit tests.
 * 48  Include edge cases: expired tokens, invalid credentials, concurrent sessions.
 */
const DEMO_PLAN_V1 = [
  '# Implementation Plan: User Authentication API',
  '',
  '## Step 1: Database Setup',
  'Create a PostgreSQL database with the following schema for user management.',
  'We need tables for users, sessions, and refresh tokens.',
  '',
  '```sql',
  'CREATE TABLE users (',
  '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
  '  email VARCHAR(255) UNIQUE NOT NULL,',
  '  password_hash VARCHAR(255) NOT NULL,',
  '  created_at TIMESTAMP DEFAULT NOW()',
  ');',
  '',
  'CREATE TABLE sessions (',
  '  id UUID PRIMARY KEY,',
  '  user_id UUID REFERENCES users(id),',
  '  expires_at TIMESTAMP NOT NULL',
  ');',
  '```',
  '',
  '## Step 2: API Endpoints',
  'Implement RESTful endpoints using Express.js with TypeScript.',
  'All endpoints should return proper HTTP status codes.',
  '',
  '- POST /auth/register — Create new user account',
  '- POST /auth/login — Authenticate and return JWT',
  '- POST /auth/refresh — Refresh expired token',
  '- DELETE /auth/logout — Invalidate session',
  '',
  '## Step 3: JWT Token Strategy',
  'Use RS256 algorithm with rotating key pairs.',
  'Access tokens expire in 15 minutes, refresh tokens in 7 days.',
  'Store refresh tokens in the database for revocation support.',
  '',
  '## Step 4: Middleware & Guards',
  'Create authentication middleware that validates JWT on protected routes.',
  'Implement role-based access control (RBAC) with user roles stored in the JWT payload.',
  '',
  '## Step 5: Rate Limiting',
  'Apply rate limiting to auth endpoints to prevent brute force attacks.',
  'Use a sliding window algorithm with Redis as the backing store.',
  'Limit: 5 login attempts per minute per IP address.',
  '',
  '## Step 6: Testing Strategy',
  'Write integration tests for all auth flows using Jest and Supertest.',
  'Mock the database layer for unit tests.',
  'Include edge cases: expired tokens, invalid credentials, concurrent sessions.',
].join('\n');

/**
 * V2 of the plan: a `name` column is inserted after `email` in the users table
 * (after line 10 in v1 → becomes line 11 in v2).  Everything from the original
 * line 11 downward shifts by one.
 *
 * Expected mapping of demo comments:
 *   c1  line 4    → line 4  (unchanged above insertion point)  → probably_unresolved
 *   c4  line 1    → line 1  (title unchanged)                   → probably_unresolved
 *   c2  lines 25-28 → lines 26-29  (shifted by 1)              → probably_unresolved
 *   c3  line 31   → line 32 (shifted by 1)                     → probably_unresolved
 */
const DEMO_PLAN_V2 = DEMO_PLAN_V1.replace(
  '  email VARCHAR(255) UNIQUE NOT NULL,\n  password_hash',
  '  email VARCHAR(255) UNIQUE NOT NULL,\n  name VARCHAR(255),\n  password_hash',
);

// ── Demo comment helpers ──────────────────────────────────────────────────────

function makeDemoComment(overrides: Partial<Comment>): Comment {
  return {
    id: 'c-stub',
    versionId: 'v1',
    type: 'line',
    targetStart: 1,
    targetEnd: 1,
    sectionId: null,
    body: '',
    category: 'issue',
    resolved: false,
    createdAt: '2026-01-01T00:00:00Z',
    carriedFromId: null,
    ...overrides,
  };
}

// The four comments from the demo (line → targetStart/targetEnd)
const C1 = makeDemoComment({
  id: 'c1',
  targetStart: 4, targetEnd: 4,
  type: 'line', category: 'issue',
  body: "The database setup doesn't handle rollback on error. Add a transaction wrapper with try/catch and proper rollback mechanism.",
});
const C2 = makeDemoComment({
  id: 'c2',
  targetStart: 25, targetEnd: 28,
  type: 'range', category: 'suggestion',
  body: 'Consider using CQRS pattern instead of pure REST for write operations. This would separate command and query responsibilities.',
});
const C3 = makeDemoComment({
  id: 'c3',
  targetStart: 31, targetEnd: 31,
  type: 'line', category: 'question',
  body: 'Why RS256 instead of HS256? RS256 adds complexity with key rotation. Is this justified for the scale of this project?',
});
const C4 = makeDemoComment({
  id: 'c4',
  targetStart: 1, targetEnd: 1,
  type: 'line', category: 'approval',
  body: 'Good overall structure. The plan covers all the essential aspects of auth implementation.',
});

const ALL_DEMO_COMMENTS = [C1, C2, C3, C4];

// ── Instances ─────────────────────────────────────────────────────────────────

const engine = new DiffEngine();
const mapper = new CommentMapper();
const generator = new PromptGenerator();

// ─────────────────────────────────────────────────────────────────────────────
// 1. PromptGenerator — same_session mode
// ─────────────────────────────────────────────────────────────────────────────

describe('PromptGenerator — same_session (demo spec)', () => {
  const opts = {
    planTitle: 'User Authentication API',
    versionNumber: 1,
    versionContent: DEMO_PLAN_V1,
    sections: [] as Section[],
    mode: 'same_session' as const,
  };

  it('heading contains "Plan Review — Iteration 1"', () => {
    const result = generator.generate({ ...opts, comments: ALL_DEMO_COMMENTS });
    expect(result).toContain('## Plan Review — Iteration 1');
  });

  it('does NOT embed plan content (compact mode)', () => {
    const result = generator.generate({ ...opts, comments: ALL_DEMO_COMMENTS });
    expect(result).not.toContain('## Plan to Review');
    expect(result).not.toContain('CREATE TABLE users');
  });

  it('c1 issue body appears under Issues section', () => {
    const result = generator.generate({ ...opts, comments: [C1] });
    expect(result).toContain('### Issues (must fix)');
    expect(result).toContain("doesn't handle rollback");
  });

  it('c1 is referenced as [Line 4]', () => {
    const result = generator.generate({ ...opts, comments: [C1] });
    expect(result).toContain('[Line 4]');
  });

  it('c2 range comment appears under Suggestions section', () => {
    const result = generator.generate({ ...opts, comments: [C2] });
    expect(result).toContain('### Suggestions (recommended improvements)');
    expect(result).toContain('CQRS pattern');
  });

  it('c2 range is referenced as [Lines 25–28] with em-dash', () => {
    const result = generator.generate({ ...opts, comments: [C2] });
    expect(result).toContain('[Lines 25–28]');
  });

  it('c3 question appears under Questions section', () => {
    const result = generator.generate({ ...opts, comments: [C3] });
    expect(result).toContain('### Questions (clarification needed)');
    expect(result).toContain('Why RS256 instead of HS256');
  });

  it('c3 is referenced as [Line 31]', () => {
    const result = generator.generate({ ...opts, comments: [C3] });
    expect(result).toContain('[Line 31]');
  });

  it('c4 approval appears under Approved sections', () => {
    const result = generator.generate({ ...opts, comments: [C4] });
    expect(result).toContain('### Approved sections (keep as-is)');
    expect(result).toContain('Good overall structure');
  });

  it('category section order: Issues → Suggestions → Questions → Approvals', () => {
    const result = generator.generate({ ...opts, comments: ALL_DEMO_COMMENTS });
    const ix = (s: string) => result.indexOf(s);
    expect(ix('### Issues')).toBeLessThan(ix('### Suggestions'));
    expect(ix('### Suggestions')).toBeLessThan(ix('### Questions'));
    expect(ix('### Questions')).toBeLessThan(ix('### Approved'));
  });

  it('contains closing instructions with all four action items', () => {
    const result = generator.generate({ ...opts, comments: ALL_DEMO_COMMENTS });
    expect(result).toContain('Resolves all issues');
    expect(result).toContain('Applies the suggested improvements');
    expect(result).toContain('Addresses all clarification questions');
    expect(result).toContain('Preserves all approved sections');
  });

  it('section with sectionId matching a section uses heading reference', () => {
    const section: Section = {
      id: 's-step1',
      versionId: 'v1',
      heading: 'Step 1: Database Setup',
      startLine: 3,
      endLine: 20,
      level: 2,
      orderIndex: 0,
    };
    const commentWithSection = makeDemoComment({
      id: 'c-sec',
      sectionId: 's-step1',
      targetStart: 4,
      targetEnd: 4,
      category: 'issue',
      body: 'Missing transaction handling.',
    });
    const result = generator.generate({
      ...opts,
      comments: [commentWithSection],
      sections: [section],
    });
    expect(result).toContain('[Section "Step 1: Database Setup"]');
    expect(result).not.toContain('[Line 4]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PromptGenerator — new_session mode
// ─────────────────────────────────────────────────────────────────────────────

describe('PromptGenerator — new_session (demo spec)', () => {
  const opts = {
    planTitle: 'User Authentication API',
    versionNumber: 1,
    versionContent: DEMO_PLAN_V1,
    comments: ALL_DEMO_COMMENTS,
    sections: [] as Section[],
    mode: 'new_session' as const,
  };

  it('heading contains "Review Feedback — Iteration 1"', () => {
    const result = generator.generate(opts);
    expect(result).toContain('## Review Feedback — Iteration 1');
  });

  it('embeds plan content in a "Plan to Review" block', () => {
    const result = generator.generate(opts);
    expect(result).toContain('## Plan to Review');
    expect(result).toContain('**User Authentication API**');
    expect(result).toContain('CREATE TABLE users');
  });

  it('plan content block appears before feedback block', () => {
    const result = generator.generate(opts);
    expect(result.indexOf('## Plan to Review')).toBeLessThan(
      result.indexOf('## Review Feedback'),
    );
  });

  it('feedback section is separated from plan content by a horizontal rule', () => {
    const result = generator.generate(opts);
    const planEnd = result.indexOf('## Review Feedback');
    const separator = result.lastIndexOf('---', planEnd);
    expect(separator).toBeGreaterThan(0);
  });

  it('all four comment bodies are present', () => {
    const result = generator.generate(opts);
    for (const c of ALL_DEMO_COMMENTS) {
      expect(result).toContain(c.body.slice(0, 30));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DiffEngine — realistic plan content
// ─────────────────────────────────────────────────────────────────────────────

describe('DiffEngine — realistic plan content (demo plan v1 → v2)', () => {
  it('diff of identical plan versions produces only unchanged lines', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V1);
    expect(result.every((dl) => dl.type === 'unchanged')).toBe(true);
  });

  it('v1 → v2 (add name column): exactly one added line', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    const added = result.filter((dl) => dl.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].content).toContain('name VARCHAR(255)');
  });

  it('v1 → v2: no removed lines (pure insertion)', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    expect(result.filter((dl) => dl.type === 'removed')).toHaveLength(0);
  });

  it('v1 → v2: plan title (line 1) is unchanged at old=1, new=1', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    const title = result.find((dl) => dl.content.startsWith('# Implementation'));
    expect(title).toMatchObject({ type: 'unchanged', lineNumberOld: 1, lineNumberNew: 1 });
  });

  it('v1 → v2: SQL line at old line 11 shifts to new line 12', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    // "  password_hash" was at old line 11, should now be at new line 12
    const passwordHashLine = result.find(
      (dl) => dl.type === 'unchanged' && dl.content.includes('password_hash'),
    );
    expect(passwordHashLine).toBeDefined();
    expect(passwordHashLine!.lineNumberOld).toBe(11);
    expect(passwordHashLine!.lineNumberNew).toBe(12);
  });

  it('v1 → v2: "## Step 3" heading shifts from old line 31 to new line 32', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    const step3 = result.find(
      (dl) => dl.type === 'unchanged' && dl.content.includes('Step 3: JWT'),
    );
    expect(step3).toBeDefined();
    expect(step3!.lineNumberOld).toBe(31);
    expect(step3!.lineNumberNew).toBe(32);
  });

  it('markdown heading lines are unchanged across a schema-only edit', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);
    const headings = result.filter(
      (dl) => dl.type === 'unchanged' && dl.content.startsWith('## Step'),
    );
    // 6 step headings: Step 1–6
    expect(headings).toHaveLength(6);
  });

  it('empty lines between sections are preserved as unchanged', () => {
    const result = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V1);
    const emptyLines = result.filter((dl) => dl.content === '');
    expect(emptyLines.length).toBeGreaterThan(0);
    expect(emptyLines.every((dl) => dl.type === 'unchanged')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CommentMapper — plan revision scenario with demo comments
// ─────────────────────────────────────────────────────────────────────────────

describe('CommentMapper — demo plan v1 → v2 revision', () => {
  const diff = engine.compute(DEMO_PLAN_V1, DEMO_PLAN_V2);

  it('c4 (line 1, title approval) maps to line 1 unchanged', () => {
    const [result] = mapper.map([C4], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(1);
    expect(result.newTargetEnd).toBe(1);
  });

  it('c1 (line 4, issue on DB setup description) is unchanged — insertion was on line 10→11', () => {
    // The added column is after line 10. Line 4 is above the insertion point.
    const [result] = mapper.map([C1], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(4);
  });

  it('c2 (range 25–28, suggestion on API endpoints) shifts to 26–29', () => {
    // One line inserted at v2 position 11 pushes everything below it down by 1.
    const [result] = mapper.map([C2], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(26);
    expect(result.newTargetEnd).toBe(29);
  });

  it('c3 (line 31, question on JWT strategy heading) shifts to line 32', () => {
    const [result] = mapper.map([C3], diff);
    expect(result.status).toBe('probably_unresolved');
    expect(result.newTargetStart).toBe(32);
  });

  it('all four demo comments survive as probably_unresolved after schema insertion', () => {
    const results = mapper.map(ALL_DEMO_COMMENTS, diff);
    expect(results.every((r) => r.status === 'probably_unresolved')).toBe(true);
  });

  it('comment on the removed section heading → orphaned when that section is deleted', () => {
    // Simulate: Step 3 heading is deleted entirely in a drastic revision
    const v1 = 'Title\n\n## Step 3: JWT\nContent\n';
    const v2 = 'Title\n\nContent\n'; // heading removed, no adjacent add
    const localDiff = engine.compute(v1, v2);
    const commentOnHeading = makeDemoComment({ targetStart: 3, targetEnd: 3 });
    const [result] = mapper.map([commentOnHeading], localDiff);
    expect(result.status).toBe('orphaned');
    expect(result.newTargetStart).toBeNull();
  });

  it('comment on replaced content (e.g. HS256 → RS256 line rewrite) → probably_resolved', () => {
    // Simulate rewriting the RS256 justification line entirely
    const v1 = '## JWT\nUse RS256 algorithm with rotating key pairs.\nMore content\n';
    const v2 = '## JWT\nUse HS256 for simplicity — RS256 is overkill here.\nMore content\n';
    const localDiff = engine.compute(v1, v2);
    const commentOnLine = makeDemoComment({ targetStart: 2, targetEnd: 2 });
    const [result] = mapper.map([commentOnLine], localDiff);
    // Line was replaced (removed + added), so it is considered probably_resolved
    expect(result.status).toBe('probably_resolved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PromptGenerator — edge cases from demo interactions
// ─────────────────────────────────────────────────────────────────────────────

describe('PromptGenerator — edge cases (demo interactions)', () => {
  const baseOpts = {
    planTitle: 'Test Plan',
    versionNumber: 2,
    versionContent: DEMO_PLAN_V2,
    sections: [] as Section[],
  };

  it('version number in heading updates correctly for v2', () => {
    const result = generator.generate({ ...baseOpts, comments: [], mode: 'same_session' });
    expect(result).toContain('Iteration 2');
    expect(result).not.toContain('Iteration 1');
  });

  it('no comments → no category sections, only heading + closing', () => {
    const result = generator.generate({ ...baseOpts, comments: [], mode: 'same_session' });
    expect(result).not.toContain('### Issues');
    expect(result).not.toContain('### Suggestions');
    expect(result).not.toContain('### Questions');
    expect(result).not.toContain('### Approved');
    expect(result).toContain('Please generate an updated version');
  });

  it('only approvals → no Issues/Suggestions/Questions sections', () => {
    const result = generator.generate({ ...baseOpts, comments: [C4], mode: 'same_session' });
    expect(result).not.toContain('### Issues');
    expect(result).not.toContain('### Suggestions');
    expect(result).not.toContain('### Questions');
    expect(result).toContain('### Approved sections');
  });

  it('resolved comments are still included (resolution is tracked separately)', () => {
    // The demo does not filter out resolved comments from prompt generation;
    // the extension follows the same pattern — resolved flag does not suppress output.
    const resolvedIssue = makeDemoComment({
      id: 'c-resolved',
      category: 'issue',
      body: 'This was fixed already',
      resolved: true,
      targetStart: 5,
      targetEnd: 5,
    });
    const result = generator.generate({
      ...baseOpts,
      comments: [resolvedIssue],
      mode: 'same_session',
    });
    expect(result).toContain('This was fixed already');
  });

  it('multiple issues are all listed under the same Issues section', () => {
    const issue1 = makeDemoComment({ id: 'i1', category: 'issue', body: 'First issue', targetStart: 3, targetEnd: 3 });
    const issue2 = makeDemoComment({ id: 'i2', category: 'issue', body: 'Second issue', targetStart: 7, targetEnd: 7 });
    const result = generator.generate({
      ...baseOpts,
      comments: [issue1, issue2],
      mode: 'same_session',
    });
    // Only one Issues heading
    const count = (result.match(/### Issues/g) ?? []).length;
    expect(count).toBe(1);
    expect(result).toContain('First issue');
    expect(result).toContain('Second issue');
  });
});
