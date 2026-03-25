import type { Database } from 'sql.js';
import type { Comment } from '../../../../shared/models';
import { collectRows, buildUpdateClause, type Row } from '../dbUtils';

// ---------------------------------------------------------------------------
// Helper — snake_case DB row -> camelCase Comment
// ---------------------------------------------------------------------------

function rowToComment(row: Row): Comment {
  return {
    id: String(row['id'] ?? ''),
    versionId: String(row['version_id'] ?? ''),
    type: (row['type'] as Comment['type']) ?? 'line',
    targetStart: Number(row['target_start'] ?? 0),
    targetEnd: Number(row['target_end'] ?? 0),
    sectionId: typeof row['section_id'] === 'string' ? row['section_id'] : null,
    body: String(row['body'] ?? ''),
    category: (row['category'] as Comment['category']) ?? 'suggestion',
    createdAt: String(row['created_at'] ?? ''),
    carriedFromId:
      typeof row['carried_from_id'] === 'string'
        ? row['carried_from_id']
        : null,
    targetStartChar:
      typeof row['target_start_char'] === 'number'
        ? row['target_start_char']
        : null,
    targetEndChar:
      typeof row['target_end_char'] === 'number'
        ? row['target_end_char']
        : null,
    selectedText:
      typeof row['selected_text'] === 'string' ? row['selected_text'] : null,
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
         (id, version_id, type, target_start, target_end, section_id, body, category, created_at, carried_from_id, target_start_char, target_end_char, selected_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      comment.createdAt,
      comment.carriedFromId,
      comment.targetStartChar ?? null,
      comment.targetEndChar ?? null,
      comment.selectedText ?? null,
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
      'SELECT * FROM comments WHERE version_id = ? ORDER BY target_start ASC',
    );
    stmt.bind([versionId]);
    return collectRows(stmt).map(rowToComment);
  }

  update(
    id: string,
    updates: Partial<Pick<Comment, 'body' | 'category'>>,
  ): void {
    const pairs: Array<[string, string | number | null]> = [];
    if (updates.body !== undefined) pairs.push(['body', updates.body]);
    if (updates.category !== undefined)
      pairs.push(['category', updates.category]);

    if (pairs.length === 0) return;

    const { setClause, params } = buildUpdateClause(pairs);
    params.push(id);
    const stmt = this.db.prepare(
      `UPDATE comments SET ${setClause} WHERE id = ?`,
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
    const stmt = this.db.prepare('DELETE FROM comments WHERE version_id = ?');
    stmt.run([versionId]);
    stmt.free();
  }

  countByPlanId(planId: string): number {
    const stmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM comments c
       JOIN versions v ON c.version_id = v.id
       WHERE v.plan_id = ?`,
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
