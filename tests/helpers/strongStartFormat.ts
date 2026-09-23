/**
 * SPEC FIXTURE — the on-disk encoding of a session's "strong start" (Wave 1, lane R1).
 *
 * Zero new schema: the strong start is stored as a clearly-delimited LEADING
 * section of the session's existing `prepNotes` string. This file is the single
 * definition of that encoding for the lane's suites — the wizard suite asserts
 * that Go Live WRITES exactly this, and the Session Runner suite asserts that
 * the scene panel READS exactly this back. Both sides must agree or the round
 * trip is broken, which is precisely the fragility this shape has to survive.
 *
 * The encoding, stated once:
 *
 *   === STRONG START ===
 *   <the DM's own words, trimmed, newlines preserved>
 *   === END STRONG START ===
 *
 *   <the rest of the prep notes, trimmed>
 *
 * Rules the product code must honour (each pinned by a test somewhere in the lane):
 *   - No strong start  → prepNotes is just the trimmed notes, no markers at all.
 *   - No other notes   → prepNotes is exactly the delimited block, no trailing blank lines.
 *   - Both             → block, one blank line, notes.
 *   - The open marker only counts as a strong start when it is the FIRST line.
 *   - An open marker with no matching close marker is NOT a strong start; the
 *     whole string stays the DM's prose, verbatim and unharmed.
 *   - The markers themselves are machinery and are never shown to a human.
 */

export const STRONG_START_OPEN = '=== STRONG START ===';
export const STRONG_START_CLOSE = '=== END STRONG START ===';

/**
 * Reference composition, used by the tests to build expected values.
 * Product code is free to implement this however it likes, as long as it
 * produces byte-identical output.
 */
export function composeStrongStartPrepNotes(strongStart: string, notes: string): string {
    const start = strongStart.trim();
    const rest = notes.trim();
    if (!start) return rest;
    const block = `${STRONG_START_OPEN}\n${start}\n${STRONG_START_CLOSE}`;
    return rest ? `${block}\n\n${rest}` : block;
}
