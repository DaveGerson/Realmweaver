/**
 * wp-e-app-shell — findings #92 and #102
 *
 * `QuickCardEntityType` includes 'scene' (and notes are pinnable through the
 * same quick-card surface), and EntityQuickCard's pin button calls
 * `campaignService.pinEntity(entityType, entityId)` unconditionally — so a
 * scene CAN be pinned and lands in `campaign.pinnedEntities`.
 *
 * `resolvePinnedEntityName` has no 'scene' and no 'note' case, so it falls
 * through to `default: return null`, and PinnedEntities.tsx bails with
 * `if (!name) return null`. The row — and with it the unpin X — is never
 * rendered, so the pin is stuck forever, silently occupying one of the 15
 * pinned slots.
 *
 * Contract: resolvePinnedEntityName must return a display name for EVERY
 * pinnable type, including 'scene' (scene.title, found by scanning
 * campaign.adventures[].scenes) and 'note' (note.title). Unknown types and
 * deleted entities still resolve to null.
 */

import { describe, it, expect } from 'vitest';
import { resolvePinnedEntityName, RECENT_TYPE_COLOR, RECENT_TYPE_ICON } from '../../components/layout/sidebar/sidebarUtils';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';
import type { Campaign } from '../../types/index';

function makeCampaign(): Campaign {
    return {
        id: 'camp-1',
        title: 'Test Campaign',
        setting: 'A world',
        settingType: 'custom',
        npcs: [{ id: 'npc-1', name: 'Aldric' }],
        locations: [],
        factions: [],
        items: [],
        adventures: [
            {
                id: 'adv-1',
                title: 'The Sunken Vault',
                scenes: [
                    { id: 'scene-1', title: 'The Drowned Gate', type: 'exploration', npcIds: [] },
                    { id: 'scene-2', title: 'The Lich Awakes', type: 'combat', npcIds: [] },
                ],
            },
        ],
        articles: [],
        sessionLogs: [],
        playerCharacters: [],
        plots: [],
        notes: [{ id: 'note-1', title: 'Table rules' }],
        secrets: [],
    } as unknown as Campaign;
}

describe('wp-e-app-shell #92/#102 — every pinnable entity type resolves a sidebar name', () => {
    it('resolves a pinned scene to its title so the Pinned row (and its unpin button) renders', () => {
        const campaign = makeCampaign();
        expect(resolvePinnedEntityName(campaign, 'scene', 'scene-2')).toBe('The Lich Awakes');
    });

    it('resolves a pinned note to its title', () => {
        const campaign = makeCampaign();
        expect(resolvePinnedEntityName(campaign, 'note', 'note-1')).toBe('Table rules');
    });

    it('still returns null for a deleted scene and for an unknown type', () => {
        const campaign = makeCampaign();
        expect(resolvePinnedEntityName(campaign, 'scene', 'scene-gone')).toBeNull();
        expect(resolvePinnedEntityName(campaign, 'wyvern', 'x')).toBeNull();
    });

    it('keeps resolving the already-supported types', () => {
        const campaign = makeCampaign();
        expect(resolvePinnedEntityName(campaign, 'npc', 'npc-1')).toBe('Aldric');
        expect(resolvePinnedEntityName(campaign, 'adventure', 'adv-1')).toBe('The Sunken Vault');
    });

    // Verifier follow-up: the #92 fix added the 'scene'/'note' cases above but
    // left a hardcoded `scene: 'text-orange-400'` override layered on top of
    // the ENTITY_TYPE_CONFIG-derived RECENT_TYPE_COLOR/RECENT_TYPE_ICON maps —
    // now that ENTITY_TYPE_CONFIG.scene exists (blue), the sidebar's
    // Recent/Pinned rows rendered orange while EntityQuickCard, CommandPalette
    // and RelationshipGraph all rendered scene blue, the exact single-source-
    // of-truth violation CLAUDE.md's ENTITY_TYPE_CONFIG rule targets.
    it('derives the scene color/icon from ENTITY_TYPE_CONFIG — no hardcoded override', () => {
        expect(RECENT_TYPE_COLOR.scene).toBe(`text-${ENTITY_TYPE_CONFIG.scene.color}-400`);
        expect(RECENT_TYPE_ICON.scene).toBe(ENTITY_TYPE_CONFIG.scene.icon);
        // Specifically must NOT be the old stale hardcoded orange.
        expect(RECENT_TYPE_COLOR.scene).not.toBe('text-orange-400');
    });

    it('derives every RECENT_TYPE_COLOR/RECENT_TYPE_ICON entry from ENTITY_TYPE_CONFIG', () => {
        for (const [type, config] of Object.entries(ENTITY_TYPE_CONFIG)) {
            expect(RECENT_TYPE_COLOR[type as keyof typeof RECENT_TYPE_COLOR]).toBe(`text-${config.color}-400`);
            expect(RECENT_TYPE_ICON[type as keyof typeof RECENT_TYPE_ICON]).toBe(config.icon);
        }
    });
});
