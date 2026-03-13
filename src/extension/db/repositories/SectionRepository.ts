import type { Database, Statement } from 'sql.js';
import type { Section } from '../../../shared/models';

// ---------------------------------------------------------------------------
// Helper — snake_case DB row -> camelCase Section
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

function rowToSection(row: Row): Section {
  return {
    id: String(row['id'] ?? ''),
    versionId: String(row['version_id'] ?? ''),
    heading: String(row['heading'] ?? ''),
    startLine: Number(row['start_line'] ?? 0),
    endLine: Number(row['end_line'] ?? 0),
    level: Number(row['level'] ?? 0),
    orderIndex: Number(row['order_index'] ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class SectionRepository {
  constructor(private readonly db: Database) {}

  insert(section: Section): void {
    const stmt = this.db.prepare(
      `INSERT INTO sections (id, version_id, heading, start_line, end_line, level, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      section.id,
      section.versionId,
      section.heading,
      section.startLine,
      section.endLine,
      section.level,
      section.orderIndex,
    ]);
    stmt.free();
  }

  insertMany(sections: Section[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO sections (id, version_id, heading, start_line, end_line, level, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const section of sections) {
      stmt.run([
        section.id,
        section.versionId,
        section.heading,
        section.startLine,
        section.endLine,
        section.level,
        section.orderIndex,
      ]);
    }
    stmt.free();
  }

  findByVersionId(versionId: string): Section[] {
    const stmt = this.db.prepare(
      'SELECT * FROM sections WHERE version_id = ? ORDER BY order_index ASC'
    );
    stmt.bind([versionId]);
    return collectRows(stmt).map(rowToSection);
  }

  findById(id: string): Section | null {
    const stmt = this.db.prepare('SELECT * FROM sections WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return rowToSection(row);
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM sections WHERE id = ?');
    stmt.run([id]);
    stmt.free();
  }

  deleteByVersionId(versionId: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM sections WHERE version_id = ?'
    );
    stmt.run([versionId]);
    stmt.free();
  }
}
