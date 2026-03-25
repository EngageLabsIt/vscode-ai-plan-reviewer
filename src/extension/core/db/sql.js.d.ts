/**
 * Ambient type declarations for sql.js (no @types/sql.js package available).
 * Covers the subset of the API used by this project.
 */
declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface QueryExecResult {
    columns: string[];
    values: Array<Array<number | string | Uint8Array | null>>;
  }

  interface ParamsObject {
    [key: string]: number | string | null | Uint8Array;
  }

  type BindParams =
    | Array<number | string | null | Uint8Array>
    | ParamsObject
    | null;

  interface StatementIterator {
    [Symbol.iterator](): Iterator<Statement>;
  }

  interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getAsObject(
      params?: BindParams,
    ): Record<string, number | string | Uint8Array | null>;
    run(params?: BindParams): void;
    reset(): void;
    free(): boolean;
    freemem(): void;
  }

  interface Database {
    run(sql: string, params?: BindParams): Database;
    exec(sql: string, params?: BindParams): QueryExecResult[];
    prepare(sql: string, params?: BindParams): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface InitSqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;

  export default initSqlJs;
  export type { SqlJsStatic, Database, Statement, QueryExecResult, BindParams };
}
