// @vitest-environment jsdom
/**
 * SPEC — the Voice field in the NPC editor (Wave 2, lane VOICE / P3).
 *
 * Source: docs/design/storyteller-first-design.md §P3 — "`NPC.voiceNotes?:
 * string` — accent, cadence, verbal tics, register ... One optional field,
 * edited in `NpcEditor`". Tone follows docs/design/schema-presentation-guide.md:
 * the DM meets a field that invites them to write, never a schema key.
 *
 * THE CONTRACT
 *
 * 1. IT IS ON THE PERSONALITY TAB, BESIDE THE EXAMPLE QUOTE. How a character
 *    sounds belongs with what they say, not with their stat block. The field is
 *    a textarea with an accessible name of "Voice" — the DM is never shown the
 *    field name `voiceNotes`.
 *
 * 2. THE LABEL COPY INVITES. The placeholder tells the DM what to put there in
 *    the guide's own register — it names the concrete things ("accent",
 *    "cadence", verbal tics) rather than describing a data field, and it never
 *    reads as a requirement.
 *
 * 3. IT WRITES THROUGH THE NORMAL PATH. Typing does not write to the store;
 *    blur commits `{ voiceNotes: <text> }` through the editor's `onUpdate`
 *    prop, exactly like Example Quote and Stats. Blurring an unchanged field
 *    writes nothing.
 *
 * 4. OLD SAVES JUST WORK. An NPC saved before this field existed has no
 *    `voiceNotes` at all — `createDefaultNpc()` does not mint one. The field
 *    still renders, as a controlled empty textarea, with no React
 *    controlled/uncontrolled warning, and the DM can fill it in.
 *
 * 5. IT IS ONE FIELD, NOT A SCHEMA CHANGE IN DISGUISE. Committing Voice writes
 *    only `voiceNotes`; no other NPC field is touched by the write.
 *
 * 6. Slate/amber only — indigo belongs to RealmChat.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, NPC } from '../types/index';

type OnUpdateFn = (id: string, updatedData: Partial<NPC>) => void;

vi.mock('../services/aiService', () => ({
    generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../services/campaignService', () => ({
    campaignService: {
        subscribe: () => () => {},
        getState: () => storeState,
        getActiveCampaign: () => undefined,
        updateNpc: vi.fn(),
        updateLocation: vi.fn(),
    },
}));

const { NpcEditor } = await import('../components/editors/NpcEditor');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** An NPC written by a build that predates `voiceNotes` — the common case. */
const legacyNpc = {
    id: 'npc-1',
    name: 'Serah Vantt',
    description: 'Harbourmaster, salt-bleached coat.',
    traits: 'Counts on her fingers when lying.',
    motivations: 'Keep the harbour open.',
    secrets: '',
    backstory: '',
    stats: '',
    exampleQuote: 'The tide does not negotiate.',
    knowsPlayerHistory: [],
    relationships: [],
    history: [],
    mentionedEntityIds: [],
} as unknown as NPC;

const campaign = {
    id: 'camp-1', title: 'Ashfall',
    npcs: [legacyNpc], locations: [], factions: [], items: [], adventures: [],
    articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const renderEditor = (npc: NPC, onUpdate: ReturnType<typeof vi.fn<OnUpdateFn>>) =>
    render(
        <ConfirmDialogProvider>
            <NpcEditor
                npc={npc}
                factions={[]}
                campaign={{ ...campaign, npcs: [npc] } as unknown as Campaign}
                onUpdate={onUpdate}
                onDelete={() => {}}
                isMockMode
            />
        </ConfirmDialogProvider>
    );

const openPersonalityTab = () => {
    fireEvent.click(screen.getByRole('tab', { name: /personality/i }));
};

const voiceField = () => screen.getByRole('textbox', { name: /voice/i }) as HTMLTextAreaElement;

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// ── 1 & 4. It is there, on the personality tab, for every NPC ─────────────────

describe('NpcEditor — the Voice field', () => {
    it('is on the Personality tab', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        const field = voiceField();
        expect(field.tagName).toBe('TEXTAREA');
    });

    it('is not on the Identity tab the editor opens on', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());

        expect(screen.queryByRole('textbox', { name: /voice/i })).toBeNull();
    });

    it('sits beside the Example Quote — how they sound next to what they say', () => {
        const { container } = renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        const quote = container.querySelector<HTMLTextAreaElement>('textarea[name="exampleQuote"]');
        expect(quote, 'exampleQuote textarea not found').toBeTruthy();

        // Adjacent in the tab panel: nothing but the two of them between the pair.
        const textareas = Array.from(container.querySelectorAll('textarea'));
        const gap = Math.abs(textareas.indexOf(voiceField()) - textareas.indexOf(quote!));
        expect(gap, 'Voice must be rendered next to Example Quote').toBe(1);
    });

    it('renders empty — not "undefined" — for an NPC saved before the field existed', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        expect(legacyNpc.voiceNotes).toBeUndefined();
        expect(voiceField().value).toBe('');
    });

    it('emits no controlled/uncontrolled React warning for a legacy NPC', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();
        fireEvent.change(voiceField(), { target: { value: 'Clipped.' } });

        const warnings = consoleError.mock.calls
            .map(c => String(c[0] ?? ''))
            .filter(m => /uncontrolled|controlled input|value prop/i.test(m));
        expect(warnings, warnings.join('\n')).toHaveLength(0);
    });

    it('shows the voice an NPC already has', () => {
        const voiced = { ...legacyNpc, voiceNotes: "Clipped sentences; calls everyone 'pet'." } as NPC;
        renderEditor(voiced, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        expect(voiceField().value).toBe("Clipped sentences; calls everyone 'pet'.");
    });
});

// ── 2. The copy invites ───────────────────────────────────────────────────────

describe('NpcEditor — the Voice field asks the DM a question they can answer', () => {
    it('prompts with the concrete things a voice is made of', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        const placeholder = voiceField().getAttribute('placeholder') ?? '';
        expect(placeholder).toMatch(/accent/i);
        expect(placeholder).toMatch(/cadence|rhythm/i);
        expect(placeholder.length, 'the placeholder must actually say something').toBeGreaterThan(30);
    });

    it('never shows the DM the field name', () => {
        const { container } = renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        expect(container.textContent).not.toContain('voiceNotes');
    });

    it('does not phrase the field as a requirement', () => {
        renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        const placeholder = voiceField().getAttribute('placeholder') ?? '';
        expect(placeholder).not.toMatch(/\brequired\b|\bmust\b/i);
    });

    it('uses no indigo — that accent belongs to RealmChat', () => {
        const { container } = renderEditor(legacyNpc, vi.fn<OnUpdateFn>());
        openPersonalityTab();

        expect(container.innerHTML).not.toContain('indigo');
    });
});

// ── 3 & 5. It writes through the normal path ──────────────────────────────────

describe('NpcEditor — committing the Voice field', () => {
    it('commits on blur, through onUpdate, keyed to this NPC', () => {
        const onUpdate = vi.fn<OnUpdateFn>();
        renderEditor(legacyNpc, onUpdate);
        openPersonalityTab();

        const field = voiceField();
        fireEvent.change(field, { target: { value: 'Low, unhurried. Never finishes a threat.' } });
        fireEvent.blur(field);

        const writes = onUpdate.mock.calls.filter(c => 'voiceNotes' in (c[1] ?? {}));
        expect(writes).toHaveLength(1);
        expect(writes[0][0]).toBe('npc-1');
        expect(writes[0][1]).toEqual({ voiceNotes: 'Low, unhurried. Never finishes a threat.' });
    });

    it('does not write on every keystroke', () => {
        const onUpdate = vi.fn<OnUpdateFn>();
        renderEditor(legacyNpc, onUpdate);
        openPersonalityTab();

        const field = voiceField();
        fireEvent.change(field, { target: { value: 'L' } });
        fireEvent.change(field, { target: { value: 'Lo' } });
        fireEvent.change(field, { target: { value: 'Low' } });

        expect(onUpdate.mock.calls.filter(c => 'voiceNotes' in (c[1] ?? {}))).toHaveLength(0);
    });

    it('writes nothing when the field is blurred unchanged', () => {
        const voiced = { ...legacyNpc, voiceNotes: 'Clipped.' } as NPC;
        const onUpdate = vi.fn<OnUpdateFn>();
        renderEditor(voiced, onUpdate);
        openPersonalityTab();

        fireEvent.blur(voiceField());

        expect(onUpdate.mock.calls.filter(c => 'voiceNotes' in (c[1] ?? {}))).toHaveLength(0);
    });

    it('can be cleared back to empty', () => {
        const voiced = { ...legacyNpc, voiceNotes: 'Clipped.' } as NPC;
        const onUpdate = vi.fn<OnUpdateFn>();
        renderEditor(voiced, onUpdate);
        openPersonalityTab();

        const field = voiceField();
        fireEvent.change(field, { target: { value: '' } });
        fireEvent.blur(field);

        const writes = onUpdate.mock.calls.filter(c => 'voiceNotes' in (c[1] ?? {}));
        expect(writes).toHaveLength(1);
        expect(writes[0][1]).toEqual({ voiceNotes: '' });
    });

    it('touches nothing but voiceNotes', () => {
        const onUpdate = vi.fn<OnUpdateFn>();
        renderEditor(legacyNpc, onUpdate);
        openPersonalityTab();

        const field = voiceField();
        fireEvent.change(field, { target: { value: 'Clipped.' } });
        fireEvent.blur(field);

        const write = onUpdate.mock.calls.find(c => 'voiceNotes' in (c[1] ?? {}))!;
        expect(Object.keys(write[1])).toEqual(['voiceNotes']);
    });
});
