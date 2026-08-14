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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('never re-introduces dynamic border-l-${PC_COLOR}-* template literals in source', () => {
    // The prior #106 fix used fully dynamic template literals
    // (`border-l-${PC_COLOR}-500` etc.). This project compiles Tailwind at
    // build time via @tailwindcss/vite (index.css does `@import
    // "tailwindcss"`), not the old CDN JIT scanner, so a class name that
    // only ever exists as `${...}-500` in source is never emitted into the
    // compiled stylesheet — jsdom className checks above cannot catch this
    // because jsdom doesn't run the Tailwind build. Assert directly against
    // the source text instead: every accent class must appear as a literal
    // string, and no dynamic `${PC_COLOR}`-style interpolation may appear
    // inside a Tailwind class position.
    const rawSource = readFileSync(
      resolve(__dirname, '../../components/dashboards/PlayerCharacterDashboard.tsx'),
      'utf-8',
    );
    // Strip comments before scanning so a doc comment that *explains* the
    // dynamic-interpolation pitfall (and necessarily quotes the pattern) is
    // not itself flagged as the regression it's warning about.
    const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const color = ENTITY_TYPE_CONFIG['playerCharacter'].color; // 'teal'

    // No dynamic color interpolation left in a Tailwind class literal.
    expect(source).not.toMatch(/border-l-\$\{/);
    expect(source).not.toMatch(/text-\$\{/);
    expect(source).not.toMatch(/bg-\$\{/);

    // The literal classes the Tailwind scanner needs to see must be present
    // verbatim in source, for whatever color ENTITY_TYPE_CONFIG currently
    // assigns to playerCharacter.
    expect(source).toContain(`border-l-${color}-500`);
    expect(source).toContain(`hover:border-l-${color}-400`);
    expect(source).toContain(`text-${color}-400`);
    expect(source).toContain(`bg-${color}-900/40`);
    expect(source).toContain(`text-${color}-300`);
    expect(source).toContain(`border-${color}-500/30`);
  });
});
