import type { Database, Statement } from 'sql.js';
import type { Comment } from '../../../shared/models';

// ---------------------------------------------------------------------------
// Helper — snake_case DB row -> camelCase Comment
// ---------------------------------------------------------------------------

type Row = Record<string, number | string | Uint8Array | null>;

function collectRows(stmt: Statement): Row[] {
  const rows: Row[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function rowToComment(row: Row): Comment {
  return {
    id: String(row['id'] ?? ''),
    versionId: String(row['version_id'] ?? ''),
    type: (row['type'] as Comment['type']) ?? 'line',
    targetStart: Number(row['target_start'] ?? 0),
    targetEnd: Number(row['target_end'] ?? 0),
    sectionId:
      typeof row['section_id'] === 'string' ? row['section_id'] : null,
    body: String(row['body'] ?? ''),
    category: (row['category'] as Comment['category']) ?? 'suggestion',
    resolved: row['resolved'] === 1,
    createdAt: String(row['created_at'] ?? ''),
    carriedFromId:
      typeof row['carried_from_id'] === 'string' ? row['carried_from_id'] : null,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CommentRepository {
  constructor(private readonly db: Database) {}

  insert(comment: Comment): void {
    const stmt = this.db.prepare(
      `INSERT INTO comments
         (id, version_id, type, target_start, target_end, section_id, body, category, resolved, created_at, carried_from_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      comment.id,
      comment.versionId,
      comment.type,
      comment.targetStart,
      comment.targetEnd,
      comment.sectionId,
      comment.body,
      comment.category,
      comment.resolved ? 1 : 0,
      comment.createdAt,
      comment.carriedFromId,
    ]);
    stmt.free();
  }

  findById(id: string): Comment | null {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return rowToComment(row);
  }

  findByVersionId(versionId: string): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments WHERE version_id = ? ORDER BY target_start ASC'
    );
    stmt.bind([versionId]);
    return collectRows(stmt).map(rowToComment);
  }

  findUnresolvedByVersionId(versionId: string): Comment[] {
    const stmt = this.db.prepare(
      'SELECT * FROM comments WHERE version_id = ? AND resolved = 0 ORDER BY target_start ASC'
    );
    stmt.bind([versionId]);
    return collectRows(stmt).map(rowToComment);
  }

  update(
    id: string,
    updates: Partial<Pick<Comment, 'body' | 'category' | 'resolved'>>
  ): void {
    const setClauses: string[] = [];
    const params: Array<string | number | null> = [];

    if (updates.body !== undefined) {
      setClauses.push('body = ?');
      params.push(updates.body);
    }
    if (updates.category !== undefined) {
      setClauses.push('category = ?');
      params.push(updates.category);
    }
    if (updates.resolved !== undefined) {
      setClauses.push('resolved = ?');
      params.push(updates.resolved ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return;
    }

    params.push(id);
    const stmt = this.db.prepare(
      `UPDATE comments SET ${setClauses.join(', ')} WHERE id = ?`
    );
    stmt.run(params);
    stmt.free();
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM comments WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }

  deleteByVersionId(versionId: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM comments WHERE version_id = ?'
    );
    stmt.run([versionId]);
    stmt.free();
  }

  countOpenByPlanId(planId: string): number {
    const stmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM comments c
       JOIN versions v ON c.version_id = v.id
       WHERE v.plan_id = ? AND c.resolved = 0`
    );
    stmt.bind([planId]);
    let count = 0;
    if (stmt.step()) {
      const val = stmt.getAsObject()['cnt'];
      count = typeof val === 'number' ? val : 0;
    }
    stmt.free();
    return count;
  }
}
