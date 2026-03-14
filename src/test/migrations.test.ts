import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { SqlJsStatic, Database as SqlDatabase } from 'sql.js';
import * as path from 'path';
import { runMigrations } from '../extension/db/migrations';

// sql.js inizializzato una volta (WASM costoso); ogni test crea new SQL.Database()
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
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  if (result.length === 0 || result[0].values.length === 0) return 0;
  return result[0].values[0][0] as number;
}

describe('runMigrations', () => {
  it('fresh DB (V0→latest): crea tutte le colonne incluse target_start_char e target_end_char', () => {
    const db = new SQL.Database();
    runMigrations(db);

    const cols = getColumns(db, 'comments');
    expect(cols).toContain('id');
    expect(cols).toContain('body');
    expect(cols).toContain('carried_from_id');   // V2
    expect(cols).toContain('target_start_char'); // V3
    expect(cols).toContain('target_end_char');   // V3

    db.close();
  });

  it('schema version tracking: versione corrente dopo migrazione fresh', () => {
    const db = new SQL.Database();
    runMigrations(db);
    expect(getSchemaVersion(db)).toBe(4);
    db.close();
  });

  it('V2→latest upgrade: aggiunge le colonne V3 su un DB già a versione 2', () => {
    const db = new SQL.Database();

    // Costruisce fixture V2 manualmente (DDL V1 + ALTER V2 + version=2)
    // senza chiamare runMigrations, per testare davvero il path di upgrade
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
    db.exec('ALTER TABLE comments ADD COLUMN carried_from_id TEXT REFERENCES comments(id)');
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (2)');

    // Precondizione: colonne V3 assenti
    const colsBefore = getColumns(db, 'comments');
    expect(colsBefore).not.toContain('target_start_char');
    expect(colsBefore).not.toContain('target_end_char');

    runMigrations(db);

    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).toContain('target_start_char');
    expect(colsAfter).toContain('target_end_char');
    expect(getSchemaVersion(db)).toBe(4);

    db.close();
  });

  it('repair: DB at version 3+ but missing target_start_char columns gets repaired', () => {
    const db = new SQL.Database();

    // Build a V3 DB manually but WITHOUT the char columns (simulates the old bug)
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
    db.exec('ALTER TABLE comments ADD COLUMN carried_from_id TEXT REFERENCES comments(id)');
    // Fake version 3 WITHOUT actually adding the char columns
    db.exec('INSERT OR REPLACE INTO schema_version (version) VALUES (3)');

    // Precondition: columns missing despite version = 3
    const colsBefore = getColumns(db, 'comments');
    expect(colsBefore).not.toContain('target_start_char');
    expect(colsBefore).not.toContain('target_end_char');

    runMigrations(db);

    // Repair should have added the missing columns
    const colsAfter = getColumns(db, 'comments');
    expect(colsAfter).toContain('target_start_char');
    expect(colsAfter).toContain('target_end_char');

    db.close();
  });

  it('idempotency: seconda chiamata su DB già migrato non lancia e version rimane stabile', () => {
    const db = new SQL.Database();
    runMigrations(db);
    const versionAfterFirst = getSchemaVersion(db);
    expect(() => runMigrations(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(versionAfterFirst);
    db.close();
  });
});
