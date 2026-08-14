export interface EntityMatch {
  entityId: string;
  entityType: string;
  entityName: string;
  confidence: number;
  matchSpan: [number, number];
}

export interface MatchingEngine {
  findMatches(text: string, candidates: EntityCandidate[]): EntityMatch[];
  info(): { name: string; version: string };
}

export interface EntityCandidate {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
}

const MIN_NAME_LENGTH = 3;

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive, Unicode-aware word-boundary matcher for a name.
 * `\p{L}\p{N}` (letters/numbers in any script) are word characters — this
 * mirrors components/common/LinkedText.tsx's `buildMatcher` exactly, so the
 * two systems can never disagree on what counts as a match (finding #45):
 * "Ana" never matches inside "Anaïs" (the 'ï' is a word char, not a
 * boundary) and "_" IS a boundary (underscore is not \p{L}/\p{N}).
 *
 * Matching runs directly against the ORIGINAL text via `lastIndex`-based
 * `exec` scanning below — there is no intermediate lowercased copy of the
 * text, so there is no possibility of a matchSpan offset drifting out of
 * sync with a character (like 'İ' U+0130) that changes length under
 * `toLowerCase()` (finding #100).
 */
function buildMatcher(name: string): RegExp {
  const escaped = escapeRegExp(name);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
}

interface PreparedCandidate {
  candidate: EntityCandidate;
  matcher: RegExp;
}

export class TextMatchingEngine implements MatchingEngine {
  findMatches(text: string, candidates: EntityCandidate[]): EntityMatch[] {
    if (!text || candidates.length === 0) return [];

    const prepared: PreparedCandidate[] = candidates
      .filter(c => c.name.length >= MIN_NAME_LENGTH)
      .map(c => ({ candidate: c, matcher: buildMatcher(c.name) }))
      .sort((a, b) => b.candidate.name.length - a.candidate.name.length);

    const matches: EntityMatch[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      let best: { pc: PreparedCandidate; start: number; end: number } | null = null;

      for (const pc of prepared) {
        // Reset lastIndex before every exec so each candidate is scanned
        // fresh from the cursor — `exec` with a global regex internally
        // advances past positions that fail the embedded boundary
        // lookaround, so it finds the NEXT valid occurrence of a name
        // instead of giving up on the candidate the moment its first
        // substring occurrence fails the boundary test (finding #45's
        // "first-occurrence abandonment").
        pc.matcher.lastIndex = cursor;
        const m = pc.matcher.exec(text);
        if (!m) continue;

        const start = m.index;
        const end = start + m[0].length;
        if (best === null || start < best.start) {
          best = { pc, start, end };
        }
      }

      if (!best) break;

      matches.push({
        entityId: best.pc.candidate.id,
        entityType: best.pc.candidate.type,
        entityName: best.pc.candidate.name,
        confidence: 1.0,
        matchSpan: [best.start, best.end],
      });

      cursor = best.end;
    }

    return matches;
  }

  info() {
    return { name: 'TextMatchingEngine', version: '1.0.0' };
  }
}
