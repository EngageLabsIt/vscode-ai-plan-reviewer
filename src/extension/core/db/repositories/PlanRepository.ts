import type { Database } from 'sql.js';
import type { Plan, Version } from '../../../../shared/models';
import { collectRows, buildUpdateClause, type Row } from '../dbUtils';

// ---------------------------------------------------------------------------
// Helpers — snake_case DB rows -> camelCase model objects
// ---------------------------------------------------------------------------

function rowToPlan(row: Row): Plan {
  const tagsRaw = row['tags'];
  let tags: string[] = [];
  if (typeof tagsRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(tagsRaw);
      if (Array.isArray(parsed)) {
        tags = parsed as string[];
      }
    } catch {
      tags = [];
    }
  }

  return {
    id: String(row['id'] ?? ''),
    title: String(row['title'] ?? ''),
    source: (row['source'] as Plan['source']) ?? 'manual',
    createdAt: String(row['created_at'] ?? ''),
    updatedAt: String(row['updated_at'] ?? ''),
    status: (row['status'] as Plan['status']) ?? 'in_review',
    tags,
  };
}

function rowToVersion(row: Row): Version {
  const reviewPrompt = row['review_prompt'];
  return {
    id: String(row['id'] ?? ''),
    planId: String(row['plan_id'] ?? ''),
    versionNumber: Number(row['version_number'] ?? 0),
    content: String(row['content'] ?? ''),
    reviewPrompt: typeof reviewPrompt === 'string' ? reviewPrompt : null,
    createdAt: String(row['created_at'] ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PlanRepository {
  constructor(private readonly db: Database) {}

  // -- Plans ------------------------------------------------------------------

  insert(plan: Plan): void {
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, source, created_at, updated_at, status, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      plan.id,
      plan.title,
      plan.source,
      plan.createdAt,
      plan.updatedAt,
      plan.status,
      JSON.stringify(plan.tags),
    ]);
    stmt.free();
  }

  findById(id: string): Plan | null {
    const stmt = this.db.prepare('SELECT * FROM plans WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return rowToPlan(row);
  }

  findAll(): Plan[] {
    const stmt = this.db.prepare(
      'SELECT * FROM plans ORDER BY created_at DESC'
    );
    const rows = collectRows(stmt);
    return rows.map(rowToPlan);
  }

  update(
    id: string,
    updates: Partial<Pick<Plan, 'title' | 'status' | 'tags' | 'updatedAt'>>
  ): void {
    const pairs: Array<[string, string | number | null]> = [];
    if (updates.title !== undefined)     pairs.push(['title',      updates.title]);
    if (updates.status !== undefined)    pairs.push(['status',     updates.status]);
    if (updates.tags !== undefined)      pairs.push(['tags',       JSON.stringify(updates.tags)]);
    if (updates.updatedAt !== undefined) pairs.push(['updated_at', updates.updatedAt]);

    if (pairs.length === 0) return;

    const { setClause, params } = buildUpdateClause(pairs);
    params.push(id);
    const stmt = this.db.prepare(`UPDATE plans SET ${setClause} WHERE id = ?`);
    stmt.run(params);
    stmt.free();
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM plans WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }

  search(term: string): Plan[] {
    const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const stmt = this.db.prepare(
      "SELECT * FROM plans WHERE title LIKE ? ESCAPE '\\' ORDER BY created_at DESC"
    );
    stmt.bind([`%${escaped}%`]);
    const rows = collectRows(stmt);
    return rows.map(rowToPlan);
  }

  // -- Versions ---------------------------------------------------------------

  insertVersion(version: Version): void {
    const stmt = this.db.prepare(
      `INSERT INTO versions (id, plan_id, version_number, content, review_prompt, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      version.id,
      version.planId,
      version.versionNumber,
      version.content,
      version.reviewPrompt,
      version.createdAt,
    ]);
    stmt.free();
  }

  findVersionById(id: string): Version | null {
    const stmt = this.db.prepare('SELECT * FROM versions WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return rowToVersion(row);
  }

  findVersionsByPlanId(planId: string): Version[] {
    const stmt = this.db.prepare(
      'SELECT * FROM versions WHERE plan_id = ? ORDER BY version_number ASC'
    );
    stmt.bind([planId]);
    const rows = collectRows(stmt);
    return rows.map(rowToVersion);
  }

  findLatestVersion(planId: string): Version | null {
    const stmt = this.db.prepare(
      'SELECT * FROM versions WHERE plan_id = ? ORDER BY version_number DESC LIMIT 1'
    );
    stmt.bind([planId]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return rowToVersion(row);
  }

  updateVersionReviewPrompt(versionId: string, prompt: string): void {
    const stmt = this.db.prepare('UPDATE versions SET review_prompt = ? WHERE id = ?');
    stmt.run([prompt, versionId]);
    stmt.free();
  }
}
