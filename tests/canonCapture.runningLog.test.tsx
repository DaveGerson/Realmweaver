// @vitest-environment jsdom
/**
 * components/views/session/RunningLog.tsx — "Make this canon"
 *
 * Monte Cook's improv-canon-capture posture: a MANUAL running-log note gets
 * a "Make this canon" action that opens the shared CanonCapturePicker and,
 * on Save, calls the matching campaignService.create* — for an NPC, linking
 * it to the active scene (resolved across ALL adventures, the way
 * QuickNpcGenerator does) or, with no active scene, putting it on the
 * Stage. Every create is followed by an auto-log line and a toast. Cancel
 * is a no-op: nothing is ever auto-promoted.
 *
 * campaignService is mocked wholesale (as wp-e-app-shell.session-runner-a11y
 * does for the same component tree) so these assertions pin the exact
 * store calls without a real store; the mock intentionally omits methods
 * RunningLog must never call at render time, only from inside a handler.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import { ToastProvider } from '../hooks/useToast';

const h = vi.hoisted(() => {
  // A stable reference — see the identical note in
  // canonCapture.sessionLogEditor.test.tsx: anything reading this through
  // useSyncExternalStore needs the same object back when nothing changed.
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
    addSessionRunnerNote: vi.fn(),
    deleteSessionNote: vi.fn(),
    toggleNoteImportance: vi.fn(),
    updateSessionNoteContent: vi.fn(),
    getActiveCampaign: vi.fn(),
    getState: vi.fn(() => mockState),
  };
});

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    createNpc: h.createNpc,
    createLocation: h.createLocation,
    createItem: h.createItem,
    createNote: h.createNote,
    updateScene: h.updateScene,
    addNpcToStage: h.addNpcToStage,
    addAutoEvent: h.addAutoEvent,
    addSessionRunnerNote: h.addSessionRunnerNote,
    deleteSessionNote: h.deleteSessionNote,
    toggleNoteImportance: h.toggleNoteImportance,
    updateSessionNoteContent: h.updateSessionNoteContent,
    getActiveCampaign: h.getActiveCampaign,
    getState: h.getState,
  },
}));

const { RunningLog } = await import('../components/views/session/RunningLog');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const MANUAL_NOTE_CONTENT = 'Borin, the one-eyed innkeeper, mentions a hidden door.';

function makeSessionLog(): SessionLog {
  return {
    id: 'log-1',
    title: 'Session One',
    status: 'active',
    sessionDate: '2026-01-01T00:00:00.000Z',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [
      { id: 'note-1', timestamp: '2026-01-01T20:00:00.000Z', content: MANUAL_NOTE_CONTENT, taggedEntityIds: [], type: 'manual' },
      { id: 'note-2', timestamp: '2026-01-01T20:05:00.000Z', content: 'NPC created: Borin', taggedEntityIds: [], type: 'npc-created' },
    ],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
  } as unknown as SessionLog;
}

function renderLog() {
  return render(
    <ToastProvider>
      <RunningLog sessionLog={makeSessionLog()} mobileTab="active" />
    </ToastProvider>
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Make this canon' }));
}

describe('RunningLog — Make this canon', () => {
  it('only offers the action on the MANUAL note, never the auto-generated one', () => {
    renderLog();
    expect(screen.getAllByRole('button', { name: 'Make this canon' })).toHaveLength(1);
  });

  it('creates an NPC and links it to the active scene, resolved across all adventures', () => {
    h.getActiveCampaign.mockReturnValue({
      id: 'camp-1',
      activeSceneId: 'scene-1',
      adventures: [
        { id: 'adv-other', scenes: [{ id: 'scene-elsewhere', npcIds: [] }] },
        { id: 'adv-1', scenes: [{ id: 'scene-1', npcIds: ['npc-existing'] }] },
      ],
    } as unknown as Campaign);

    renderLog();
    openPicker();
    // Default kind is already "New NPC" — save immediately.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createNpc).toHaveBeenCalledTimes(1);
    const [payload] = h.createNpc.mock.calls[0];
    expect(payload.name).toBe('Borin');
    expect(payload.description).toBe('the one-eyed innkeeper, mentions a hidden door.');
    expect(payload).not.toHaveProperty('id');

    expect(h.updateScene).toHaveBeenCalledWith('adv-1', 'scene-1', { npcIds: ['npc-existing', 'new-npc-id'] });
    expect(h.addNpcToStage).not.toHaveBeenCalled();
    expect(h.addAutoEvent).toHaveBeenCalledWith('npc-created', 'NPC created: Borin');

    // The picker closes after a successful save.
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('puts the NPC on the Stage instead when no scene is active', () => {
    h.getActiveCampaign.mockReturnValue({
      id: 'camp-1',
      activeSceneId: undefined,
      adventures: [],
    } as unknown as Campaign);

    renderLog();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createNpc).toHaveBeenCalledTimes(1);
    expect(h.updateScene).not.toHaveBeenCalled();
    expect(h.addNpcToStage).toHaveBeenCalledWith('new-npc-id');
    expect(h.addAutoEvent).toHaveBeenCalledWith('npc-created', 'NPC created: Borin');
  });

  it('creates a Location with an entity-created auto-log line and no scene/Stage calls', () => {
    renderLog();
    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createLocation).toHaveBeenCalledTimes(1);
    const [payload] = h.createLocation.mock.calls[0];
    expect(payload.name).toBe('Borin');
    expect(payload).not.toHaveProperty('id');
    expect(h.updateScene).not.toHaveBeenCalled();
    expect(h.addNpcToStage).not.toHaveBeenCalled();
    expect(h.getActiveCampaign).not.toHaveBeenCalled();
    // An AUTO entry, never `manual` — a manual note would be offered
    // "Make this canon" again, and a promotion record must not be re-promotable.
    expect(h.addAutoEvent).toHaveBeenCalledWith('entity-created', 'Location created: Borin');
  });

  it('creates an Item with an entity-created auto-log line', () => {
    renderLog();
    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createItem).toHaveBeenCalledTimes(1);
    expect(h.addAutoEvent).toHaveBeenCalledWith('entity-created', 'Item created: Borin');
  });

  it('creates a Note that keeps the full note text, tagged Canon', () => {
    renderLog();
    openPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'New Note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.createNote).toHaveBeenCalledTimes(1);
    const [payload] = h.createNote.mock.calls[0];
    expect(payload).toEqual({ title: 'Borin', content: MANUAL_NOTE_CONTENT, tags: ['Canon'] });
    expect(h.addAutoEvent).toHaveBeenCalledWith('entity-created', 'Note created: Borin');
  });

  it('Cancel is a no-op — nothing is created, nothing is logged', () => {
    renderLog();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.createNpc).not.toHaveBeenCalled();
    expect(h.createLocation).not.toHaveBeenCalled();
    expect(h.createItem).not.toHaveBeenCalled();
    expect(h.createNote).not.toHaveBeenCalled();
    expect(h.addAutoEvent).not.toHaveBeenCalled();
    expect(h.getActiveCampaign).not.toHaveBeenCalled();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('lets the DM edit the suggested name before saving', () => {
    h.getActiveCampaign.mockReturnValue({ id: 'camp-1', activeSceneId: undefined, adventures: [] } as unknown as Campaign);
    renderLog();
    openPicker();
    fireEvent.change(screen.getByLabelText('Canon entity name'), { target: { value: 'Old One-Eyed Borin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const [payload] = h.createNpc.mock.calls[0];
    expect(payload.name).toBe('Old One-Eyed Borin');
    expect(h.addAutoEvent).toHaveBeenCalledWith('npc-created', 'NPC created: Old One-Eyed Borin');
  });
});
