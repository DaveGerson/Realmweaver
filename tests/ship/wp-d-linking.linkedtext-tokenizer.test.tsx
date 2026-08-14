// @vitest-environment jsdom
/**
 * wp-d-linking — findings #45, #100, #53
 *
 * LinkedText re-implements the matching engine instead of using
 * services/linking/matchingEngine.ts, and the private copy has two defects that
 * the shared engine's own regression suite already guards against:
 *
 *   #45  isWordBoundary uses /[^a-zA-Z0-9]/ (LinkedText.tsx:107), so EVERY
 *        non-ASCII letter counts as a word boundary. An entity named "Ana"
 *        therefore links inside the unrelated word "Anaïs".
 *   #100 tokenize() slices the ORIGINAL text with offsets computed on
 *        text.toLowerCase() (LinkedText.tsx:147/160/166). 'İ' (U+0130)
 *        lowercases to TWO code points, so every later offset drifts and the
 *        rendered link label is cut in the wrong place.
 *   #53  is the coverage gap that let both survive — these tests close it by
 *        driving the tokenizer through LinkedText's public rendering.
 *
 * Contract: LinkedText must produce exactly the links the shared engine would
 * (Unicode-aware boundaries) and every link's visible label must be the exact
 * substring of the ORIGINAL text that matched.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: { campaigns: [] as any[], activeCampaignId: 'c-1' },
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        subscribe: (_listener: () => void) => () => {},
        getState: () => h.state,
        getActiveCampaign: () => h.state.campaigns[0],
    },
}));

import { LinkedText } from '../../components/common/LinkedText';

function seedCampaign(partial: Record<string, any[]>) {
    h.state.campaigns = [{
        id: 'c-1',
        title: 'T',
        setting: '',
        settingType: 'custom',
        npcs: [], locations: [], factions: [], items: [],
        adventures: [], articles: [], plots: [],
        sessionLogs: [], playerCharacters: [], notes: [],
        ...partial,
    }];
}

/** All entity links currently rendered, as their visible label text. */
function linkLabels(): string[] {
    return screen.queryAllByRole('button').map(b => b.textContent ?? '');
}

beforeEach(() => {
    h.state = { campaigns: [], activeCampaignId: 'c-1' };
});

afterEach(() => cleanup());

describe('wp-d-linking #45 — Unicode letters are not word boundaries', () => {
    it('does not link "Ana" inside the unrelated word "Anaïs"', () => {
        seedCampaign({ npcs: [{ id: 'npc-ana', name: 'Ana' }] });

        render(<LinkedText text="Anaïs walked into the room." onNavigate={() => {}} />);

        expect(linkLabels()).toHaveLength(0);
    });

    it('links the longer name and never the shorter prefix when both exist', () => {
        seedCampaign({
            npcs: [
                { id: 'npc-ana', name: 'Ana' },
                { id: 'npc-anais', name: 'Anaïs' },
            ],
        });

        render(<LinkedText text="Anaïs walked into the room." onNavigate={() => {}} />);

        expect(linkLabels()).toEqual(['Anaïs']);
    });

    it('does not link across an underscore-joined identifier', () => {
        // The shared engine treats '_' as a NON-word char (only \p{L}\p{N} are
        // word chars), so "Sera" inside "Sera_backup" is a legitimate match for
        // the engine. Pin the engine's behaviour so both systems agree.
        seedCampaign({ npcs: [{ id: 'npc-sera', name: 'Sera' }] });

        render(<LinkedText text="Sera_backup" onNavigate={() => {}} />);

        expect(linkLabels()).toEqual(['Sera']);
    });
});

describe('wp-d-linking #100 — offsets must not drift when toLowerCase changes length', () => {
    it('renders the correct label after a character that lowercases to two code points', () => {
        seedCampaign({ npcs: [{ id: 'npc-sera', name: 'Sera' }] });

        const text = 'İzmir Gate is where Sera waits';
        render(<LinkedText text={text} onNavigate={() => {}} />);

        expect(linkLabels()).toEqual(['Sera']);
    });

    it('preserves the full original text across all rendered segments', () => {
        seedCampaign({ npcs: [{ id: 'npc-sera', name: 'Sera' }] });

        const text = 'İzmir Gate is where Sera waits';
        const { container } = render(<LinkedText text={text} onNavigate={() => {}} />);

        expect(container.textContent).toBe(text);
    });
});

describe('wp-d-linking #53 — baseline tokenizer behaviour (regression guards)', () => {
    it('preserves the casing found in the source text as the link label', () => {
        seedCampaign({ locations: [{ id: 'loc-1', name: 'The Great Library' }] });

        render(<LinkedText text="They met at the great library at dusk." onNavigate={() => {}} />);

        expect(linkLabels()).toEqual(['the great library']);
    });

    it('renders plain text when the campaign has no entities', () => {
        seedCampaign({});

        const { container } = render(<LinkedText text="Nothing to link here." onNavigate={() => {}} />);

        expect(linkLabels()).toHaveLength(0);
        expect(container.textContent).toBe('Nothing to link here.');
    });
});
