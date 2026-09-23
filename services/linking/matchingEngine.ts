/**
 * One entity that a matched span of text could refer to. When several
 * candidates share the matched name (two NPCs called "Marcus", or an NPC and a
 * faction both called "Raven") every one of them is listed so callers can
 * disambiguate instead of silently trusting array order.
 */
export interface EntityMatchCandidate {
  entityId: string;
  entityType: string;
  entityName: string;
  /** True when the span matched one of this entity's aliases, not its name. */
  viaAlias: boolean;
}

export interface EntityMatch {
  /** The primary (first-listed) entity for this span — kept for backward compatibility. */
  entityId: string;
  entityType: string;
  /** The primary entity's canonical name (not the alias or the text's casing). */
  entityName: string;
  /**
   * 0–1 score. 1.0 = exact-case full-name match of a distinctive name. Lowered
   * for case-insensitive matches, alias matches, very short names, common
   * words, and ambiguity (see `scoreMatch`).
   */
  confidence: number;
  matchSpan: [number, number];
  /**
   * Every entity sharing the matched name, primary first. Optional so custom
   * MatchingEngine implementations stay valid; TextMatchingEngine always sets it.
   */
  candidates?: EntityMatchCandidate[];
  /** True when `candidates` holds more than one distinct entity. */
  ambiguous?: boolean;
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

export const MIN_NAME_LENGTH = 3;

/**
 * Split an ambiguous match into one match per candidate entity (each keeping
 * the span, confidence, `ambiguous: true` and the full `candidates` list) so a
 * UI can offer every entity sharing the name. Unambiguous matches — and
 * matches from engines that don't report candidates — pass through unchanged.
 */
export function expandAmbiguousMatch(match: EntityMatch): EntityMatch[] {
  if (!match.ambiguous || !match.candidates || match.candidates.length < 2) return [match];
  return match.candidates.map(c => ({
    ...match,
    entityId: c.entityId,
    entityType: c.entityType,
    entityName: c.entityName,
  }));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Base score for a name/alias match with the exact casing of the stored form. */
const BASE_NAME = 1.0;
const BASE_ALIAS = 0.85;
/** Text casing differs from the stored name ("KALLI ALRAN" for "Kalli Alran"). */
const CASE_MISMATCH_PENALTY = 0.1;
/** A capitalised one-word name found all-lowercase ("hope" for "Hope") is
 *  probably the ordinary word, not the proper noun. */
const LOWERCASED_PROPER_NOUN_PENALTY = 0.15;
/** Names this short collide with ordinary words and initials more often. */
const SHORT_NAME_MAX_LENGTH = 4;
const SHORT_NAME_PENALTY = 0.1;
/** Names that are plain English words ("Dawn", "The Gate" is fine, "Gate" is not). */
const COMMON_WORD_PENALTY = 0.3;
/** Multiplier applied when several entities share the matched name. Keeps an
 *  ambiguous exact match (0.6) above LinkSuggestionsPanel's 0.5 threshold but
 *  well below autoLinker's 0.9, so nothing is auto-linked by array order. */
const AMBIGUITY_FACTOR = 0.6;
const MIN_SCORE = 0.05;

const COMMON_WORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'but', 'for', 'not', 'all', 'one', 'two', 'may', 'will', 'can',
  'hope', 'faith', 'grace', 'joy', 'war', 'peace', 'home', 'king', 'queen',
  'lord', 'lady', 'guard', 'city', 'town', 'keep', 'tower', 'temple', 'inn',
  'tavern', 'market', 'gate', 'bridge', 'river', 'forest', 'sea', 'dawn',
  'dusk', 'night', 'day', 'fire', 'ice', 'stone', 'iron', 'gold', 'silver',
  'shadow', 'light', 'dark', 'order', 'council', 'crown', 'church', 'hall',
  'road', 'port', 'wall', 'north', 'south', 'east', 'west', 'blade', 'sword',
]);

/** Length in code points, so astral-plane characters count once. */
function codePointLength(s: string): number {
  return Array.from(s).length;
}

/**
 * Score one matched span. Pure and exported for testing.
 *
 * @param matchedText the exact substring of the source text that matched
 * @param form        the stored name/alias that produced the match
 * @param viaAlias    whether `form` is an alias rather than the canonical name
 * @param distinctEntities how many distinct entities share `form`
 */
export function scoreMatch(
  matchedText: string,
  form: string,
  viaAlias: boolean,
  distinctEntities: number,
): number {
  let score = viaAlias ? BASE_ALIAS : BASE_NAME;

  if (matchedText !== form) {
    score -= CASE_MISMATCH_PENALTY;
    const singleWord = !/\s/u.test(form);
    if (
      singleWord &&
      form !== form.toLowerCase() &&
      matchedText === matchedText.toLowerCase()
    ) {
      score -= LOWERCASED_PROPER_NOUN_PENALTY;
    }
  }

  if (codePointLength(form) <= SHORT_NAME_MAX_LENGTH) score -= SHORT_NAME_PENALTY;
  if (COMMON_WORDS.has(form.toLowerCase())) score -= COMMON_WORD_PENALTY;
  if (distinctEntities > 1) score *= AMBIGUITY_FACTOR;

  score = Math.max(MIN_SCORE, Math.min(1, score));
  // Round to 2dp so threshold comparisons (>= 0.9) aren't at the mercy of
  // floating-point subtraction.
  return Math.round(score * 100) / 100;
}

// ─── Index ────────────────────────────────────────────────────────────────────

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive, Unicode-aware word-boundary matcher for a name.
 * `\p{L}\p{N}` (letters/numbers in any script) are word characters, so "Ana"
 * never matches inside "Anaïs" (the 'ï' is a word char, not a boundary) and
 * "_" IS a boundary (underscore is not \p{L}/\p{N}) — finding #45.
 *
 * Matching runs directly against the ORIGINAL text via `lastIndex`-based
 * `exec` scanning — there is no intermediate lowercased copy of the text, so
 * a matchSpan can never drift out of sync with a character (like 'İ' U+0130)
 * that changes length under `toLowerCase()` (finding #100).
 */
function buildMatcher(name: string): RegExp {
  const escaped = escapeRegExp(name);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
}

interface FormEntry {
  candidate: EntityCandidate;
  viaAlias: boolean;
}

/** One distinct surface form (case-folded) and every entity that owns it. */
interface PreparedForm {
  /** The first-seen spelling, used for exact-case scoring. */
  form: string;
  matcher: RegExp;
  /** Canonical-name owners first (in input order), then alias owners. */
  entries: FormEntry[];
  /** Pre-built candidate list for EntityMatch.candidates. */
  matchCandidates: EntityMatchCandidate[];
}

interface PreparedIndex {
  forms: PreparedForm[];
}

function buildIndex(candidates: EntityCandidate[]): PreparedIndex {
  const byKey = new Map<string, { form: string; names: FormEntry[]; aliases: FormEntry[] }>();

  const add = (form: unknown, candidate: EntityCandidate, viaAlias: boolean) => {
    if (typeof form !== 'string') return;
    const trimmed = form.trim();
    if (trimmed.length < MIN_NAME_LENGTH) return;
    const key = trimmed.toLowerCase();
    let group = byKey.get(key);
    if (!group) {
      group = { form: trimmed, names: [], aliases: [] };
      byKey.set(key, group);
    }
    const bucket = viaAlias ? group.aliases : group.names;
    // An entity listing the same alias twice (or an alias equal to its own
    // name) must not show up as ambiguous with itself.
    if (group.names.some(e => e.candidate.id === candidate.id)) return;
    if (bucket.some(e => e.candidate.id === candidate.id)) return;
    bucket.push({ candidate, viaAlias });
  };

  for (const c of candidates) {
    if (!c) continue;
    add(c.name, c, false);
    for (const alias of c.aliases ?? []) add(alias, c, true);
  }

  const forms: PreparedForm[] = [];
  for (const group of byKey.values()) {
    const nameIds = new Set(group.names.map(e => e.candidate.id));
    const entries = [
      ...group.names,
      ...group.aliases.filter(e => !nameIds.has(e.candidate.id)),
    ];
    forms.push({
      form: group.form,
      matcher: buildMatcher(group.form),
      entries,
      matchCandidates: entries.map(e => ({
        entityId: e.candidate.id,
        entityType: e.candidate.type,
        entityName: e.candidate.name,
        viaAlias: e.viaAlias,
      })),
    });
  }

  // Longest form first so that at a shared start offset the longest name wins
  // ("The Great Library" before "Great"). Array.prototype.sort is stable.
  forms.sort((a, b) => b.form.length - a.form.length);
  return { forms };
}

/**
 * Snapshot of the fields the index depends on, used to detect in-place
 * mutation of a cached candidate array (cheap O(n) reference/string checks —
 * far cheaper than recompiling n RegExps).
 */
interface CacheEntry {
  refs: EntityCandidate[];
  names: string[];
  ids: string[];
  types: string[];
  aliases: (string[] | undefined)[];
  index: PreparedIndex;
}

function isFresh(entry: CacheEntry, candidates: EntityCandidate[]): boolean {
  if (entry.refs.length !== candidates.length) return false;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (
      c !== entry.refs[i] ||
      c?.name !== entry.names[i] ||
      c?.id !== entry.ids[i] ||
      c?.type !== entry.types[i] ||
      c?.aliases !== entry.aliases[i]
    ) {
      return false;
    }
  }
  return true;
}

export class TextMatchingEngine implements MatchingEngine {
  /**
   * Compiled index per candidate-array identity. Callers that pass the same
   * (memoized) array — e.g. every LinkedText paragraph in a campaign — share
   * one set of compiled matchers. WeakMap, so dropped arrays are collected.
   */
  private cache = new WeakMap<EntityCandidate[], CacheEntry>();
  /** Number of index builds performed; exposed for tests/diagnostics. */
  indexBuilds = 0;

  private getIndex(candidates: EntityCandidate[]): PreparedIndex {
    const cached = this.cache.get(candidates);
    if (cached && isFresh(cached, candidates)) return cached.index;

    const index = buildIndex(candidates);
    this.indexBuilds++;
    this.cache.set(candidates, {
      refs: [...candidates],
      names: candidates.map(c => c?.name),
      ids: candidates.map(c => c?.id),
      types: candidates.map(c => c?.type),
      aliases: candidates.map(c => c?.aliases),
      index,
    });
    return index;
  }

  findMatches(text: string, candidates: EntityCandidate[]): EntityMatch[] {
    if (!text || !candidates || candidates.length === 0) return [];

    const { forms } = this.getIndex(candidates);
    if (forms.length === 0) return [];

    const matches: EntityMatch[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      let best: { pf: PreparedForm; start: number; end: number } | null = null;

      for (const pf of forms) {
        // Reset lastIndex before every exec so each form is scanned fresh
        // from the cursor — `exec` with a global regex advances past
        // positions that fail the embedded boundary lookaround, so it finds
        // the NEXT valid occurrence instead of abandoning the candidate at
        // its first failing substring occurrence (finding #45). Resetting
        // also makes sharing cached matchers across calls safe.
        pf.matcher.lastIndex = cursor;
        const m = pf.matcher.exec(text);
        if (!m) continue;

        const start = m.index;
        if (best === null || start < best.start) {
          best = { pf, start, end: start + m[0].length };
        }
      }

      if (!best) break;

      const { pf, start, end } = best;
      const primary = pf.entries[0];
      const distinct = pf.entries.length;
      matches.push({
        entityId: primary.candidate.id,
        entityType: primary.candidate.type,
        entityName: primary.candidate.name,
        confidence: scoreMatch(text.slice(start, end), pf.form, primary.viaAlias, distinct),
        matchSpan: [start, end],
        candidates: pf.matchCandidates.map(c => ({ ...c })),
        ambiguous: distinct > 1,
      });

      cursor = end;
    }

    return matches;
  }

  info() {
    return { name: 'TextMatchingEngine', version: '2.0.0' };
  }
}
