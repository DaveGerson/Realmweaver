// @vitest-environment jsdom
/**
 * wp-j-types-utils — findings #63 and #106 (PlayerCharacterDashboard cards)
 *
 * #63: the card body reads `pc.characterStatistics.classes.charClass`,
 *      `.subclass`, `.level` and `pc.characterSocial.species` with NO optional
 *      chaining, even though `pcCompleteness` twelve lines above is fully
 *      defensive about exactly those paths. PCs enter the campaign through
 *      `createPlayerCharacterFromPdf`, which passes AI-parsed JSON straight
 *      through, so one incompletely parsed sheet throws a TypeError while
 *      rendering and takes down the WHOLE dashboard — the user cannot even
 *      reach the entity to delete it. Normalizing on create is not sufficient
 *      on its own: PCs already persisted in localStorage stay malformed, so
 *      the card itself has to survive them.
 *
 * #106: the card hardcodes `border-l-amber-500` / `hover:border-l-amber-400`
 *      and `text-amber-400`, but ENTITY_TYPE_CONFIG assigns `teal` to
 *      playerCharacter, and EntityQuickCard / CommandPalette / sidebar /
 *      RelationshipGraph all render PCs in teal. CLAUDE.md forbids hardcoding
 *      these colors.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { PlayerCharacter } from '../../types/index';
import { PlayerCharacterDashboard } from '../../components/dashboards/PlayerCharacterDashboard';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';

afterEach(cleanup);

/** A fully populated (100% complete) PC — completeness dot renders green, not amber. */
const completePc: PlayerCharacter = {
  id: 'pc-complete',
  playerName: 'Dana',
  characterSocial: {
    characterName: 'Kaelen', background: 'Soldier', species: 'Human',
    personality: '', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
  },
  characterStatistics: {
    classes: { charClass: 'Fighter', subclass: 'Champion', level: 3 },
    attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
    skills: {} as PlayerCharacter['characterStatistics']['skills'],
    actions: [], specialActions: [],
  },
};

/** What an incompletely parsed character sheet actually looks like in the store. */
const malformedPc = {
  id: 'pc-broken',
  playerName: 'Sam',
  characterSocial: { characterName: 'Nameless Wanderer' },
} as unknown as PlayerCharacter;

function renderDashboard(pcs: PlayerCharacter[]) {
  return render(
    <PlayerCharacterDashboard
      playerCharacters={pcs}
      onImport={async () => {}}
      onSelectPlayerCharacter={() => {}}
      isMockMode={true}
    />,
  );
}

describe('#63 — a malformed PC must not take down the Player Characters dashboard', () => {
  it('renders a card for a PC missing characterStatistics without throwing', () => {
    expect(() => renderDashboard([malformedPc])).not.toThrow();
    expect(screen.getByText('Nameless Wanderer')).toBeTruthy();
  });

  it('still renders the healthy sibling cards alongside the malformed one', () => {
    renderDashboard([malformedPc, completePc]);
    expect(screen.getByText('Kaelen')).toBeTruthy();
    expect(screen.getByText('Nameless Wanderer')).toBeTruthy();
  });
});

describe('#106 — PC cards use the ENTITY_TYPE_CONFIG teal accent, not hardcoded amber', () => {
  it('derives the card accent from the playerCharacter entity color', () => {
    renderDashboard([completePc]);
    const color = ENTITY_TYPE_CONFIG['playerCharacter'].color; // 'teal'

    const card = screen.getByText('Kaelen').closest('button')!;
    expect(card).toBeTruthy();
    expect(card.className).toContain(`border-l-${color}-`);
    expect(card.className).not.toMatch(/border-l-amber-/);

    // The name heading and the species chip must follow the same accent. The PC
    // is 100% complete, so the completeness dot is green — no legitimate amber
    // is expected anywhere inside this card.
    expect(screen.getByText('Kaelen').className).toContain(`text-${color}-`);
    expect(card.outerHTML).not.toMatch(/amber/);
  });
});
