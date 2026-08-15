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
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
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

/**
 * wp-j-types-utils — finding #63 (editor half)
 *
 * PlayerCharacterEditor is the PC's only delete affordance (handleDelete),
 * so it must survive a PC that is missing `characterStatistics` entirely —
 * not just a partial one. Verifier probe that proved the crash (deleted,
 * repo left clean): rendering `{ id, playerName, characterSocial: {
 * characterName: 'Ghost' } }` threw `TypeError: Cannot read properties of
 * undefined (reading 'classes')` at line 131
 * (`formData.characterStatistics.classes.charClass`), and every other
 * unguarded read (attributes, skills, characterSocial.*) was equally
 * reachable. Already-persisted malformed PCs cannot be fixed by create-time
 * normalization alone, so the editor itself must normalize what it renders.
 */
const pcMissingEverything = {
  id: 'pc-ghost',
  playerName: 'Riley',
  characterSocial: { characterName: 'Ghost' },
  // characterStatistics omitted entirely — the worst case the dashboard
  // fix (#106/#63) already defends against; the editor must too.
} as unknown as PlayerCharacter;

describe('#63 — PlayerCharacterEditor survives a PC missing characterStatistics entirely', () => {
  it('renders header, stats, skills and social sections without throwing', () => {
    expect(() =>
      render(
        <ConfirmDialogProvider>
          <PlayerCharacterEditor pc={pcMissingEverything} onUpdate={() => {}} onDelete={() => {}} />
        </ConfirmDialogProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByText('Ghost')).toBeTruthy();
    expect(screen.getByText('Ability Scores')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('Social Traits')).toBeTruthy();
  });

  it('the delete confirmation still works and reaches onDelete (the entity remains deletable)', async () => {
    const onDelete = vi.fn();
    render(
      <ConfirmDialogProvider>
        <PlayerCharacterEditor pc={pcMissingEverything} onUpdate={() => {}} onDelete={onDelete} />
      </ConfirmDialogProvider>,
    );

    fireEvent.click(screen.getByText('Delete Character'));
    // The confirm dialog's message must not have crashed building the
    // fallback name (formData.characterSocial.characterName || pc.playerName).
    expect(await screen.findByText('Are you sure you want to delete Ghost?')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('pc-ghost'));
  });
});
