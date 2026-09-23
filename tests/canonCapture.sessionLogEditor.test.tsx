// @vitest-environment jsdom
/**
 * components/editors/SessionLogEditor.tsx — "Make this canon" (post-hoc)
 *
 * The post-hoc twin of RunningLog's live "Make this canon": reviewing a
 * session's structured notes afterwards offers the identical picker on each
 * MANUAL note, but the resulting NPC is never scene-linked and never put on
 * the Stage — both are live-session-only concepts (per §4.10 of the design).
 * The promotion is recorded in the log BEING REVIEWED through the editor's
 * own `onUpdate` path (a new structured note), never through
 * `campaignService.addAutoEvent`, which targets whichever session is live —
 * for a past session that is either nothing or the wrong log. Cancel is a
 * no-op.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';

vi.mock('../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
  startAudioTranscription: vi.fn(async () => ({ stop: async () => {} })),
}));

const h = vi.hoisted(() => {
  // A stable reference: `useSyncExternalStore` (BacklinksPanel reads the
  // store with it) requires getSnapshot to return the SAME object when
  // nothing changed, or React treats every re-check as a fresh update and
  // loops. A `vi.fn(() => ({...}))` literal would return a new object every
  // call and reproduce that exact loop.
  const mockState = { campaigns: [], activeCampaignId: null };
  return {
    // Each mock's parameter is typed explicitly so `.mock.calls[0]` infers a
    // real tuple below instead of `[]` (a bare `() => x` arrow gives the
    // mock a zero-arg signature).
    createNpc: vi.fn((_data: Record<string, unknown>) => 'new-npc-id'),
    createLocation: vi.fn((_data: Record<string, unknown>) => 'new-loc-id'),
    createItem: vi.fn((_data: Record<string, unknown>) => 'new-item-id'),
    createNote: vi.fn((_data: Record<string, unknown>) => 'new-note-id'),
    updateScene: vi.fn((_adventureId: string, _sceneId: string, _data: Record<string, unknown>) => {}),
    addNpcToStage: vi.fn((_npcId: string) => true),
    addAutoEvent: vi.fn((_type: string, _content: string) => true),
    getActiveCampaign: vi.fn(),
    getState: vi.fn(() => mockState),
    subscribe: vi.fn(() => () => {}),
  };
});

vi.mock('../services/campaignService', () => ({
  campaignService: {
    createNpc: h.createNpc,
    createLocation: h.createLocation,
    createItem: h.createItem,
    createNote: h.createNote,
    updateScene: h.updateScene,
    addNpcToStage: h.addNpcToStage,
    addAutoEvent: h.addAutoEvent,
    getActiveCampaign: h.getActiveCampaign,
    getState: h.getState,
    subscribe: h.subscribe,
  },
}));

const { SessionLogEditor } = await import('../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../hooks/useToast');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const MANUAL_NOTE_CONTENT = 'Borin, the one-eyed innkeeper, mentions a hidden door.';

const log: SessionLog = {
  id: 'log-1',
  title: 'Session One',
  status: 'completed',
  sessionDate: '2026-01-01T00:00:00.000Z',
  plannedSceneIds: [],
  prepNotes: '',
  relatedPlotIds: [],
  runningNotes: '',
  structuredNotes: [
    { id: 'note-1', timestamp: '2026-01-01T20:00:00.000Z', content: MANUAL_NOTE_CONTENT, taggedEntityIds: [] },
    { id: 'note-2', timestamp: '2026-01-01T20:05:00.000Z', content: 'NPC created: Borin', taggedEntityIds: [], type: 'npc-created' },
  ],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
} as unknown as SessionLog;

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  setting: 'A world',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [log], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

type OnUpdate = (id: string, updates: Partial<SessionLog>) => void;

function renderEditor() {
  const onUpdate = vi.fn<OnUpdate>();
  render(
    <ConfirmDialogProvider>
      <ToastProvider>
        <SessionLogEditor
          log={log}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          isMockMode={true}
        />
      </ToastProvider>
    </ConfirmDialogProvider>,
  );
  return { onUpdate };
}

/**
 * Opens the picker on the manual note. Promotion notes written by earlier
 * saves are AUTO entries (`npc-created` / `entity-created`) and never carry
 * the action themselves, so this stays the only such button in the list.
 */
function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Make this canon' }));
}

/** The structured notes written by the most recent onUpdate call for this log. */
function lastWrittenNotes(onUpdate: ReturnType<typeof vi.fn<OnUpdate>>) {
  const calls = onUpdate.mock.calls.filter(([id, updates]) => id === 'log-1' && Array.isArray(updates.structuredNotes));
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1].structuredNotes!;
}

describe('SessionLogEditor — Make this canon (post-hoc)', () => {
  it('only offers the action on the MANUAL note (the "structured" tab is the default)', () => {
    renderEditor();
    expect(screen.getAllByRole('button', { name: 'Make this canon' })).toHaveLength(1);
  });

  it('creates an NPC with no scene-link and no Stage placement, and records the promotion in THIS log', () => {
    const { onUpdate } = renderEditor();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createNpc).toHaveBeenCalledTimes(1);
    const [payload] = h.createNpc.mock.calls[0];
    expect(payload.name).toBe('Borin');
    expect(payload.description).toBe('the one-eyed innkeeper, mentions a hidden door.');
    expect(payload).not.toHaveProperty('id');

    expect(h.updateScene).not.toHaveBeenCalled();
    expect(h.addNpcToStage).not.toHaveBeenCalled();
    expect(h.getActiveCampaign).not.toHaveBeenCalled();
    // Never the live session's log — the one being reviewed.
    expect(h.addAutoEvent).not.toHaveBeenCalled();
    const notes = lastWrittenNotes(onUpdate);
    expect(notes).toHaveLength(3);
    expect(notes[2]).toEqual(expect.objectContaining({ type: 'npc-created', content: 'NPC created: Borin', taggedEntityIds: [] }));
    expect(notes[2].id).toBeTruthy();

    // The picker closes after a successful save.
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('creates a Location/Item/Note with an entity-created promotion note in the reviewed log', () => {
    const { onUpdate } = renderEditor();

    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.createLocation).toHaveBeenCalledTimes(1);
    expect(lastWrittenNotes(onUpdate).at(-1)).toEqual(expect.objectContaining({ type: 'entity-created', content: 'Location created: Borin' }));
    // The promotion note is an auto entry: it is NOT itself offered for promotion.
    expect(screen.getAllByRole('button', { name: 'Make this canon' })).toHaveLength(1);

    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.createItem).toHaveBeenCalledTimes(1);
    expect(lastWrittenNotes(onUpdate).at(-1)).toEqual(expect.objectContaining({ type: 'entity-created', content: 'Item created: Borin' }));

    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(h.createNote).toHaveBeenCalledTimes(1);
    expect(h.createNote.mock.calls[0][0]).toEqual({ title: 'Borin', content: MANUAL_NOTE_CONTENT, tags: ['Canon'] });
    const finalNotes = lastWrittenNotes(onUpdate);
    expect(finalNotes.at(-1)).toEqual(expect.objectContaining({ type: 'entity-created', content: 'Note created: Borin' }));
    // Three promotions on top of the two original notes — nothing overwritten.
    expect(finalNotes).toHaveLength(5);
    expect(h.addAutoEvent).not.toHaveBeenCalled();
  });

  it('Cancel is a no-op', () => {
    const { onUpdate } = renderEditor();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.createNpc).not.toHaveBeenCalled();
    expect(h.createLocation).not.toHaveBeenCalled();
    expect(h.createItem).not.toHaveBeenCalled();
    expect(h.createNote).not.toHaveBeenCalled();
    expect(h.addAutoEvent).not.toHaveBeenCalled();
    expect(onUpdate.mock.calls.filter(([, updates]) => Array.isArray(updates.structuredNotes))).toHaveLength(0);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
