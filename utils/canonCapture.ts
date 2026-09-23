// utils/canonCapture.ts
//
// Monte Cook's "improv canon capture" posture: an improvised fact spoken at
// the table becomes permanent world truth at near-zero cost. This module is
// the pure half of that bridge — splitting a running-log / session note into
// a proposed entity name + description, and building the exact payload
// shape each `campaignService.create*` method expects. It holds no state,
// touches no service, and is safe to call inside a `useMemo` (or on every
// keystroke of an editable name field).
//
// Nothing here promotes anything automatically. Both host surfaces
// (`components/views/session/RunningLog.tsx`,
// `components/editors/SessionLogEditor.tsx`) only ever act on the drafts
// this module builds after an explicit "Save" click in
// `components/common/CanonCapturePicker.tsx` — a note that is never
// promoted stays exactly as valid as it always was.

import type { NPC, Location, Item, Note } from '../types/index';
import { createDefaultNpc, createDefaultLocation, createDefaultItem } from './entityUtils';

/** The four entity types "Make this canon" can create from a note. */
export type CanonEntityKind = 'npc' | 'location' | 'item' | 'note';

/** Sane display length for a proposed entity name — a suggestion, not a cap on a real name. */
const MAX_NAME_LENGTH = 60;

// The leading-clause split point: a comma or colon always breaks it; a
// period only breaks it when it ends a sentence (followed by whitespace or
// end-of-string), so a mid-abbreviation dot doesn't fire; a dash only
// breaks it when it is flanked by whitespace, so a hyphenated word like
// "one-eyed" is never split mid-word.
const CLAUSE_BREAK_RE = /[,:]|\.(?=\s|$)|(?<=\s)[-–—](?=\s)/;

// Matches a leading "The "/"A " article (case-insensitive) so it can be
// conditionally stripped — see `stripLeadingArticle`.
const LEADING_ARTICLE_RE = /^(?:The|A)\s+(.+)$/i;

/**
 * Trims a proposed name to `MAX_NAME_LENGTH`, preferring to cut at the last
 * word boundary within the limit so a long clause is never chopped mid-word
 * when an earlier space is available.
 */
function capLength(name: string, max: number): string {
    if (name.length <= max) return name;
    const truncated = name.slice(0, max);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trimEnd();
}

/**
 * Strips a leading "The"/"A" article, but ONLY when what remains reads like
 * a proper noun — i.e. it starts capitalised. "The Rusty Anchor" becomes
 * "Rusty Anchor" (a place name), but "The innkeeper is named Borin" is left
 * untouched (the remainder, "innkeeper…", is a common noun — the sentence
 * happens to start with "The", it isn't naming anything with that word).
 */
function stripLeadingArticle(clause: string): string {
    const match = LEADING_ARTICLE_RE.exec(clause);
    if (!match) return clause;
    const remainder = match[1];
    return /^[A-Z]/.test(remainder) ? remainder : clause;
}

/**
 * Splits a free-typed running-log / session note into a proposed entity
 * name (its leading clause) and the remainder as description/body. Pure,
 * synchronous, and safe to call on every render — it never throws and never
 * touches the store.
 *
 * The split point is the first comma, colon, sentence-ending period, or
 * whitespace-flanked dash (see `CLAUSE_BREAK_RE`). Everything before it
 * becomes the name — with a leading "The"/"A" stripped when the remainder
 * looks like a proper noun (`stripLeadingArticle`), capped at
 * `MAX_NAME_LENGTH` (`capLength`) — and everything after becomes the body.
 * A note with none of those delimiters (or one that starts with a
 * delimiter, leaving an empty clause) becomes the name in full, capped,
 * with an empty body — there is nothing to split, and the name is always
 * editable in the picker that shows it.
 */
export function splitCanonNote(content: string): { name: string; body: string } {
    const trimmed = (content ?? '').trim();
    if (!trimmed) return { name: '', body: '' };

    const match = CLAUSE_BREAK_RE.exec(trimmed);
    let clause = trimmed;
    let body = '';
    if (match && match.index > 0) {
        clause = trimmed.slice(0, match.index).trim();
        body = trimmed.slice(match.index + match[0].length).trim();
    }
    // A delimiter at position 0 (content starting with punctuation) can
    // leave `clause` empty — fall back to the whole note as the name.
    if (!clause) {
        clause = trimmed;
        body = '';
    }

    const name = capLength(stripLeadingArticle(clause), MAX_NAME_LENGTH);
    return { name, body };
}

/**
 * Builds the exact payload shape `campaignService.create*` expects for the
 * given kind, from a running-log / session note's raw content.
 *
 * NPC/location/item drafts spread the matching `createDefault*` factory
 * (with `id` stripped — the store mints ids) so every field those types
 * require is present, with `name`/`description` taken from
 * `splitCanonNote`. A Note draft keeps the note's full original text as its
 * `content` — Notes hold prose wholesale, not a name+description split —
 * and is tagged `'Canon'` so a promoted note is easy to find later; only
 * its `title` comes from `splitCanonNote`.
 *
 * Callers that let the DM edit the suggested name (both host surfaces do,
 * via `CanonCapturePicker`) should spread this draft and overwrite
 * `name`/`title` with the edited value before calling `create*`.
 */
export function buildCanonDraft(kind: 'npc', content: string): Omit<NPC, 'id'>;
export function buildCanonDraft(kind: 'location', content: string): Omit<Location, 'id'>;
export function buildCanonDraft(kind: 'item', content: string): Omit<Item, 'id'>;
export function buildCanonDraft(kind: 'note', content: string): Omit<Note, 'id' | 'createdAt' | 'lastModified'>;
export function buildCanonDraft(
    kind: CanonEntityKind,
    content: string,
): Omit<NPC, 'id'> | Omit<Location, 'id'> | Omit<Item, 'id'> | Omit<Note, 'id' | 'createdAt' | 'lastModified'> {
    const { name, body } = splitCanonNote(content);

    switch (kind) {
        case 'npc': {
            const { id: _id, ...defaults } = createDefaultNpc();
            return { ...defaults, name: name || defaults.name, description: body };
        }
        case 'location': {
            const { id: _id, ...defaults } = createDefaultLocation();
            return { ...defaults, name: name || defaults.name, description: body };
        }
        case 'item': {
            const { id: _id, ...defaults } = createDefaultItem();
            return { ...defaults, name: name || defaults.name, description: body };
        }
        case 'note':
            return { title: name || 'New Note', content: (content ?? '').trim(), tags: ['Canon'] };
        default: {
            // Exhaustiveness guard — every CanonEntityKind is handled above.
            const _exhaustive: never = kind;
            throw new Error(`Unknown canon draft kind: ${String(_exhaustive)}`);
        }
    }
}
