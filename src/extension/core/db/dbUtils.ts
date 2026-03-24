import type { Statement } from 'sql.js';

export type Row = Record<string, number | string | Uint8Array | null>;

/**
 * Iterates a prepared statement, collecting all rows as plain objects, then frees the statement.
 */
export function collectRows(stmt: Statement): Row[] {
  const rows: Row[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Row);
  }
  stmt.free();
  return rows;
}

/**
 * Builds the SET clause and params array for an UPDATE query from column/value pairs.
 * The caller is responsible for appending the WHERE id param before running the statement.
 *
 * @example
 * const { setClause, params } = buildUpdateClause([['title', 'New Title'], ['status', 'archived']]);
 * params.push(id);
 * db.prepare(`UPDATE plans SET ${setClause} WHERE id = ?`).run(params);
 */
export function buildUpdateClause(
  pairs: Array<[column: string, value: string | number | null]>
): { setClause: string; params: Array<string | number | null> } {
  return {
    setClause: pairs.map(([col]) => `${col} = ?`).join(', '),
    params: pairs.map(([, val]) => val),
  };
}
