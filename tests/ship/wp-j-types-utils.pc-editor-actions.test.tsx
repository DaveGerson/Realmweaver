// @vitest-environment jsdom
/**
 * wp-j-types-utils — finding #34 (UI half)
 *
 * PlayerCharacterEditor.tsx:241-242 does
 *   formData.characterStatistics.actions.map(...)
 *   formData.characterStatistics.specialActions.map(...)
 * with no guard, while the PDF-parse schema
 * (services/ai/evocationWizard.ts:8) only requires
 * ['classes','attributes','skills'] — so a sheet whose Features & Traits page
 * is blank produces a PC with no `specialActions`. The PC is already persisted
 * by the time it is opened, so the campaign ends up containing a character
 * that can never be viewed: the editor throws and the ErrorBoundary blanks it.
 *
 * Contract: the editor renders a PC whose actions/specialActions are missing
 * (already-persisted legacy data cannot be fixed by create-time normalization
 * alone) — it shows the Actions & Features section empty rather than throwing.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { PlayerCharacter } from '../../types/index';

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { PlayerCharacterEditor } = await import('../../components/editors/PlayerCharacterEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

/** A PC parsed from a sheet with a blank Features & Traits page. */
const pcMissingActions = {
  id: 'pc-1',
  playerName: 'Dana',
  characterSocial: {
    characterName: 'Kaelen', background: 'Soldier', species: 'Human',
    personality: '', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
  },
  characterStatistics: {
    classes: { charClass: 'Fighter', level: 3 },
    attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
    skills: {},
    // actions and specialActions omitted by the model
  },
} as unknown as PlayerCharacter;

describe('#34 — PlayerCharacterEditor survives a PC with no actions/specialActions', () => {
  it('renders the character instead of throwing', () => {
    expect(() =>
      render(
        <ConfirmDialogProvider>
          <PlayerCharacterEditor pc={pcMissingActions} onUpdate={() => {}} onDelete={() => {}} />
        </ConfirmDialogProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByText('Kaelen')).toBeTruthy();
    expect(screen.getByText('Actions & Features')).toBeTruthy();
  });
});
