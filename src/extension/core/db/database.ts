import initSqlJs from 'sql.js';
import type { Database as SqlDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

export class Database {
  private static instance: Database | undefined;
  private db: SqlDatabase | null = null;
  private dbFilePath: string | null = null;

  private constructor() {}

  static getInstance(): Database {
    if (Database.instance === undefined) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async init(storagePath: string): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(__dirname, file),
    });

    this.dbFilePath = storagePath;

    if (fs.existsSync(storagePath)) {
      const fileBuffer = fs.readFileSync(storagePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON');
  }

  getDb(): SqlDatabase {
    if (this.db === null) {
      throw new Error(
        'Database has not been initialized. Call init() before using getDb().',
      );
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db === null) {
      return;
    }

    if (this.dbFilePath !== null) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbFilePath, buffer);
    }

    this.db.close();
    this.db = null;
  }
}
