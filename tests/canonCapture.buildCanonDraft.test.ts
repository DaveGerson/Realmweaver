/**
 * utils/canonCapture.ts — buildCanonDraft
 *
 * Verifies the payload shape handed to each `campaignService.create*`
 * method: NPC/Location/Item drafts spread the matching `createDefault*`
 * factory (with `id` stripped — the store mints ids) plus a name/description
 * derived from `splitCanonNote`; a Note draft keeps the note's full original
 * text as `content` and is tagged 'Canon'.
 */

import { describe, it, expect } from 'vitest';
import { buildCanonDraft } from '../utils/canonCapture';
import { createDefaultNpc, createDefaultLocation, createDefaultItem } from '../utils/entityUtils';

const NOTE_CONTENT = "Borin, the one-eyed innkeeper, mentions a hidden door.";

describe('buildCanonDraft', () => {
  it('builds an NPC draft from the createDefaultNpc shape, with no id', () => {
    const draft = buildCanonDraft('npc', NOTE_CONTENT);

    expect(draft.name).toBe('Borin');
    expect(draft.description).toBe('the one-eyed innkeeper, mentions a hidden door.');
    // Every other createDefaultNpc() field survives the spread untouched.
    expect(draft.relationships).toEqual([]);
    expect(draft.history).toEqual([]);
    expect(draft.knowsPlayerHistory).toEqual([]);
    expect(draft.traits).toBe(createDefaultNpc().traits);
    expect('id' in draft).toBe(false);
  });

  it('builds a Location draft from the createDefaultLocation shape, with no id', () => {
    const draft = buildCanonDraft('location', 'The Rusty Anchor: a dive bar near the docks.');

    expect(draft.name).toBe('Rusty Anchor');
    expect(draft.description).toBe('a dive bar near the docks.');
    expect(draft.subLocationIds).toEqual([]);
    expect(draft.history).toEqual([]);
    expect(draft.secrets).toBe(createDefaultLocation().secrets);
    expect('id' in draft).toBe(false);
  });

  it('builds an Item draft from the createDefaultItem shape, with no id', () => {
    const draft = buildCanonDraft('item', 'A Dragon-Tooth Dagger, still warm to the touch.');

    expect(draft.name).toBe('Dragon-Tooth Dagger');
    expect(draft.description).toBe('still warm to the touch.');
    expect(draft.rarity).toBe(createDefaultItem().rarity);
    expect('id' in draft).toBe(false);
  });

  it('builds a Note draft that keeps the FULL original content, tagged Canon', () => {
    const draft = buildCanonDraft('note', NOTE_CONTENT);

    expect(draft).toEqual({
      title: 'Borin',
      content: NOTE_CONTENT,
      tags: ['Canon'],
    });
  });

  it('falls back to the createDefault* placeholder name when the note yields no name', () => {
    expect(buildCanonDraft('npc', '').name).toBe(createDefaultNpc().name);
    expect(buildCanonDraft('location', '').name).toBe(createDefaultLocation().name);
    expect(buildCanonDraft('item', '').name).toBe(createDefaultItem().name);
    expect(buildCanonDraft('note', '')).toEqual({ title: 'New Note', content: '', tags: ['Canon'] });
  });

  it('is pure — calling it twice with the same input returns equal, independently-mutable drafts', () => {
    const first = buildCanonDraft('npc', NOTE_CONTENT);
    const second = buildCanonDraft('npc', NOTE_CONTENT);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.relationships.push({ id: 'x', targetId: 'y', relationType: 'Ally', description: '' });
    expect(second.relationships).toEqual([]);
  });
});
