import { diffLines } from 'diff';
import type { DiffLine } from '../../shared/models';

/**
 * DiffEngine computes a line-by-line diff between two text documents.
 *
 * Internally it delegates to the `diff` npm package's `diffLines()` method,
 * then converts the package's `Change[]` format into the richer `DiffLine[]`
 * shape defined in `models.ts`.
 *
 * The `'modified'` DiffLine type is reserved for future post-processing;
 * this engine emits adjacent `'removed'` + `'added'` pairs as separate
 * entries, matching the raw output of `diffLines()`.
 *
 * This class is pure: it holds no state and produces no side effects.
 */
export class DiffEngine {
  /**
   * Compute the line-by-line diff between `oldContent` and `newContent`.
   *
   * Line numbers are 1-based and track independently for the old file
   * (`lineNumberOld`) and the new file (`lineNumberNew`).
   *
   * - `added` lines:     `lineNumberOld` is `null`; `lineNumberNew` is set.
   * - `removed` lines:   `lineNumberOld` is set; `lineNumberNew` is `null`.
   * - `unchanged` lines: both are set.
   *
   * @param oldContent - Full text of the previous document version.
   * @param newContent - Full text of the current document version.
   * @returns Ordered array of `DiffLine` entries spanning the whole diff.
   */
  compute(oldContent: string, newContent: string): DiffLine[] {
    const changes = diffLines(oldContent, newContent);
    const result: DiffLine[] = [];

    let lineOld = 1; // 1-based counter for the old file
    let lineNew = 1; // 1-based counter for the new file

    for (const change of changes) {
      // Split on newlines; `diffLines` terminates each line with '\n', so
      // splitting produces a trailing empty string — drop it.
      const lines = change.value.split('\n');
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      for (const line of lines) {
        if (change.added) {
          result.push({
            type: 'added',
            lineNumberOld: null,
            lineNumberNew: lineNew++,
            content: line,
          });
        } else if (change.removed) {
          result.push({
            type: 'removed',
            lineNumberOld: lineOld++,
            lineNumberNew: null,
            content: line,
          });
        } else {
          // unchanged
          result.push({
            type: 'unchanged',
            lineNumberOld: lineOld++,
            lineNumberNew: lineNew++,
            content: line,
          });
        }
      }
    }

    return result;
  }
}
