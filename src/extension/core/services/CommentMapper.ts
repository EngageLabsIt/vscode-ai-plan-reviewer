import type { Comment, DiffLine, MappedComment } from '../../../shared/models';

/**
 * CommentMapper re-anchors comments from a previous document version to their
 * best-guess positions in a new version, using the `DiffLine[]` output
 * produced by {@link DiffEngine}.
 *
 * ### Status semantics
 * - **`probably_unresolved`** — the anchor lines survived into the new version
 *   unchanged; the comment almost certainly still applies.
 * - **`probably_resolved`** — the anchor lines were removed and are immediately
 *   adjacent to new added lines (a textual edit); the comment may have been
 *   addressed by the edit.
 * - **`orphaned`** — the anchor lines were deleted with no adjacent addition;
 *   no meaningful new position can be assigned.
 *
 * This class is pure: it holds no state and produces no side effects.
 */
export class CommentMapper {
  /**
   * Map each comment's line-range from the old version to the new version.
   *
   * @param comments  - Comments anchored to the old document version.
   * @param diffLines - Ordered diff output from {@link DiffEngine.compute}.
   * @returns One {@link MappedComment} per input comment, in the same order.
   */
  map(comments: Comment[], diffLines: DiffLine[]): MappedComment[] {
    // ── Build lookup structures ──────────────────────────────────────────

    /**
     * Maps an old line number → new line number for lines that are unchanged
     * between the two versions.
     */
    const oldLineToNewLine = new Map<number, number>();

    /**
     * Maps an old line number → first new line number of the immediately
     * following added block, for removed lines that are adjacent to an
     * addition (i.e. a textual edit rather than a pure deletion).
     * Comments targeting these lines are classified as `probably_resolved`.
     */
    const modifiedOldLineToNewLine = new Map<number, number>();

    /**
     * Old line numbers that were deleted with no adjacent addition.
     * Comments targeting these lines are classified as `orphaned`.
     */
    const deletedOldLines = new Set<number>();

    // Single pass: walk diffLines tracking a buffer of consecutive removed
    // lines.  When an added block follows, those removed lines are "modified"
    // edits; otherwise they are true deletions.
    const pendingRemovedLines: number[] = [];

    for (const dl of diffLines) {
      if (dl.type === 'removed') {
        pendingRemovedLines.push(dl.lineNumberOld as number);
      } else if (dl.type === 'added') {
        if (pendingRemovedLines.length > 0) {
          // Removed lines immediately preceding this added block → modified.
          const firstNewLine = dl.lineNumberNew as number;
          for (const oldLine of pendingRemovedLines) {
            modifiedOldLineToNewLine.set(oldLine, firstNewLine);
          }
          pendingRemovedLines.length = 0;
        }
        // Added lines have no old line number — nothing else to map.
      } else {
        // 'unchanged': flush any pending removed lines as true deletions.
        for (const oldLine of pendingRemovedLines) {
          deletedOldLines.add(oldLine);
        }
        pendingRemovedLines.length = 0;

        // lineNumberOld and lineNumberNew are both non-null for unchanged lines.
        oldLineToNewLine.set(dl.lineNumberOld as number, dl.lineNumberNew as number);
      }
    }

    // Flush any trailing removed lines (end of diff with no following addition).
    for (const oldLine of pendingRemovedLines) {
      deletedOldLines.add(oldLine);
    }

    // ── Map each comment ─────────────────────────────────────────────────

    return comments.map((comment): MappedComment => {
      const { targetStart, targetEnd } = comment;

      // Check modified (removed-adjacent-to-added) lines first, BEFORE the
      // null/undefined guard, so they are never misclassified as orphaned.
      if (modifiedOldLineToNewLine.has(targetStart)) {
        const newStart = modifiedOldLineToNewLine.get(targetStart)!;
        const newEnd = modifiedOldLineToNewLine.get(targetEnd) ?? newStart;
        return {
          comment,
          newTargetStart: newStart,
          newTargetEnd: newEnd,
          status: 'probably_resolved',
        };
      }

      const mappedStart = oldLineToNewLine.get(targetStart);

      // mappedStart === undefined means the line was not present as an
      // unchanged line.  Combined with not being in modifiedOldLineToNewLine,
      // it must be a true deletion (or a line number not found in the diff at
      // all — treat defensively as orphaned either way).
      if (mappedStart === undefined || deletedOldLines.has(targetStart)) {
        return {
          comment,
          newTargetStart: null,
          newTargetEnd: null,
          status: 'orphaned',
        };
      }

      // The anchor start line is unchanged — the comment almost certainly
      // still applies.
      const mappedEnd = oldLineToNewLine.get(targetEnd) ?? mappedStart;
      return {
        comment,
        newTargetStart: mappedStart,
        newTargetEnd: mappedEnd,
        status: 'probably_unresolved',
      };
    });
  }
}
