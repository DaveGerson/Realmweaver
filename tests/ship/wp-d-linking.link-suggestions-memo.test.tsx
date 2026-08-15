// @vitest-environment jsdom
/**
 * wp-d-linking — finding #50 (the LinkSuggestionsPanel half)
 *
 * LinkSuggestionsPanel defaults `dismissedIds = new Set()` (line 61) and lists
 * that value in the useMemo dependency array (line 106). A fresh Set identity is
 * created on EVERY render, so the memo NEVER hits and the O(candidates × matches
 * × textLength) matching engine re-runs on every keystroke in SceneEditor.
 *
 * Contract: re-rendering with identical props must not re-run the matching
 * engine. (Fix: hoist the default to a module-level EMPTY_SET constant.)
 *
 * NOTE: the other half of #50 — SceneEditor.tsx:445-458 building
 * `allCandidates` / `allNpcs` / `allLocations` as fresh array literals on every
 * render — lives outside this work package's owned files and is not covered
 * here; it must be fixed with useMemo in SceneEditor for this contract to hold
 * end-to-end.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LinkSuggestionsPanel } from '../../components/common/LinkSuggestionsPanel';
import { setMatchingEngine, resetMatchingEngine } from '../../services/linking/engineRegistry';
import type { EntityCandidate } from '../../services/linking/matchingEngine';

const CANDIDATES: EntityCandidate[] = [
    { id: 'npc-1', name: 'Kalli Alran', type: 'npc' },
    { id: 'loc-1', name: 'Salvation', type: 'location' },
];

const TEXT_FIELDS = ['Kalli Alran waits in Salvation.'];

let findMatchesCalls = 0;

beforeEach(() => {
    findMatchesCalls = 0;
    setMatchingEngine({
        findMatches: () => {
            findMatchesCalls += 1;
            return [{
                entityId: 'npc-1', entityType: 'npc', entityName: 'Kalli Alran',
                confidence: 1, matchSpan: [0, 11] as [number, number],
            }];
        },
        info: () => ({ name: 'CountingEngine', version: '1.0.0' }),
    });
});

afterEach(() => {
    resetMatchingEngine();
    cleanup();
});

describe('wp-d-linking #50 — suggestion matching must be memoized', () => {
    it('does not re-run the matching engine when re-rendered with identical props', () => {
        // Stable prop VALUES (same array identities), fresh element each pass —
        // exactly what a parent re-render looks like when it memoizes its props.
        const onAccept = () => {};
        const element = () => (
            <LinkSuggestionsPanel
                textFields={TEXT_FIELDS}
                allCandidates={CANDIDATES}
                onAccept={onAccept}
            />
        );

        const { rerender } = render(element());
        expect(findMatchesCalls).toBe(1);

        rerender(element());
        rerender(element());

        expect(findMatchesCalls).toBe(1);
    });
});
