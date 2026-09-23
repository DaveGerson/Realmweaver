// @vitest-environment jsdom
/**
 * SPEC — components/tools/SecretsTracker.tsx (Wave 1, lane R4: "here now")
 *
 * A DM mid-scene should not scroll a flat list to find what is deployable in
 * the room. The tracker gains ONE extra filter, and it earns its place only
 * while a scene is actually live.
 *
 * 1. **It exists only when a scene is live.** The tracker resolves
 *    `campaign.activeSceneId` against every scene of every adventure in the
 *    campaign. If there is no `activeSceneId`, or the id resolves to nothing
 *    (a stale id, a campaign with no adventures), the control is not rendered
 *    at all — not disabled, not empty, absent. The rest of the tracker behaves
 *    exactly as it did before.
 *
 * 2. **It is a toggle, and it starts off.** When a scene is live the control
 *    renders as a button whose accessible name contains the phrase "here now"
 *    (e.g. "Here now") — a constant label, since state is carried by
 *    `aria-pressed` rather than by relabelling — and whose
 *    `aria-pressed` is "false" on mount, so the tracker opens showing
 *    everything, as it always has. Pressing it sets `aria-pressed` to "true".
 *
 * 3. **On, it narrows to the room.** A secret survives the filter when its
 *    `linkedEntityIds` intersects the live scene's `npcIds` or its
 *    `locationId`. A secret linked to nothing, linked only to entities that
 *    are elsewhere, or carrying no `linkedEntityIds` at all, is hidden. A
 *    scene with an empty cast and no location matches nothing — and says so
 *    through the existing "no entries match" empty state, never a crash.
 *
 * 4. **It composes, it does not replace.** The category tabs and the
 *    show/hide-revealed toggle keep working underneath it; all three are
 *    ANDed. Switching category tabs does not silently clear it, and pressing
 *    it again restores the full list.
 *
 * 5. **It is a lens, not an edit.** Toggling the filter writes nothing to the
 *    store — no secret is revealed, updated, created, or deleted by looking.
 *
 * 6. Slate/amber only: indigo belongs to RealmChat and appears nowhere here.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign } from '../types/index';

const h = vi.hoisted(() => ({
  createSecret: vi.fn(),
  updateSecret: vi.fn(),
  revealSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    createSecret: h.createSecret,
    updateSecret: h.updateSecret,
    revealSecret: h.revealSecret,
    deleteSecret: h.deleteSecret,
  },
}));

const { SecretsTracker } = await import('../components/tools/SecretsTracker');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

// --- Fixture -------------------------------------------------------------
//
// The live scene is `scene-live`, and it deliberately lives in the SECOND
// adventure: resolution must walk every adventure, not just the first.

const scene = (over: Record<string, unknown>) => ({
  id: 'scene-x',
  title: 'A scene',
  type: 'social',
  status: 'in-progress',
  readAloudText: '',
  gmNotes: '',
  skillChecks: [],
  rewards: '',
  npcIds: [],
  ...over,
});

const secret = (over: Record<string, unknown>) => ({
  id: 's-x',
  title: 'A secret',
  content: 'Content.',
  category: 'secret',
  isRevealed: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

const TITLES = {
  hereNpc: 'Marla wears a borrowed face',
  hereLocation: 'The lantern room hides a portal',
  hereMulti: 'Bram owes the tide cult a death',
  elsewhere: 'The Far Keep is one long tomb',
  unlinked: 'A prophecy with nothing to anchor it',
  revealedHere: 'The tide has already turned once',
};

const baseCampaign = () => ({
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [
    { id: 'npc-1', name: 'Marla Tidebinder' },
    { id: 'npc-2', name: 'Bram Coldwater' },
    { id: 'npc-3', name: 'Otto Offstage' },
  ],
  locations: [
    { id: 'loc-1', name: 'The Salt Lantern' },
    { id: 'loc-9', name: 'The Far Keep' },
  ],
  factions: [{ id: 'fac-1', name: 'The Tide Cult' }],
  items: [],
  adventures: [
    {
      id: 'adv-1',
      title: 'Last week',
      scenes: [scene({ id: 'scene-old', npcIds: ['npc-3'], locationId: 'loc-9' })],
    },
    {
      id: 'adv-2',
      title: 'Tonight',
      scenes: [
        scene({ id: 'scene-live', title: 'The Salt Lantern', npcIds: ['npc-1', 'npc-2'], locationId: 'loc-1' }),
        scene({ id: 'scene-later', npcIds: [], locationId: 'loc-9' }),
      ],
    },
  ],
  articles: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  activeSceneId: 'scene-live',
  secrets: [
    secret({ id: 's-1', title: TITLES.hereNpc, category: 'secret', linkedEntityIds: ['npc-1'] }),
    secret({ id: 's-2', title: TITLES.hereLocation, category: 'clue', linkedEntityIds: ['loc-1'] }),
    secret({ id: 's-3', title: TITLES.hereMulti, category: 'clue', linkedEntityIds: ['npc-2', 'fac-1'] }),
    secret({ id: 's-4', title: TITLES.elsewhere, category: 'secret', linkedEntityIds: ['npc-3', 'loc-9'] }),
    secret({ id: 's-5', title: TITLES.unlinked, category: 'rumor', linkedEntityIds: [] }),
    secret({
      id: 's-6',
      title: TITLES.revealedHere,
      category: 'revelation',
      isRevealed: true,
      linkedEntityIds: ['npc-1'],
    }),
  ],
});

const renderTracker = (over: Record<string, unknown> = {}) => {
  const campaign = { ...baseCampaign(), ...over } as unknown as Campaign;
  return render(
    <ConfirmDialogProvider>
      <SecretsTracker campaign={campaign} />
    </ConfirmDialogProvider>
  );
};

const hereNowToggle = () => screen.getByRole('button', { name: /here now/i });
const queryHereNowToggle = () => screen.queryByRole('button', { name: /here now/i });

/** Titles of the secret cards currently on screen, in DOM order. */
const visibleTitles = () =>
  Object.values(TITLES).filter(t => screen.queryByText(t) !== null);

beforeEach(() => {
  h.createSecret.mockClear();
  h.updateSecret.mockClear();
  h.revealSecret.mockClear();
  h.deleteSecret.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('SecretsTracker — the "here now" filter only exists while a scene is live', () => {
  it('renders no here-now control when the campaign has no active scene', () => {
    renderTracker({ activeSceneId: undefined });

    expect(queryHereNowToggle()).toBeNull();
    // Everything else is untouched.
    expect(visibleTitles()).toHaveLength(6);
  });

  it('renders no here-now control when activeSceneId resolves to no scene', () => {
    renderTracker({ activeSceneId: 'scene-that-was-deleted' });

    expect(queryHereNowToggle()).toBeNull();
    expect(visibleTitles()).toHaveLength(6);
  });

  it('renders no here-now control when the campaign has no adventures at all', () => {
    renderTracker({ adventures: [], activeSceneId: 'scene-live' });

    expect(queryHereNowToggle()).toBeNull();
  });

  it('renders the control when the active scene lives in a later adventure', () => {
    renderTracker();

    expect(queryHereNowToggle()).not.toBeNull();
  });
});

describe('SecretsTracker — the here-now filter defaults off', () => {
  it('opens unpressed, showing every secret', () => {
    renderTracker();

    expect(hereNowToggle().getAttribute('aria-pressed')).toBe('false');
    expect(visibleTitles()).toHaveLength(6);
  });

  it('reports pressed once engaged', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());

    expect(hereNowToggle().getAttribute('aria-pressed')).toBe('true');
  });
});

describe('SecretsTracker — the here-now filter narrows to the live scene', () => {
  it('keeps secrets linked to a scene NPC or the scene location, and drops the rest', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());

    expect(screen.queryByText(TITLES.hereNpc)).not.toBeNull();
    expect(screen.queryByText(TITLES.hereLocation)).not.toBeNull();
    expect(screen.queryByText(TITLES.hereMulti)).not.toBeNull();
    expect(screen.queryByText(TITLES.revealedHere)).not.toBeNull();

    expect(screen.queryByText(TITLES.elsewhere)).toBeNull();
    expect(screen.queryByText(TITLES.unlinked)).toBeNull();
  });

  it('drops a secret that carries no linkedEntityIds field at all', () => {
    renderTracker({
      secrets: [
        secret({ id: 's-legacy', title: 'A secret from an older save' }),
        secret({ id: 's-1', title: TITLES.hereNpc, linkedEntityIds: ['npc-1'] }),
      ],
    });

    fireEvent.click(hereNowToggle());

    expect(screen.queryByText('A secret from an older save')).toBeNull();
    expect(screen.queryByText(TITLES.hereNpc)).not.toBeNull();
  });

  it('restores the full list when pressed again', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    expect(visibleTitles()).toHaveLength(4);

    fireEvent.click(hereNowToggle());
    expect(visibleTitles()).toHaveLength(6);
    expect(hereNowToggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the existing empty state — not a crash — when the live scene has an empty cast and no location', () => {
    renderTracker({
      adventures: [
        { id: 'adv-2', title: 'Tonight', scenes: [scene({ id: 'scene-live', npcIds: [] })] },
      ],
    });

    fireEvent.click(hereNowToggle());

    expect(visibleTitles()).toHaveLength(0);
    expect(screen.queryByText(/no entries match the current filter/i)).not.toBeNull();
  });

  it('survives a campaign with no secrets array', () => {
    renderTracker({ secrets: undefined });

    expect(queryHereNowToggle()).not.toBeNull();
    fireEvent.click(hereNowToggle());
    expect(visibleTitles()).toHaveLength(0);
  });
});

describe('SecretsTracker — the here-now filter composes with the existing filters', () => {
  it('ANDs with a category tab', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    fireEvent.click(screen.getByRole('button', { name: /^Clues$/i }));

    // In the room AND a clue.
    expect(screen.queryByText(TITLES.hereLocation)).not.toBeNull();
    expect(screen.queryByText(TITLES.hereMulti)).not.toBeNull();
    // In the room but not a clue.
    expect(screen.queryByText(TITLES.hereNpc)).toBeNull();
    expect(screen.queryByText(TITLES.revealedHere)).toBeNull();
    // A clue-less elsewhere secret stays gone either way.
    expect(screen.queryByText(TITLES.elsewhere)).toBeNull();
  });

  it('stays engaged across a category tab round trip', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    fireEvent.click(screen.getByRole('button', { name: /^Clues$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));

    expect(hereNowToggle().getAttribute('aria-pressed')).toBe('true');
    expect(visibleTitles()).toHaveLength(4);
    expect(screen.queryByText(TITLES.elsewhere)).toBeNull();
  });

  it('ANDs with the hide-revealed toggle', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    fireEvent.click(screen.getByRole('button', { name: /hide revealed/i }));

    expect(screen.queryByText(TITLES.revealedHere)).toBeNull();
    expect(screen.queryByText(TITLES.hereNpc)).not.toBeNull();
    expect(visibleTitles()).toHaveLength(3);
  });

  it('can empty the list through composition and still says so', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    fireEvent.click(screen.getByRole('button', { name: /^Rumors$/i }));

    expect(visibleTitles()).toHaveLength(0);
    expect(screen.queryByText(/no entries match the current filter/i)).not.toBeNull();
  });
});

describe('SecretsTracker — looking is not editing', () => {
  it('writes nothing to the store when the filter is toggled on and off', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());
    fireEvent.click(hereNowToggle());

    expect(h.createSecret).not.toHaveBeenCalled();
    expect(h.updateSecret).not.toHaveBeenCalled();
    expect(h.revealSecret).not.toHaveBeenCalled();
    expect(h.deleteSecret).not.toHaveBeenCalled();
  });

  it('leaves the reveal state of a filtered-in secret exactly as it was', () => {
    renderTracker();

    fireEvent.click(hereNowToggle());

    // The revealed secret still reads as revealed; the filter never re-reveals
    // or un-reveals anything on the DM's behalf.
    expect(screen.queryByText(TITLES.revealedHere)).not.toBeNull();
    expect(h.updateSecret).not.toHaveBeenCalled();
  });

  it('leaves indigo to RealmChat', () => {
    const { container } = renderTracker();

    fireEvent.click(hereNowToggle());

    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});
