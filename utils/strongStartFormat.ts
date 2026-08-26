/**
 * The on-disk encoding of a session's "strong start" (lazy prep path).
 *
 * Zero new schema: the strong start is stored as a clearly-delimited leading
 * section of the session's existing `prepNotes` string. `SessionPrepWizard`
 * writes it on Go Live; `SceneListPanel` (Session Runner) parses the exact
 * same encoding back out — the two sides must agree byte-for-byte or the
 * round trip breaks. Living in its own leaf module keeps the Session Runner
 * from pulling the whole wizard into its chunk just to parse a marker.
 */
export const STRONG_START_OPEN = '=== STRONG START ===';
export const STRONG_START_CLOSE = '=== END STRONG START ===';

/** Folds a strong start and the rest of the prep notes into one `prepNotes` string. */
export function composeStrongStartPrepNotes(strongStart: string, notes: string): string {
    const start = strongStart.trim();
    const rest = notes.trim();
    if (!start) return rest;
    const block = `${STRONG_START_OPEN}\n${start}\n${STRONG_START_CLOSE}`;
    return rest ? `${block}\n\n${rest}` : block;
}

/**
 * Reverses `composeStrongStartPrepNotes`. The open marker only counts when it
 * is the very first line, and an open marker with no matching close marker is
 * NOT a strong start — in both cases the whole string is left as the DM's
 * prose (returned as `rest`, byte-for-byte) rather than risking eating a note.
 */
export function parseStrongStartPrepNotes(prepNotes: string | undefined | null): { strongStart: string | null; rest: string } {
    if (!prepNotes) return { strongStart: null, rest: '' };
    const normalized = prepNotes.replace(/\r\n/g, '\n');
    if (!normalized.startsWith(STRONG_START_OPEN)) return { strongStart: null, rest: normalized };

    const afterOpen = normalized.slice(STRONG_START_OPEN.length); // starts with '\n' when well-formed
    const closeMarker = `\n${STRONG_START_CLOSE}`;
    const closeIdx = afterOpen.indexOf(closeMarker);
    if (closeIdx === -1) return { strongStart: null, rest: normalized };

    const body = afterOpen.slice(1, closeIdx);
    if (!body.trim()) return { strongStart: null, rest: normalized };
    const rest = afterOpen.slice(closeIdx + closeMarker.length).replace(/^\n+/, '');
    return { strongStart: body, rest };
}
