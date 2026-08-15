// @vitest-environment jsdom
/**
 * wp-d-linking — findings #101, #18, #51, #52
 *
 *   #101 findMentionedIdsInText tests every tracked name independently against
 *        the whole text, so a name that is a word-prefix of a longer mention
 *        ("The Guild" vs "@The Guild of Blades") is credited too — leaving a
 *        phantom "Mentioned in" backlink the GM cannot see or delete.
 *   #18  mentionMapRef is keyed by entity NAME and seeded from initialMentions
 *        (resolved to each entity's CURRENT name). Nothing rewrites `@OldName`
 *        in stored prose on rename, so the first keystroke after a rename drops
 *        the entity's ID from mentionedEntityIds and its backlink vanishes.
 *   #51  the textarea claims aria-autocomplete/aria-expanded/aria-haspopup but
 *        has no role="combobox", no aria-controls and no aria-activedescendant,
 *        and the role="listbox" does not own its role="option" children
 *        (they sit inside plain grouping <div>s).
 *   #52  MentionInput's Escape branch never stops propagation, so hosts with a
 *        document-level Escape listener (DmCoach) or a DialogShell wrapper are
 *        torn down when the GM only meant to close the suggestion dropdown.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: { campaigns: [] as any[], activeCampaignId: 'c-1' },
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        subscribe: (_l: () => void) => () => {},
        getState: () => h.state,
        getActiveCampaign: () => h.state.campaigns[0],
    },
}));

import { MentionInput, findMentionedIdsInText } from '../../components/common/MentionInput';
import { DialogShell } from '../../components/common/DialogShell';

function seedCampaign(partial: Record<string, any[]> = {}) {
    h.state.campaigns = [{
        id: 'c-1', title: 'T', setting: '', settingType: 'custom',
        npcs: [], locations: [], factions: [], items: [],
        adventures: [], articles: [], plots: [],
        sessionLogs: [], playerCharacters: [], notes: [],
        ...partial,
    }];
}

/** Simulates typing by replacing the whole value with the caret at its end. */
function typeInto(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
    fireEvent.change(el, { target: { value, selectionStart: value.length, selectionEnd: value.length } });
}

beforeEach(() => {
    h.state = { campaigns: [], activeCampaignId: 'c-1' };
});

afterEach(() => cleanup());

// ── #101 — longest-match-wins, spans consumed ────────────────────────────────

describe('wp-d-linking #101 — a shorter name inside a longer mention must not be credited', () => {
    it('credits only "The Guild of Blades" for "@The Guild of Blades"', () => {
        const candidates = [
            { id: 'fac-guild', name: 'The Guild' },
            { id: 'fac-blades', name: 'The Guild of Blades' },
        ];

        const ids = findMentionedIdsInText('We met @The Guild of Blades today.', candidates);

        expect(ids).toEqual(['fac-blades']);
    });

    it('still credits both when both are genuinely mentioned', () => {
        const candidates = [
            { id: 'fac-guild', name: 'The Guild' },
            { id: 'fac-blades', name: 'The Guild of Blades' },
        ];

        const ids = findMentionedIdsInText(
            '@The Guild sent word to @The Guild of Blades.',
            candidates,
        );

        expect(ids.slice().sort()).toEqual(['fac-blades', 'fac-guild']);
    });
});

// ── #18 — renamed entity must keep its persisted mention ─────────────────────

describe('wp-d-linking #18 — editing a field must not drop mentions of renamed entities', () => {
    it('keeps a persisted mention ID whose entity was renamed after the text was written', () => {
        seedCampaign({ npcs: [{ id: 'npc-1', name: 'Robert' }] });
        const onMentionedIdsChange = vi.fn();

        // Prose still says "@Bob"; the NPC has since been renamed to "Robert",
        // so resolveMentionCandidates hydrates initialMentions with the NEW name.
        render(
            <MentionInput
                value="@Bob guards the gate"
                onChange={() => {}}
                onMentionedIdsChange={onMentionedIdsChange}
                initialMentions={[{ id: 'npc-1', name: 'Robert', type: 'npc' }]}
                aria-label="Description"
            />,
        );

        const el = screen.getByLabelText('Description') as HTMLTextAreaElement;
        typeInto(el, '@Bob guards the gate.');

        expect(onMentionedIdsChange).toHaveBeenCalled();
        const reported = onMentionedIdsChange.mock.calls.at(-1)![0] as string[];
        expect(reported).toContain('npc-1');
    });

    // BLOCKER regression guard: editors are not keyed by entity id (ViewRouter
    // renders <NpcEditor npc={selectedNpc}/> at a fixed position and
    // useEntitySelection batches the swap into one commit), so MentionInput
    // never unmounts when the GM navigates from entity A's editor to entity
    // B's. Seeding the internal ref maps only once (via useRef initialisers)
    // meant every field of B's editor kept reporting A's seeded IDs on the
    // next keystroke, silently clobbering B's real mentionedEntityIds.
    it('does NOT leak entity A\'s seeded mention IDs into entity B after a re-render with different initialMentions (no unmount)', () => {
        seedCampaign({ npcs: [{ id: 'npc-a', name: 'Alpha' }, { id: 'npc-b', name: 'Beta' }] });
        const onMentionedIdsChange = vi.fn();

        const { rerender } = render(
            <MentionInput
                value="@Gate Guard watches"
                onChange={() => {}}
                onMentionedIdsChange={onMentionedIdsChange}
                initialMentions={[{ id: 'ext-1', name: 'Gate Guard', type: 'npc' }]}
                aria-label="Description"
            />,
        );

        // Simulate the SAME component instance being reused for a different
        // entity (B), whose text has no mentions and whose initialMentions is
        // empty — this is exactly what happens when NpcEditor swaps `npc` prop
        // without the component tree unmounting.
        rerender(
            <MentionInput
                value=""
                onChange={() => {}}
                onMentionedIdsChange={onMentionedIdsChange}
                initialMentions={[]}
                aria-label="Description"
            />,
        );

        onMentionedIdsChange.mockClear();
        const el = screen.getByLabelText('Description') as HTMLTextAreaElement;
        typeInto(el, 'B');

        expect(onMentionedIdsChange).toHaveBeenCalled();
        const reported = onMentionedIdsChange.mock.calls.at(-1)![0] as string[];
        expect(reported).not.toContain('ext-1');
        expect(reported).toEqual([]);
    });

    it('still applies the #18 union correctly for entity B once B is re-seeded with its own mentions', () => {
        seedCampaign({ npcs: [{ id: 'npc-a', name: 'Alpha' }, { id: 'npc-b', name: 'Beta' }] });
        const onMentionedIdsChange = vi.fn();

        const { rerender } = render(
            <MentionInput
                value="@Alpha visits"
                onChange={() => {}}
                onMentionedIdsChange={onMentionedIdsChange}
                initialMentions={[{ id: 'npc-a', name: 'Alpha', type: 'npc' }]}
                aria-label="Description"
            />,
        );

        // Swap to entity B, seeded with B's OWN previously-persisted mention.
        rerender(
            <MentionInput
                value="@Old-Beta-Name text"
                onChange={() => {}}
                onMentionedIdsChange={onMentionedIdsChange}
                initialMentions={[{ id: 'npc-renamed', name: 'Beta', type: 'npc' }]}
                aria-label="Description"
            />,
        );

        onMentionedIdsChange.mockClear();
        const el = screen.getByLabelText('Description') as HTMLTextAreaElement;
        typeInto(el, '@Old-Beta-Name text.');

        const reported = onMentionedIdsChange.mock.calls.at(-1)![0] as string[];
        // B's own seeded id survives (the #18 union still works)...
        expect(reported).toContain('npc-renamed');
        // ...but A's stale id must not leak in.
        expect(reported).not.toContain('npc-a');
    });
});

// ── #51 — combobox ARIA ──────────────────────────────────────────────────────

describe('wp-d-linking #51 — the mention dropdown must be exposed to assistive tech', () => {
    function openDropdown() {
        seedCampaign({
            npcs: [
                { id: 'npc-1', name: 'Salvia Dane' },
                { id: 'npc-2', name: 'Salazar' },
            ],
            locations: [{ id: 'loc-1', name: 'Salvation' }],
        });

        render(
            <MentionInput value="" onChange={() => {}} aria-label="Notes" />,
        );
        const el = screen.getByLabelText('Notes') as HTMLTextAreaElement;
        typeInto(el, '@sal');
        return el;
    }

    it('marks the input as a combobox that controls the listbox', () => {
        const el = openDropdown();
        const listbox = screen.getByRole('listbox');

        expect(el.getAttribute('role')).toBe('combobox');
        expect(listbox.id).toBeTruthy();
        expect(el.getAttribute('aria-controls')).toBe(listbox.id);
    });

    it('points aria-activedescendant at the highlighted option and moves it with ArrowDown', () => {
        const el = openDropdown();

        const firstActive = el.getAttribute('aria-activedescendant');
        expect(firstActive).toBeTruthy();
        expect(document.getElementById(firstActive!)).not.toBeNull();
        expect(document.getElementById(firstActive!)!.getAttribute('role')).toBe('option');
        expect(document.getElementById(firstActive!)!.getAttribute('aria-selected')).toBe('true');

        fireEvent.keyDown(el, { key: 'ArrowDown' });

        const secondActive = el.getAttribute('aria-activedescendant');
        expect(secondActive).toBeTruthy();
        expect(secondActive).not.toBe(firstActive);
    });

    it('keeps listbox → option ownership intact (wrappers must be role="group")', () => {
        openDropdown();
        const listbox = screen.getByRole('listbox');
        const options = Array.from(listbox.querySelectorAll('[role="option"]'));
        expect(options.length).toBeGreaterThan(0);

        for (const option of options) {
            let node = option.parentElement;
            while (node && node !== listbox) {
                const role = node.getAttribute('role');
                expect(['group', 'presentation', 'none']).toContain(role);
                node = node.parentElement;
            }
            expect(node).toBe(listbox);
        }
    });

    // The dropdown only RENDERS when `isOpen && filtered.length > 0`, but
    // aria-expanded/aria-controls were previously gated on `isOpen` alone —
    // so an "@zzz" query with zero matches claimed to be expanded and
    // pointed aria-controls at a listbox id that does not exist in the DOM
    // (a dangling IDREF some screen readers report as an error).
    it('does not claim to be expanded (or point aria-controls at a non-existent listbox) when there are no matches', () => {
        seedCampaign({ npcs: [{ id: 'npc-1', name: 'Salvia Dane' }] });

        render(<MentionInput value="" onChange={() => {}} aria-label="Notes" />);
        const el = screen.getByLabelText('Notes') as HTMLTextAreaElement;
        typeInto(el, '@zzz');

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(el.getAttribute('aria-expanded')).toBe('false');
        expect(el.getAttribute('aria-controls')).toBeNull();
    });
});

// ── #52 — Escape closes only the dropdown ────────────────────────────────────

describe('wp-d-linking #52 — Escape must not escape the mention dropdown', () => {
    it('does not let Escape reach a document-level keydown listener while the dropdown is open', () => {
        seedCampaign({ npcs: [{ id: 'npc-1', name: 'Salvia Dane' }] });
        const documentEscape = vi.fn();
        const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') documentEscape(); };
        document.addEventListener('keydown', listener);

        try {
            render(<MentionInput value="" onChange={() => {}} aria-label="Prompt" />);
            const el = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
            typeInto(el, '@sal');
            expect(screen.queryByRole('listbox')).not.toBeNull();

            fireEvent.keyDown(el, { key: 'Escape' });

            // Dropdown closes...
            expect(screen.queryByRole('listbox')).toBeNull();
            // ...and the host (DmCoach registers exactly this listener) survives.
            expect(documentEscape).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener('keydown', listener);
        }
    });

    it('DialogShell ignores an Escape a child has already handled', () => {
        const onClose = vi.fn();

        render(
            <DialogShell isOpen onClose={onClose} ariaLabel="Host dialog">
                <input
                    aria-label="Inner field"
                    onKeyDown={e => { if (e.key === 'Escape') e.preventDefault(); }}
                />
            </DialogShell>,
        );

        fireEvent.keyDown(screen.getByLabelText('Inner field'), { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();
    });
});
