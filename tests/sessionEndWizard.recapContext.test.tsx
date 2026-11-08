// @vitest-environment jsdom
/**
 * SessionEndWizard hands the recap generator the campaign's real context, so
 * Secrets & Clues reveal state informs what the recap says and what the player
 * version leaves out.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../hooks/useToast';
import {
  OFFSCENE_NPC_ID,
  OFFSCENE_UNREVEALED_SECRET,
  REVEALED_SECRET,
  SCENE_UNREVEALED_SECRET,
  makeLoadedCampaign,
  secretLine,
} from './services/partyKnowledgeFixtures';

const h = vi.hoisted(() => ({
  generateSessionRecap: vi.fn(async (..._args: unknown[]) => ({
    recap: 'The recap.',
    looseEnds: [],
    playerFacingRecap: 'The player recap.',
  })),
}));

vi.mock('../services/aiService', () => ({ generateSessionRecap: h.generateSessionRecap }));
vi.mock('../services/campaignService', () => ({
  campaignService: { updateSessionLog: vi.fn(), endSession: vi.fn() },
}));

import { SessionEndWizard } from '../components/dialogs/SessionEndWizard';

afterEach(() => {
  cleanup();
  h.generateSessionRecap.mockClear();
});

describe('SessionEndWizard recap generation', () => {
  it('sends the campaign context with reveal state on the one recap request', async () => {
    const campaign = makeLoadedCampaign();

    render(
      <ToastProvider>
        <SessionEndWizard
          campaign={campaign}
          sessionLog={campaign.sessionLogs[0]}
          isMockMode={true}
          onComplete={() => {}}
          onCancel={() => {}}
        />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate AI Recap/i }));

    await waitFor(() => expect(h.generateSessionRecap).toHaveBeenCalledTimes(1));

    const [, , context, isMockMode] = h.generateSessionRecap.mock.calls[0];
    expect(context).toContain(secretLine(REVEALED_SECRET));
    expect(context).toContain(secretLine(SCENE_UNREVEALED_SECRET));
    expect(isMockMode).toBe(true);
  });

  // The live session's Stage is part of what the table did; the builder only
  // reads it when it is told which session is live.
  it('includes the live session\'s Stage and the secrets of whoever is on it', async () => {
    const loaded = makeLoadedCampaign();
    const campaign = {
      ...loaded,
      sessionLogs: [{ ...loaded.sessionLogs[0], stage: { npcIds: [OFFSCENE_NPC_ID], place: 'The Salt Docks' } }],
    };

    render(
      <ToastProvider>
        <SessionEndWizard
          campaign={campaign}
          sessionLog={campaign.sessionLogs[0]}
          isMockMode={true}
          onComplete={() => {}}
          onCancel={() => {}}
        />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate AI Recap/i }));

    await waitFor(() => expect(h.generateSessionRecap).toHaveBeenCalledTimes(1));

    const [, , context] = h.generateSessionRecap.mock.calls[0];
    expect(context).toContain('On Stage Now:');
    expect(context).toContain('The Salt Docks');
    expect(context).toContain(secretLine(OFFSCENE_UNREVEALED_SECRET));
  });
});
