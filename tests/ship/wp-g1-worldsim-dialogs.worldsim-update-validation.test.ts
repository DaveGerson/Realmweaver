/**
 * wp-g1-worldsim-dialogs — finding #14
 *
 * services/ai/worldSimulation.ts:53 declares `suggestedUpdates[].field` as an
 * unconstrained `{ type: 'string' }` and `generateWorldEvents` (line ~185)
 * returns whatever the model produced verbatim. Those updates are later fed
 * straight into `campaignService.updateNpc(id, { [field]: proposedValue })`,
 * which is a bare `Object.assign` — so a model-chosen `field: 'id'` rewrites an
 * entity's primary key and `field: 'relationships'` replaces an array with a
 * prose string. Both corruptions are persisted by the debounced autosave.
 *
 * Contract for the fix (validation at the source, in generateWorldEvents):
 *   1. Only per-entity-type allowlisted, prose-string fields survive
 *      (npc: description/motivations/secrets/traits/backstory/appearance,
 *       faction: description/goals/influence, location: description, ...).
 *   2. Updates naming a structural field (`id`, `factionId`, `relationships`,
 *      `history`, `npcIds`, ...) are dropped.
 *   3. Updates with an unknown `entityType` are dropped.
 *   4. Updates whose `proposedValue` is not a string are dropped.
 *   5. Updates whose `entityId` does not exist in the campaign are dropped.
 *   6. Dropping an update must not drop the event itself — the narrative
 *      description is still worth showing to the DM.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Campaign } from '../../types/index';

const h = vi.hoisted(() => ({ result: { events: [] as any[] } }));

vi.mock('../../services/ai/core', () => ({
    generateWithSchema: vi.fn(async () => h.result),
    generateText: vi.fn(async () => ''),
}));

import { generateWorldEvents } from '../../services/ai/worldSimulation';

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [],
    npcs: [
        {
            id: 'npc-1',
            name: 'The Gray Warden',
            description: 'A weathered veteran.',
            motivations: 'Protect the pass.',
            secrets: 'Deserted once.',
            relationships: [],
            history: [],
        } as any,
    ],
    locations: [{ id: 'loc-1', name: 'The Pass', description: 'A cold gap.' } as any],
    factions: [{ id: 'fac-1', name: 'Iron Circle', goals: 'Control trade.', influence: 'Regional.', memberIds: [] } as any],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
} as unknown as Campaign;

function eventWith(updates: any[]) {
    return {
        title: 'The Circle Moves',
        description: 'Wagons roll east under new banners.',
        affectedEntityIds: ['npc-1'],
        affectedEntityTypes: ['npc'],
        suggestedUpdates: updates,
        severity: 'major',
        category: 'faction',
    };
}

beforeEach(() => {
    h.result = { events: [] };
});

describe('generateWorldEvents validates model-supplied suggestedUpdates', () => {
    it('drops updates naming structural fields and keeps allowlisted prose fields', async () => {
        h.result = {
            events: [
                eventWith([
                    { entityId: 'npc-1', entityType: 'npc', field: 'motivations', currentValue: 'Protect the pass.', proposedValue: 'Protect the pass, and find the deserter who knew.' },
                    { entityId: 'npc-1', entityType: 'npc', field: 'id', currentValue: 'npc-1', proposedValue: 'The Gray Warden, now hunted' },
                    { entityId: 'npc-1', entityType: 'npc', field: 'relationships', currentValue: '', proposedValue: 'Now distrusts the Duke' },
                    { entityId: 'npc-1', entityType: 'npc', field: 'factionId', currentValue: '', proposedValue: 'Iron Circle' },
                    { entityId: 'npc-1', entityType: 'npc', field: 'history', currentValue: '', proposedValue: 'Fled the siege' },
                ]),
            ],
        };

        const events = await generateWorldEvents(campaign, 30);

        expect(events).toHaveLength(1);
        const fields = events[0].suggestedUpdates.map(u => u.field);
        expect(fields).toEqual(['motivations']);
        expect(fields).not.toContain('id');
        expect(fields).not.toContain('relationships');
        expect(fields).not.toContain('factionId');
        expect(fields).not.toContain('history');
    });

    it('drops updates with an unknown entityType, a non-string proposedValue, or an entityId absent from the campaign', async () => {
        h.result = {
            events: [
                eventWith([
                    { entityId: 'fac-1', entityType: 'faction', field: 'goals', currentValue: 'Control trade.', proposedValue: 'Control trade and the eastern road.' },
                    // unknown entity type
                    { entityId: 'sec-1', entityType: 'secret', field: 'description', currentValue: '', proposedValue: 'A hidden truth.' },
                    // non-string proposed value
                    { entityId: 'npc-1', entityType: 'npc', field: 'description', currentValue: 'A weathered veteran.', proposedValue: { text: 'A hunted veteran.' } as any },
                    // entity id that does not exist in the campaign
                    { entityId: 'npc-does-not-exist', entityType: 'npc', field: 'description', currentValue: '', proposedValue: 'Ghost entity.' },
                ]),
            ],
        };

        const events = await generateWorldEvents(campaign, 7);

        expect(events).toHaveLength(1);
        expect(events[0].suggestedUpdates).toEqual([
            expect.objectContaining({ entityId: 'fac-1', entityType: 'faction', field: 'goals' }),
        ]);
    });

    it('drops updates whose currentValue is not a string', async () => {
        // A model that returns an object/array for currentValue would crash
        // the review pane's raw render (before the DM can ever reach Apply)
        // if it survived filtering — verified separately at the render layer
        // in wp-g1-worldsim-dialogs.apply-guard.test.tsx.
        h.result = {
            events: [
                eventWith([
                    { entityId: 'npc-1', entityType: 'npc', field: 'motivations', currentValue: { text: 'old' } as any, proposedValue: 'Protect the pass, and hunt the informant.' },
                    { entityId: 'loc-1', entityType: 'location', field: 'description', currentValue: 'A cold gap.', proposedValue: 'A cold gap, now garrisoned.' },
                ]),
            ],
        };

        const events = await generateWorldEvents(campaign, 14);

        expect(events).toHaveLength(1);
        expect(events[0].suggestedUpdates).toEqual([
            expect.objectContaining({ entityId: 'loc-1', entityType: 'location', field: 'description' }),
        ]);
    });

    it('keeps the event even when every one of its suggested updates is rejected', async () => {
        h.result = {
            events: [eventWith([{ entityId: 'npc-1', entityType: 'npc', field: 'id', currentValue: 'npc-1', proposedValue: 'renamed' }])],
        };

        const events = await generateWorldEvents(campaign, 90);

        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('The Circle Moves');
        expect(events[0].suggestedUpdates).toEqual([]);
    });
});
