// @vitest-environment jsdom
/**
 * L8 New-DM Onboarding — WelcomeScreen value explainer + template path,
 * and CampaignCreator seed-question scaffolding for the Custom World textarea.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react';

const templateData = {
  title: 'The Sunken Vault',
  setting: 'A frontier village above imperial ruins.',
  npcs: [{ id: 'n1', name: 'Lich' }],
};

const loadTemplateData = vi.fn(async (_id: string) => templateData);

vi.mock('../../data/templates/index', () => ({
  getAllTemplateMeta: () => ([
    {
      id: 'dungeon-crawl',
      title: 'The Sunken Vault',
      subtitle: 'Classic Dungeon Crawl',
      description: 'Delve into imperial ruins.',
      theme: 'Dungeon',
      playstyle: 'Combat & Exploration',
      entityCounts: { npcs: 3, locations: 3, factions: 0, adventures: 1, scenes: 4, plots: 0 },
      fileName: 'dungeon-crawl.json',
    },
    {
      id: 'one-shot',
      title: 'The Festival of Shadows',
      subtitle: 'One-Shot Adventure',
      description: 'A harvest festival turns sinister.',
      theme: 'Folk Horror',
      playstyle: 'One-Shot',
      entityCounts: { npcs: 3, locations: 2, factions: 0, adventures: 1, scenes: 5, plots: 0 },
      fileName: 'one-shot.json',
    },
  ]),
  loadTemplateData: (id: string) => loadTemplateData(id),
}));

import { WelcomeScreen } from '../../components/views/WelcomeScreen';
import {
  CampaignCreator,
  SEED_QUESTIONS,
  appendSeedQuestion,
} from '../../components/views/CampaignCreator';

afterEach(() => {
  cleanup();
  loadTemplateData.mockClear();
});

const flush = async () => {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
};

describe('WelcomeScreen first-run experience', () => {
  it('renders a main landmark, h1, and the three-step value explainer', () => {
    render(<WelcomeScreen onStart={() => {}} />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: /welcome to realmweaver/i })).toBeTruthy();
    for (const title of [/build your world/i, /prep sessions/i, /run the table/i]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeTruthy();
    }
  });

  it('keeps exactly one "Create a Campaign" primary CTA wired to onStart', () => {
    const onStart = vi.fn();
    render(<WelcomeScreen onStart={onStart} />);
    const ctas = screen.getAllByRole('button', { name: /create a campaign/i });
    expect(ctas).toHaveLength(1);
    fireEvent.click(ctas[0]);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('lists starter templates from the shared registry and starts from the chosen one', () => {
    const onStart = vi.fn();
    const onStartFromTemplate = vi.fn();
    render(<WelcomeScreen onStart={onStart} onStartFromTemplate={onStartFromTemplate} />);
    const section = screen.getByRole('region', { name: /or start from a template/i });
    const buttons = within(section).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(within(section).getByRole('button', { name: /festival of shadows/i }));
    expect(onStartFromTemplate).toHaveBeenCalledWith('one-shot');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('falls back to onStart when no template handler is provided', () => {
    const onStart = vi.fn();
    render(<WelcomeScreen onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /start from template: the sunken vault/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('offers the Lazy DM path only when wired, without clashing with the primary CTA', () => {
    const { rerender } = render(<WelcomeScreen onStart={() => {}} />);
    expect(screen.queryByRole('button', { name: /lazy dm way/i })).toBeNull();
    const onStartLazy = vi.fn();
    rerender(<WelcomeScreen onStart={() => {}} onStartLazy={onStartLazy} />);
    fireEvent.click(screen.getByRole('button', { name: /prep in 15 minutes the lazy dm way/i }));
    expect(onStartLazy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: /create a campaign/i })).toHaveLength(1);
  });

  it('shows the mock-mode hint only in mock mode', () => {
    const { rerender } = render(<WelcomeScreen onStart={() => {}} isMockMode={false} />);
    expect(screen.queryByText(/mock mode is on/i)).toBeNull();
    rerender(<WelcomeScreen onStart={() => {}} isMockMode />);
    expect(screen.getByText(/mock mode is on/i)).toBeTruthy();
  });
});

describe('CampaignCreator initialTemplateId', () => {
  it('auto-loads the template picked on the Welcome screen and lands on the form', async () => {
    const onTemplateSelected = vi.fn();
    render(
      <CampaignCreator
        onCreateCampaign={() => {}}
        onTemplateSelected={onTemplateSelected}
        initialTemplateId="dungeon-crawl"
      />
    );
    await flush();
    expect(loadTemplateData).toHaveBeenCalledTimes(1);
    expect(loadTemplateData).toHaveBeenCalledWith('dungeon-crawl');
    expect(onTemplateSelected).toHaveBeenCalledWith(templateData);
    expect(screen.getByRole('heading', { name: 'Create Your Campaign' })).toBeTruthy();
    expect((screen.getByPlaceholderText('The Sundered Crown') as HTMLInputElement).value).toBe('The Sunken Vault');
  });

  it('starts on the template picker without an initial template', () => {
    render(<CampaignCreator onCreateCampaign={() => {}} />);
    expect(screen.getByRole('heading', { name: /start with a template/i })).toBeTruthy();
    expect(loadTemplateData).not.toHaveBeenCalled();
  });
});

describe('CampaignCreator seed questions', () => {
  const openCustomForm = () => {
    render(<CampaignCreator onCreateCampaign={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.click(screen.getByRole('radio', { name: /custom world/i }));
    return screen.getByLabelText(/world setting description/i) as HTMLTextAreaElement;
  };

  it('appendSeedQuestion puts each stub on its own line', () => {
    expect(appendSeedQuestion('', "What's the tone?")).toBe("What's the tone? ");
    expect(appendSeedQuestion('Grim.  \n', "What's the tone?")).toBe("Grim.\nWhat's the tone? ");
  });

  it('is hidden for official settings and shown for Custom World', () => {
    render(<CampaignCreator onCreateCampaign={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    expect(screen.queryByRole('group', { name: /seed questions/i })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /custom world/i }));
    const group = screen.getByRole('group', { name: /seed questions/i });
    expect(within(group).getAllByRole('button')).toHaveLength(SEED_QUESTIONS.length);
  });

  it('inserts question stubs into the textarea', () => {
    const textarea = openCustomForm();
    fireEvent.click(screen.getByRole('button', { name: /central conflict/i }));
    expect(textarea.value).toBe("What's the central conflict? ");
    fireEvent.change(textarea, { target: { value: textarea.value + 'A shattered crown.' } });
    fireEvent.click(screen.getByRole('button', { name: /what's the tone/i }));
    expect(textarea.value).toBe("What's the central conflict? A shattered crown.\nWhat's the tone? ");
  });

  it('shows a live character count and a quality nudge that improves with length', () => {
    const textarea = openCustomForm();
    expect(screen.getByTestId('setting-char-count').textContent).toBe('0 characters');
    expect(screen.getByTestId('setting-quality-nudge').textContent).toMatch(/seed question/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(120) } });
    expect(screen.getByTestId('setting-char-count').textContent).toBe('120 characters');
    expect(screen.getByTestId('setting-quality-nudge').textContent).toMatch(/good start/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(400) } });
    expect(screen.getByTestId('setting-quality-nudge').textContent).toMatch(/plenty of detail/i);
  });

  it('offers a collapsible "What good looks like" example', () => {
    openCustomForm();
    const summary = screen.getByText(/what good looks like/i);
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it('does not change the creation contract', () => {
    const onCreate = vi.fn();
    render(<CampaignCreator onCreateCampaign={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.change(screen.getByPlaceholderText('The Sundered Crown'), { target: { value: 'Salt Crown' } });
    fireEvent.click(screen.getByRole('radio', { name: /custom world/i }));
    fireEvent.click(screen.getByRole('button', { name: /first adventure hook/i }));
    fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
    expect(onCreate).toHaveBeenCalledWith(
      'Salt Crown',
      "What's the first adventure hook? ",
      'custom',
      undefined,
      'standard'
    );
  });
});
