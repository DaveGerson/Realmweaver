// @vitest-environment jsdom
/**
 * L8 New-DM Onboarding — App-level wiring of the Welcome screen's secondary
 * paths: "start from a template" (auto-loads the chosen template in the
 * creator) and "Prep in 15 minutes the Lazy DM way" (lands the new campaign on
 * Tonight's Table).
 */

import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

const templateData = {
  title: "Winter's Daughter",
  setting: 'A frozen barrow on the edge of the moor.',
  settingType: 'custom',
  npcs: [{ id: 't-npc-1', name: 'Xiximanter', description: 'A draconic lich' }],
  locations: [],
  adventures: [],
};

vi.mock('../data/templates/index', () => ({
  getAllTemplateMeta: () => ([{
    id: 'winters-daughter',
    title: "Winter's Daughter",
    subtitle: 'Classic',
    description: 'A frozen barrow.',
    theme: 'Exploration',
    playstyle: 'Exploration',
    entityCounts: { npcs: 1, locations: 0, factions: 0, adventures: 0, scenes: 0, plots: 0 },
    fileName: 'winters-daughter.json',
  }]),
  loadTemplateData: async () => templateData,
}));

vi.mock('../services/campaignService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/campaignService')>();
  return { ...mod, campaignService: mod.createCampaignStore({ persist: false }) };
});

vi.mock('../smokeTest', () => ({ runSmokeTests: async () => {} }));
vi.mock('../services/aiService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/aiService')>();
  return { ...mod, analyzeWritingStyle: async () => null };
});

import App from '../App';
import { campaignService } from '../services/campaignService';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

afterEach(cleanup);

beforeEach(() => {
  for (const c of [...campaignService.getState().campaigns]) {
    act(() => { campaignService.deleteCampaign(c.id); });
  }
});

const tick = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const renderApp = () => render(
  <ToastProvider>
    <ConfirmDialogProvider>
      <App />
    </ConfirmDialogProvider>
  </ToastProvider>
);

describe('Welcome screen onboarding paths (App wiring)', () => {
  it('starting from a Welcome-screen template pre-fills the form and imports the template', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /start from template: winter's daughter/i }));
    await tick();

    expect(screen.getByRole('heading', { name: 'Create Your Campaign' })).toBeTruthy();
    expect((screen.getByPlaceholderText('The Sundered Crown') as HTMLInputElement).value).toBe("Winter's Daughter");

    fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
    await tick();

    const campaign = campaignService.getState().campaigns[0];
    expect(campaign.title).toBe("Winter's Daughter");
    expect(campaign.npcs.map(n => n.name)).toEqual(['Xiximanter']);
  });

  it('the Lazy DM path lands the new campaign on Tonight\'s Table', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /prep in 15 minutes the lazy dm way/i }));
    await tick();

    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.change(screen.getByPlaceholderText('The Sundered Crown'), { target: { value: 'Quick Night' } });
    fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
    await tick();

    expect(await screen.findByRole('heading', { level: 1, name: /tonight's table/i })).toBeTruthy();
  });

  it('the primary CTA keeps the default landing view', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /create a campaign/i }));
    await tick();
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.change(screen.getByPlaceholderText('The Sundered Crown'), { target: { value: 'Slow Burn' } });
    fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
    await tick();

    expect(screen.queryByRole('heading', { level: 1, name: /tonight's table/i })).toBeNull();
  });
});
