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

function isWordBoundary(text: string, start: number, end: number): boolean {
  const before = start === 0 || /[^a-zA-Z0-9]/.test(text[start - 1]);
  const after = end >= text.length || /[^a-zA-Z0-9]/.test(text[end]);
  return before && after;
}

interface PreparedCandidate {
  candidate: EntityCandidate;
  lowerName: string;
}

export class TextMatchingEngine implements MatchingEngine {
  findMatches(text: string, candidates: EntityCandidate[]): EntityMatch[] {
    if (!text || candidates.length === 0) return [];

    const lowerText = text.toLowerCase();

    const prepared: PreparedCandidate[] = candidates
      .filter(c => c.name.length >= MIN_NAME_LENGTH)
      .map(c => ({ candidate: c, lowerName: c.name.toLowerCase() }))
      .sort((a, b) => b.lowerName.length - a.lowerName.length);

    const matches: EntityMatch[] = [];
    let cursor = 0;

    while (cursor < lowerText.length) {
      let best: { pc: PreparedCandidate; start: number; end: number } | null = null;

      for (const pc of prepared) {
        const idx = lowerText.indexOf(pc.lowerName, cursor);
        if (idx === -1) continue;
        const end = idx + pc.lowerName.length;
        if (!isWordBoundary(lowerText, idx, end)) continue;
        if (best === null || idx < best.start) {
          best = { pc, start: idx, end };
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
