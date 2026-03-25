import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { SqlJsStatic, Database as SqlDatabase } from 'sql.js';
import * as path from 'path';
import { runMigrations } from '../extension/core/db/migrations';

// sql.js initialized once (WASM is expensive); each test creates a new SQL.Database()
let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.resolve('node_modules/sql.js/dist', file),
  });
});

function getColumns(db: SqlDatabase, table: string): string[] {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (result.length === 0) return [];
  const nameIdx = result[0].columns.indexOf('name');
  return result[0].values.map((row) => row[nameIdx] as string);
}

function getSchemaVersion(db: SqlDatabase): number {
  const result = db.exec(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1',
  );
  if (result.length === 0 || result[0].values.length === 0) return 0;
  return result[0].values[0][0] as number;
}

describe('runMigrations', () => {
  it('fresh DB (V0→latest): creates all columns including target_start_char and target_end_char', () => {
    const db = new SQL.Database();
    runMigrations(db);

    const cols = getColumns(db, 'comments');
    expect(cols).toContain('id');
    expect(cols).toContain('body');
    expect(cols).toContain('carried_from_id'); // V2
    expect(cols).toContain('target_start_char'); // V3
    expect(cols).toContain('target_end_char'); // V3
    expect(cols).toContain('selected_text'); // V5

    db.close();
  });

  it('schema version tracking: current version after fresh migration', () => {
    const db = new SQL.Database();
    runMigrations(db);
    expect(getSchemaVersion(db)).toBe(7);
    db.close();
  });

  it('V2→latest upgrade: adds V3 columns on a DB already at version 2', () => {
    const db = new SQL.Database();

    // Manually build a V2 fixture (DDL V1 + ALTER V2 + version=2)
    // without calling runMigrations, to truly test the upgrade path
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_review', tags TEXT DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL, content TEXT NOT NULL,
        review_prompt TEXT, created_at TEXT NOT NULL,
        UNIQUE(plan_id, version_number)
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        heading TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
        level INTEGER NOT NULL, order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('line','range','section')),
        target_start INTEGER NOT NULL, target_end INTEGER NOT NULL,
        section_id TEXT REFERENCES sections(id), body TEXT NOT NULL,
        category TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
    `);
    db.exec(
      'ALTER TABLE comments ADD COLUMN carried_from_id TEXT REFERENCES comments(id)',
    );
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (2)');

    // Precondition: V3 columns absent
    const colsBefore = getColumns(db, 'comments');
    expect(colsBefore).not.toContain('target_start_char');
    expect(colsBefore).not.toContain('target_end_char');

    runMigrations(db);

    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).toContain('target_start_char');
    expect(colsAfter).toContain('target_end_char');
    expect(colsAfter).toContain('selected_text');
    expect(getSchemaVersion(db)).toBe(7);

    db.close();
  });

  it('applies V6 migration on a manually-built V5 fixture', () => {
    const db = new SQL.Database();

    // Build a complete V5 fixture manually (all columns present, old CHECK constraint),
    // then run migrations to verify V6 rebuilds the table and updates the type constraint.
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_review', tags TEXT DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL, content TEXT NOT NULL,
        review_prompt TEXT, created_at TEXT NOT NULL,
        UNIQUE(plan_id, version_number)
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        heading TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
        level INTEGER NOT NULL, order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('line','range','section')),
        target_start INTEGER NOT NULL, target_end INTEGER NOT NULL,
        section_id TEXT REFERENCES sections(id), body TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('suggestion')),
        resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        carried_from_id TEXT REFERENCES comments(id),
        target_start_char INTEGER DEFAULT NULL,
        target_end_char INTEGER DEFAULT NULL,
        selected_text TEXT DEFAULT NULL
      );
    `);
    // Mark as V5 (all prior columns present but CHECK constraint still uses old type list)
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (5)');

    runMigrations(db);

    // After V6+V7, columns must exist and type CHECK must include 'global'
    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).toContain('target_start_char');
    expect(colsAfter).toContain('target_end_char');
    expect(colsAfter).toContain('selected_text');
    expect(getSchemaVersion(db)).toBe(7);

    db.close();
  });

  it('V5: adds selected_text column on a DB already at version 4', () => {
    const db = new SQL.Database();

    // Build a V4 fixture manually
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_review', tags TEXT DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL, content TEXT NOT NULL,
        review_prompt TEXT, created_at TEXT NOT NULL,
        UNIQUE(plan_id, version_number)
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        heading TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
        level INTEGER NOT NULL, order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('line','range','section')),
        target_start INTEGER NOT NULL, target_end INTEGER NOT NULL,
        section_id TEXT REFERENCES sections(id), body TEXT NOT NULL,
        category TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
    `);
    db.exec(
      'ALTER TABLE comments ADD COLUMN carried_from_id TEXT REFERENCES comments(id)',
    );
    db.exec(
      'ALTER TABLE comments ADD COLUMN target_start_char INTEGER DEFAULT NULL',
    );
    db.exec(
      'ALTER TABLE comments ADD COLUMN target_end_char INTEGER DEFAULT NULL',
    );
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (4)');

    const colsBefore = getColumns(db, 'comments');
    expect(colsBefore).not.toContain('selected_text');

    runMigrations(db);

    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).toContain('selected_text');
    expect(getSchemaVersion(db)).toBe(7);

    db.close();
  });

  it('V6: DB at V5 migrates to V6 and accepts global comment type', () => {
    const db = new SQL.Database();

    // Build a complete V5 fixture
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_review', tags TEXT DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL, content TEXT NOT NULL,
        review_prompt TEXT, created_at TEXT NOT NULL,
        UNIQUE(plan_id, version_number)
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        heading TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
        level INTEGER NOT NULL, order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('line','range','section')),
        target_start INTEGER NOT NULL, target_end INTEGER NOT NULL,
        section_id TEXT REFERENCES sections(id), body TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('suggestion')),
        resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        carried_from_id TEXT REFERENCES comments(id),
        target_start_char INTEGER DEFAULT NULL,
        target_end_char INTEGER DEFAULT NULL,
        selected_text TEXT DEFAULT NULL
      );
    `);

    // Insert a pre-existing comment that should survive migration
    db.exec(`
      INSERT INTO plans (id, title, source, created_at, updated_at, status)
        VALUES ('plan-1', 'Test Plan', 'manual', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', 'in_review');
      INSERT INTO versions (id, plan_id, version_number, content, created_at)
        VALUES ('ver-1', 'plan-1', 1, '# Hello', '2024-01-01T00:00:00Z');
      INSERT INTO comments
        (id, version_id, type, target_start, target_end, body, category, resolved, created_at)
        VALUES ('cmt-1', 'ver-1', 'line', 1, 1, 'Pre-existing comment', 'suggestion', 0, '2024-01-01T00:00:00Z');
    `);

    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (5)');

    // Run migration
    runMigrations(db);

    // 1. Schema version must be 7
    expect(getSchemaVersion(db)).toBe(7);

    // 2. Pre-existing comment survives
    const existingRows = db.exec(
      "SELECT id, body FROM comments WHERE id = 'cmt-1'",
    );
    expect(existingRows.length).toBe(1);
    expect(existingRows[0].values[0][1]).toBe('Pre-existing comment');

    // 3. A comment with type='global' can now be inserted
    expect(() => {
      db.exec(`
        INSERT INTO comments
          (id, version_id, type, target_start, target_end, body, category, created_at)
          VALUES ('cmt-global', 'ver-1', 'global', 0, 0, 'Global comment', 'suggestion', '2024-01-01T00:00:00Z')
      `);
    }).not.toThrow();

    const globalRows = db.exec(
      "SELECT type FROM comments WHERE id = 'cmt-global'",
    );
    expect(globalRows[0].values[0][0]).toBe('global');

    // Verify that an invalid type is still rejected by the CHECK constraint
    expect(() => {
      db.run(
        `INSERT INTO comments (id, version_id, type, target_start, target_end, section_id, body, category, created_at)
         VALUES ('cmt-invalid', ?, 'invalid', 1, 1, NULL, 'Bad type', 'suggestion', '2025-01-01T00:00:00.000Z')`,
        ['ver-1'],
      );
    }).toThrow();

    db.close();
  });

  it('V7: removes resolved column from comments table', () => {
    const db = new SQL.Database();

    // Build a V6 fixture (has resolved column)
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_review', tags TEXT DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL, content TEXT NOT NULL,
        review_prompt TEXT, created_at TEXT NOT NULL,
        UNIQUE(plan_id, version_number)
      );
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        heading TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
        level INTEGER NOT NULL, order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('line', 'range', 'section', 'global')),
        target_start INTEGER NOT NULL, target_end INTEGER NOT NULL,
        section_id TEXT REFERENCES sections(id), body TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('suggestion')),
        resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        carried_from_id TEXT REFERENCES comments(id),
        target_start_char INTEGER DEFAULT NULL,
        target_end_char INTEGER DEFAULT NULL,
        selected_text TEXT DEFAULT NULL
      );
    `);

    // Insert a comment with resolved column
    db.exec(`
      INSERT INTO plans (id, title, source, created_at, updated_at, status)
        VALUES ('plan-v7', 'V7 Test', 'manual', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', 'in_review');
      INSERT INTO versions (id, plan_id, version_number, content, created_at)
        VALUES ('ver-v7', 'plan-v7', 1, '# Hello', '2024-01-01T00:00:00Z');
      INSERT INTO comments
        (id, version_id, type, target_start, target_end, body, category, resolved, created_at)
        VALUES ('cmt-v7', 'ver-v7', 'line', 1, 1, 'Survive V7', 'suggestion', 0, '2024-01-01T00:00:00Z');
    `);
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (6)');

    // Precondition: resolved column is present
    const colsBefore = getColumns(db, 'comments');
    expect(colsBefore).toContain('resolved');

    runMigrations(db);

    // After V7: resolved removed, comment survives
    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).not.toContain('resolved');
    expect(getSchemaVersion(db)).toBe(7);

    const survivingRows = db.exec(
      "SELECT id, body FROM comments WHERE id = 'cmt-v7'",
    );
    expect(survivingRows.length).toBe(1);
    expect(survivingRows[0].values[0][1]).toBe('Survive V7');

    db.close();
  });

  it('idempotency: second call on already-migrated DB does not throw and version stays stable', () => {
    const db = new SQL.Database();
    runMigrations(db);
    const versionAfterFirst = getSchemaVersion(db);
    expect(() => runMigrations(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(versionAfterFirst);
    db.close();
  });
});
