/**
 * utils/canonCapture.ts — splitCanonNote
 *
 * Monte Cook's "improv canon capture": a running-log note gets split into a
 * proposed entity name (its leading clause) and a body (the remainder), so
 * "Make this canon" can pre-fill a name without any AI call. Pure function;
 * no jsdom needed.
 */

import { describe, it, expect } from 'vitest';
import { splitCanonNote } from '../utils/canonCapture';

describe('splitCanonNote', () => {
  it('splits at the first comma', () => {
    const result = splitCanonNote('Borin, the one-eyed innkeeper, mentions a hidden door.');
    expect(result).toEqual({
      name: 'Borin',
      body: 'the one-eyed innkeeper, mentions a hidden door.',
    });
  });

  it('splits at the first colon and strips a leading article when the remainder is a proper noun', () => {
    const result = splitCanonNote('The Rusty Anchor: a dive bar near the docks.');
    expect(result).toEqual({
      name: 'Rusty Anchor',
      body: 'a dive bar near the docks.',
    });
  });

  it('splits at a whitespace-flanked hyphen, and only the first one', () => {
    const result = splitCanonNote('Borin - the barkeep - winks at the party');
    expect(result).toEqual({
      name: 'Borin',
      body: 'the barkeep - winks at the party',
    });
  });

  it('splits at a whitespace-flanked em dash', () => {
    const result = splitCanonNote('Borin — missing an eye');
    expect(result).toEqual({ name: 'Borin', body: 'missing an eye' });
  });

  it('does NOT split on a hyphen inside a word (no surrounding whitespace)', () => {
    const result = splitCanonNote('The one-eyed barkeep winks.');
    // No comma/colon/flanked-dash; the only delimiter is the trailing period,
    // so the whole sentence (minus the period) is the leading clause — and
    // "The" is not stripped because the remainder ("one-eyed…") is lowercase.
    expect(result).toEqual({ name: 'The one-eyed barkeep winks', body: '' });
  });

  it('leaves a leading "The" alone when the remainder is a common noun, not a proper name', () => {
    const content = "The innkeeper is named Borin and he's missing an eye.";
    const result = splitCanonNote(content);
    expect(result.name).toBe(content.replace(/\.$/, ''));
    expect(result.body).toBe('');
  });

  it('strips a leading "A" when the remainder is a proper noun', () => {
    const result = splitCanonNote("A Dragon's Hoard, glittering with gold.");
    expect(result).toEqual({ name: "Dragon's Hoard", body: 'glittering with gold.' });
  });

  it('leaves a leading "A" alone when the remainder is a common noun', () => {
    const result = splitCanonNote('A tavern brawl broke out, everyone scattered.');
    expect(result).toEqual({ name: 'A tavern brawl broke out', body: 'everyone scattered.' });
  });

  it('treats a note with no delimiter at all as the whole name, with an empty body', () => {
    expect(splitCanonNote('Borin')).toEqual({ name: 'Borin', body: '' });
  });

  it('trims surrounding whitespace before splitting', () => {
    expect(splitCanonNote('  Borin, the barkeep.  ')).toEqual({
      name: 'Borin',
      body: 'the barkeep.',
    });
  });

  it('returns an empty name and body for empty or whitespace-only content', () => {
    expect(splitCanonNote('')).toEqual({ name: '', body: '' });
    expect(splitCanonNote('   ')).toEqual({ name: '', body: '' });
  });

  it('caps a long, punctuation-free clause at a word boundary within the max length', () => {
    const longNoPunct = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    const result = splitCanonNote(longNoPunct);

    expect(result.body).toBe('');
    expect(result.name.length).toBeLessThanOrEqual(60);
    expect(longNoPunct.startsWith(result.name)).toBe(true);
    // Never chopped mid-word: whatever follows the cut in the original text
    // is either a space or nothing at all.
    const nextChar = longNoPunct[result.name.length];
    expect(nextChar === ' ' || nextChar === undefined).toBe(true);
  });

  it('falls back to the whole note when a delimiter sits at position 0', () => {
    // Content starting with punctuation has no leading clause to extract —
    // splitCanonNote falls back to the whole trimmed note as the name rather
    // than producing an empty one.
    const result = splitCanonNote(', Borin winks.');
    expect(result.name).toBe(', Borin winks.');
    expect(result.body).toBe('');
  });
});
