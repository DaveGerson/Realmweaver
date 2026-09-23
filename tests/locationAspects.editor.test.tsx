// @vitest-environment jsdom
/**
 * SPEC — Fantastic Location Aspects, the editor half (Sly Flourish's Lazy DM
 * step 5, "develop fantastic locations": two or three evocative sensory
 * one-liners, lighter than a paragraph). File under test:
 * `components/editors/LocationEditor.tsx`'s "Aspects" section.
 *
 * CONTRACT
 * 1. Existing aspects render as a removable list; removing the LAST one
 *    commits `{ aspects: undefined }` — never `{ aspects: [] }`
 *    (types/Location.ts: an empty list is absent, not an empty array).
 * 2. Typing into the add input and pressing Enter (or clicking Add) appends
 *    a trimmed aspect and commits the merged array. A blank/whitespace-only
 *    entry is a no-op.
 * 3. The list is capped at four entries — the add row and the "Suggest
 *    aspects" button both disable once the cap is reached.
 * 4. "Suggest aspects" is zero-typed-prompt: the request is built entirely
 *    from the location's own name/description (plus isMockMode and the
 *    caller's campaignContext) — never a text box the GM edits. The result
 *    merges into the existing list, deduplicated and capped at four, and
 *    commits through the same `onUpdate(id, { aspects })` pattern.
 * 5. A failed suggestion surfaces a visible inline error (role="alert"), not
 *    just a console.error (matching the "generate here" error contract
 *    pinned by wp-f2-entity-editors.generate-here-errors.test.tsx).
 * 6. An empty suggestion result surfaces a message rather than doing nothing.
 * 7. Editors are not remounted when the GM navigates between entities of the
 *    same type (components/CLAUDE.md) — a suggestion that resolves AFTER the
 *    GM has navigated to a different location must never be written into the
 *    now-displayed location.
 *
 * No jest-dom in this repo (there is no vitest setup file, and the package is
 * not a dependency) — plain DOM property reads instead, matching
 * tests/ship/wp-f2-entity-editors.*'s convention.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react';
import type { Campaign, Location } from '../types/index';

const generateLocationAspects = vi.fn<(...args: unknown[]) => Promise<string[]>>();
vi.mock('../services/aiService', () => ({
  generateNpc: vi.fn(),
  generatePoiFromLoot: vi.fn(),
  generateEnhancedText: vi.fn(),
  generateLocationAspects: (...args: unknown[]) => generateLocationAspects(...args),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../services/campaignService', () => ({
  campaignService: {
    createNpc: vi.fn(() => 'npc-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { LocationEditor } = await import('../components/editors/LocationEditor');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

afterEach(() => {
  generateLocationAspects.mockReset();
  cleanup();
});

const baseLocation = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1',
  name: 'The Sunken Ward',
  description: 'A flooded district.',
  secrets: '',
  subLocationIds: [],
  connections: [],
  pointsOfInterest: [],
  loot: [],
  history: [],
  ...overrides,
});

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function renderEditor(location: Location, onUpdate = vi.fn<(id: string, updates: Partial<Location>) => void>()) {
  render(
    <ConfirmDialogProvider>
      <LocationEditor
        location={location}
        allLocations={[location]}
        campaign={campaign}
        onUpdate={onUpdate}
        onDelete={() => {}}
        isMockMode={false}
      />
    </ConfirmDialogProvider>,
  );
  return { onUpdate };
}

const suggestButton = () => screen.getByRole('button', { name: /suggest aspects/i }) as HTMLButtonElement;
const lastCallOf = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls[mock.mock.calls.length - 1];

// ---------------------------------------------------------------------------
// 1-2. The list itself: render, add, remove
// ---------------------------------------------------------------------------

describe('LocationEditor — the Aspects list', () => {
  it('renders existing aspects', () => {
    renderEditor(baseLocation({ aspects: ['A damp draft hums through the cracks.'] }));

    expect(screen.getByText('A damp draft hums through the cracks.')).toBeTruthy();
  });

  it('removing the LAST aspect commits aspects: undefined, never an empty array', () => {
    const { onUpdate } = renderEditor(baseLocation({ aspects: ['Only aspect.'] }));

    fireEvent.click(screen.getByRole('button', { name: /remove aspect: only aspect/i }));

    const call = lastCallOf(onUpdate);
    expect(call[0]).toBe('loc-1');
    expect(call[1]).toHaveProperty('aspects');
    expect(call[1].aspects).toBeUndefined();
  });

  it('removing one of several aspects commits the remaining array', () => {
    const { onUpdate } = renderEditor(baseLocation({ aspects: ['Keep me.', 'Remove me.'] }));

    fireEvent.click(screen.getByRole('button', { name: /remove aspect: remove me/i }));

    expect(onUpdate).toHaveBeenCalledWith('loc-1', { aspects: ['Keep me.'] });
  });

  it('adding an aspect via Enter commits the merged, trimmed array and clears the input', () => {
    const { onUpdate } = renderEditor(baseLocation({ aspects: ['Existing one.'] }));

    const input = screen.getByLabelText('New aspect') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  A new aspect.  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('loc-1', { aspects: ['Existing one.', 'A new aspect.'] });
    expect(input.value).toBe('');
  });

  it('the Add button stays disabled for a blank entry and adds a trimmed one when clicked', () => {
    const { onUpdate } = renderEditor(baseLocation({}));

    const input = screen.getByLabelText('New aspect') as HTMLInputElement;
    const addButton = screen.getByRole('button', { name: /^add$/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '   ' } });
    expect(addButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '  A trimmed aspect.  ' } });
    expect(addButton.disabled).toBe(false);
    fireEvent.click(addButton);

    expect(onUpdate).toHaveBeenCalledWith('loc-1', { aspects: ['A trimmed aspect.'] });
  });

  it('hides the add row and disables Suggest once four aspects exist', () => {
    renderEditor(baseLocation({ aspects: ['One', 'Two', 'Three', 'Four'] }));

    expect(screen.queryByLabelText('New aspect')).toBeNull();
    expect(suggestButton().disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3-4. Suggest aspects — zero-typed-prompt, merge, dedupe, cap
// ---------------------------------------------------------------------------

describe('LocationEditor — Suggest aspects (zero-typed-prompt AI)', () => {
  it('calls the facade with only name/description — no typed prompt reaches it', async () => {
    generateLocationAspects.mockResolvedValue(['A brand new aspect.']);
    renderEditor(baseLocation({ aspects: [] }));

    fireEvent.click(suggestButton());

    await waitFor(() => expect(generateLocationAspects).toHaveBeenCalledTimes(1));
    expect(generateLocationAspects).toHaveBeenCalledWith(
      { name: 'The Sunken Ward', description: 'A flooded district.' },
      false,
      undefined,
    );
  });

  it('merges the suggestion into the existing list, deduplicated, and commits it', async () => {
    generateLocationAspects.mockResolvedValue(['Existing one.', 'Brand new aspect.']);
    const { onUpdate } = renderEditor(baseLocation({ aspects: ['Existing one.'] }));

    fireEvent.click(suggestButton());

    await waitFor(() => {
      const call = lastCallOf(onUpdate);
      expect(call?.[1]?.aspects).toEqual(['Existing one.', 'Brand new aspect.']);
    });
    expect(await screen.findByText('Brand new aspect.')).toBeTruthy();
  });

  it('caps the merged result at four entries', async () => {
    generateLocationAspects.mockResolvedValue(['New A', 'New B', 'New C']);
    const { onUpdate } = renderEditor(baseLocation({ aspects: ['One', 'Two'] }));

    fireEvent.click(suggestButton());

    await waitFor(() => {
      const call = lastCallOf(onUpdate);
      expect(call?.[1]?.aspects).toEqual(['One', 'Two', 'New A', 'New B']);
    });
  });

  it('shows a visible inline error when the suggestion rejects (not just console.error)', async () => {
    generateLocationAspects.mockRejectedValue(new Error('proxy 500'));
    renderEditor(baseLocation({}));

    fireEvent.click(suggestButton());

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent || '').toMatch(/fail|error|try again/i);
    });
  });

  it('shows a message rather than doing nothing when the suggestion comes back empty', async () => {
    generateLocationAspects.mockResolvedValue([]);
    renderEditor(baseLocation({}));

    fireEvent.click(suggestButton());

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent || '').toMatch(/nothing came back|by hand/i);
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Editors are not remounted — a stale suggestion must not land on the
//    wrong entity after the GM navigates away while it is in flight.
// ---------------------------------------------------------------------------

describe('LocationEditor — Suggest aspects survives navigating away mid-request', () => {
  it('discards a suggestion that resolves after the GM has switched to a different location', async () => {
    let resolveSuggestion: (value: string[]) => void = () => {};
    generateLocationAspects.mockImplementation(
      () => new Promise<string[]>(resolve => { resolveSuggestion = resolve; }),
    );

    const locationA = baseLocation({ id: 'loc-a', name: 'Location A', aspects: [] });
    const locationB = baseLocation({ id: 'loc-b', name: 'Location B', aspects: [] });
    const onUpdate = vi.fn<(id: string, updates: Partial<Location>) => void>();

    const { rerender } = render(
      <ConfirmDialogProvider>
        <LocationEditor
          location={locationA}
          allLocations={[locationA, locationB]}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={() => {}}
          isMockMode={false}
        />
      </ConfirmDialogProvider>,
    );

    fireEvent.click(suggestButton());
    await waitFor(() => expect(generateLocationAspects).toHaveBeenCalledTimes(1));

    // Same mounted editor, new entity — exactly how ViewRouter navigates
    // between two locations of the same type (no remount, no key change).
    rerender(
      <ConfirmDialogProvider>
        <LocationEditor
          location={locationB}
          allLocations={[locationA, locationB]}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={() => {}}
          isMockMode={false}
        />
      </ConfirmDialogProvider>,
    );

    resolveSuggestion(['A stale suggestion for location A.']);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onUpdate).not.toHaveBeenCalledWith('loc-a', expect.anything());
    expect(screen.queryByText('A stale suggestion for location A.')).toBeNull();
  });
});
