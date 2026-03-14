import type { Database } from 'sql.js';

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_review',
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  review_prompt TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(plan_id, version_number)
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  level INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('line', 'range', 'section')),
  target_start INTEGER NOT NULL,
  target_end INTEGER NOT NULL,
  section_id TEXT REFERENCES sections(id),
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('suggestion', 'issue', 'question', 'approval')),
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_plan ON versions(plan_id, version_number);
CREATE INDEX IF NOT EXISTS idx_comments_version ON comments(version_id);
CREATE INDEX IF NOT EXISTS idx_sections_version ON sections(version_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(version_id, resolved);
`;

const SCHEMA_V2 = `
ALTER TABLE comments ADD COLUMN carried_from_id TEXT REFERENCES comments(id);
`;


function getColumnNames(db: Database, table: string): string[] {
  const results = db.exec(`PRAGMA table_info(${table})`);
  if (results.length === 0) return [];
  return results[0].values.map((row) => String(row[1]));
}

function getCurrentVersion(db: Database): number {
  // schema_version table might not exist yet; guard with exec
  try {
    const results = db.exec(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    if (results.length === 0 || results[0].values.length === 0) {
      return 0;
    }
    const value = results[0].values[0][0];
    return typeof value === 'number' ? value : 0;
  } catch {
    return 0;
  }
}

export function runMigrations(db: Database): void {
  // Ensure schema_version table exists before querying it
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)'
  );

  const currentVersion = getCurrentVersion(db);

  if (currentVersion < 1) {
    db.exec(SCHEMA_V1);
    const stmt = db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)');
    stmt.run([1]);
    stmt.free();
  }

  if (currentVersion < 2) {
    db.exec(SCHEMA_V2);
    const stmt = db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)');
    stmt.run([2]);
    stmt.free();
  }

  if (currentVersion < 3) {
    const cols = getColumnNames(db, 'comments');
    if (!cols.includes('target_start_char')) {
      db.exec('ALTER TABLE comments ADD COLUMN target_start_char INTEGER DEFAULT NULL');
    }
    if (!cols.includes('target_end_char')) {
      db.exec('ALTER TABLE comments ADD COLUMN target_end_char INTEGER DEFAULT NULL');
    }
    const stmt = db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)');
    stmt.run([3]);
    stmt.free();
  }

  if (currentVersion < 4) {
    // Normalize all existing comments to 'suggestion' category
    db.exec("UPDATE comments SET category = 'suggestion' WHERE category != 'suggestion'");
    const stmt = db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)');
    stmt.run([4]);
    stmt.free();
  }

  if (currentVersion < 5) {
    const cols = getColumnNames(db, 'comments');
    if (!cols.includes('selected_text')) {
      db.exec('ALTER TABLE comments ADD COLUMN selected_text TEXT DEFAULT NULL');
    }
    const stmt = db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)');
    stmt.run([5]);
    stmt.free();
  }

  // Repair: fix databases where V3 migration ran but columns are missing
  // (caused by the old try/catch swallowing ALTER TABLE errors)
  const repairCols = getColumnNames(db, 'comments');
  if (!repairCols.includes('target_start_char')) {
    db.exec('ALTER TABLE comments ADD COLUMN target_start_char INTEGER DEFAULT NULL');
  }
  if (!repairCols.includes('target_end_char')) {
    db.exec('ALTER TABLE comments ADD COLUMN target_end_char INTEGER DEFAULT NULL');
  }
  if (!repairCols.includes('selected_text')) {
    db.exec('ALTER TABLE comments ADD COLUMN selected_text TEXT DEFAULT NULL');
  }
}
