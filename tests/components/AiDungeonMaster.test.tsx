// @vitest-environment jsdom
import React, { useState, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AiDungeonMaster } from '../../components/views/AiDungeonMaster';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';
import { createDungeonMasterState } from '../../services/rules/engine';
import { demoParty } from '../../services/rules/characters';
import type {
  Campaign,
  DmProposal,
  DungeonMasterState,
} from '../../types/index';

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  propose: vi.fn(),
  narrate: vi.fn(),
}));
vi.mock('../../services/campaignService', () => ({
  campaignService: { commitDungeonMaster: mocks.commit },
}));
vi.mock('../../services/aiService', () => ({
  proposeDungeonMasterTurn: mocks.propose,
  narrateDungeonMasterResolution: mocks.narrate,
}));

function campaign(state?: DungeonMasterState): Campaign {
  return {
    id: 'campaign',
    title: 'Test adventure',
    settingType: 'custom',
    setting: 'A frontier town',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    dungeonMaster: state,
  };
}
function Harness({ initial = campaign() }: { initial?: Campaign }) {
  const [current, setCurrent] = useState(initial);
  const currentRef = useRef(initial);
  mocks.commit.mockImplementation(
    (id: string, revision: number, state: DungeonMasterState) => {
      if (
        id !== currentRef.current.id ||
        revision !== (currentRef.current.dungeonMaster?.revision ?? 0)
      )
        return false;
      currentRef.current = { ...currentRef.current, dungeonMaster: state };
      setCurrent(currentRef.current);
      return true;
    },
  );
  return (
    <ConfirmDialogProvider>
      <AiDungeonMaster campaign={current} isMockMode />
    </ConfirmDialogProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.propose.mockResolvedValue({
    narration: 'You search the room.',
    action: {
      kind: 'check',
      actorId: 'demo-warden',
      ability: 'wisdom',
      skill: 'perception',
      dc: 15,
    },
    rulePages: [6],
    needsRuling: null,
    suggestedOptions: [],
  } satisfies DmProposal);
  mocks.narrate.mockResolvedValue(
    'The resolved scene continues. What do you do next?',
  );
});
afterEach(cleanup);

describe('AI Dungeon Master UI and asynchronous lifecycle', () => {
  it('starts the demo and displays a mechanically resolved, cited turn followed by narration', async () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Start playable demo' }),
    );
    fireEvent.change(screen.getByLabelText('What do you do?'), {
      target: { value: 'I search the room.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to DM' }));
    await screen.findByText(
      'The resolved scene continues. What do you do next?',
    );
    expect(screen.getByRole('log').textContent).toContain('perception');
    expect(screen.getByRole('log').textContent).toContain('vs 15');
    expect(
      screen.getByRole('link', { name: 'SRD p. 6' }).getAttribute('href'),
    ).toContain('#page=6');
    expect(mocks.narrate).toHaveBeenCalledOnce();
  });
  it('preserves the accepted roll if outcome narration fails', async () => {
    mocks.narrate.mockRejectedValue(new Error('Provider unavailable'));
    render(
      <Harness initial={campaign(createDungeonMasterState(demoParty()))} />,
    );
    fireEvent.change(screen.getByLabelText('What do you do?'), {
      target: { value: 'Search.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to DM' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain(
      'action was applied',
    );
    expect(screen.getByRole('log').textContent).toContain('vs 15');
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it('discards a proposal that finishes after the campaign view unmounts', async () => {
    let finish!: (p: DmProposal) => void;
    mocks.propose.mockImplementation(
      () =>
        new Promise<DmProposal>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(
      <Harness initial={campaign(createDungeonMasterState(demoParty()))} />,
    );
    fireEvent.change(screen.getByLabelText('What do you do?'), {
      target: { value: 'Search.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to DM' }));
    await waitFor(() => expect(mocks.propose).toHaveBeenCalledOnce());
    view.unmount();
    finish({
      narration: 'No change.',
      action: null,
      rulePages: [],
      needsRuling: null,
      suggestedOptions: [],
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('reports malformed saved state without crashing the view', () => {
    render(<Harness initial={campaign({ schemaVersion: 999 } as never)} />);
    expect(screen.getByRole('alert').textContent).toContain(
      'unsupported schema',
    );
    expect(
      screen.getByRole('heading', { name: 'AI Dungeon Master' }),
    ).toBeDefined();
  });
  it('validates creature edits before committing them', async () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Creatures & rulings' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add creature' }));
    fireEvent.change(screen.getByLabelText('Maximum HP'), {
      target: { value: '-5' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save reviewed statistics' }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'maximum HP',
    );
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
