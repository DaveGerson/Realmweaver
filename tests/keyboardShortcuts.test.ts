import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    SHORTCUTS,
    matchShortcut,
    getModifierSymbol,
    formatShortcut,
} from '../utils/keyboardShortcuts';
import type { KeyboardShortcut } from '../utils/keyboardShortcuts';

// ---------------------------------------------------------------------------
// Mock document.activeElement for isFocusedInInput checks
// ---------------------------------------------------------------------------

beforeEach(() => {
    // Default: focus is NOT in an input (null activeElement)
    vi.stubGlobal('document', {
        activeElement: null,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function setActiveElement(tagName: string, isContentEditable = false) {
    vi.stubGlobal('document', {
        activeElement: {
            tagName: tagName.toUpperCase(),
            isContentEditable,
        },
    });
}

function makeKeyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        key: '',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...overrides,
    } as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// SHORTCUTS constant
// ---------------------------------------------------------------------------

describe('SHORTCUTS', () => {
    it('is a non-empty array', () => {
        expect(SHORTCUTS.length).toBeGreaterThan(0);
    });

    it('every shortcut has required fields', () => {
        for (const s of SHORTCUTS) {
            expect(s.key).toBeTruthy();
            expect(typeof s.ctrlOrMeta).toBe('boolean');
            expect(s.description).toBeTruthy();
            expect(s.action).toBeTruthy();
        }
    });

    it('includes common shortcuts (search, save, close, help)', () => {
        const actions = SHORTCUTS.map(s => s.action);
        expect(actions).toContain('search');
        expect(actions).toContain('save');
        expect(actions).toContain('close');
        expect(actions).toContain('help');
        expect(actions).toContain('new-entity');
    });
});

// ---------------------------------------------------------------------------
// matchShortcut — modifier shortcuts
// ---------------------------------------------------------------------------

describe('matchShortcut — modifier shortcuts', () => {
    it('matches Ctrl+K to search', () => {
        const event = makeKeyEvent({ key: 'k', ctrlKey: true });
        expect(matchShortcut(event)).toBe('search');
    });

    it('matches Meta+K to search (Mac)', () => {
        const event = makeKeyEvent({ key: 'k', metaKey: true });
        expect(matchShortcut(event)).toBe('search');
    });

    it('matches Ctrl+N to new-entity', () => {
        const event = makeKeyEvent({ key: 'n', ctrlKey: true });
        expect(matchShortcut(event)).toBe('new-entity');
    });

    it('matches Ctrl+S to save', () => {
        const event = makeKeyEvent({ key: 's', ctrlKey: true });
        expect(matchShortcut(event)).toBe('save');
    });

    it('still matches modifier shortcuts when focus is in an input', () => {
        setActiveElement('input');
        const event = makeKeyEvent({ key: 's', ctrlKey: true });
        expect(matchShortcut(event)).toBe('save');
    });

    it('still matches modifier shortcuts when focus is in a textarea', () => {
        setActiveElement('textarea');
        const event = makeKeyEvent({ key: 'k', ctrlKey: true });
        expect(matchShortcut(event)).toBe('search');
    });
});

// ---------------------------------------------------------------------------
// matchShortcut — bare key shortcuts
// ---------------------------------------------------------------------------

describe('matchShortcut — bare key shortcuts', () => {
    it('matches / to search when not in input', () => {
        const event = makeKeyEvent({ key: '/' });
        expect(matchShortcut(event)).toBe('search');
    });

    it('matches Escape to close when not in input', () => {
        const event = makeKeyEvent({ key: 'Escape' });
        expect(matchShortcut(event)).toBe('close');
    });

    it('matches ? to help when not in input', () => {
        const event = makeKeyEvent({ key: '?' });
        expect(matchShortcut(event)).toBe('help');
    });

    it('suppresses / when focus is in an input element', () => {
        setActiveElement('input');
        const event = makeKeyEvent({ key: '/' });
        expect(matchShortcut(event)).toBeNull();
    });

    it('suppresses ? when focus is in a textarea', () => {
        setActiveElement('textarea');
        const event = makeKeyEvent({ key: '?' });
        expect(matchShortcut(event)).toBeNull();
    });

    it('suppresses bare key shortcuts when focus is in contenteditable', () => {
        setActiveElement('div', true);
        const event = makeKeyEvent({ key: '/' });
        expect(matchShortcut(event)).toBeNull();
    });

    it('suppresses Escape when focus is in an input', () => {
        setActiveElement('input');
        const event = makeKeyEvent({ key: 'Escape' });
        expect(matchShortcut(event)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// matchShortcut — non-matching events
// ---------------------------------------------------------------------------

describe('matchShortcut — non-matching events', () => {
    it('returns null for unregistered key', () => {
        const event = makeKeyEvent({ key: 'x' });
        expect(matchShortcut(event)).toBeNull();
    });

    it('returns null when ctrlKey is pressed but shortcut does not expect modifier', () => {
        // '/' is a bare key shortcut; pressing Ctrl+/ should not match
        const event = makeKeyEvent({ key: '/', ctrlKey: true });
        expect(matchShortcut(event)).toBeNull();
    });

    it('returns null when altKey is pressed for bare key shortcuts', () => {
        const event = makeKeyEvent({ key: '/', altKey: true });
        expect(matchShortcut(event)).toBeNull();
    });

    it('returns null for bare k (modifier required for search)', () => {
        const event = makeKeyEvent({ key: 'k' });
        expect(matchShortcut(event)).toBeNull();
    });

    it('returns null for bare s (modifier required for save)', () => {
        const event = makeKeyEvent({ key: 's' });
        expect(matchShortcut(event)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// getModifierSymbol
// ---------------------------------------------------------------------------

describe('getModifierSymbol', () => {
    it('returns Ctrl for non-Mac platforms', () => {
        vi.stubGlobal('navigator', { platform: 'Win32' });
        expect(getModifierSymbol()).toBe('Ctrl');
    });

    it('returns command symbol for Mac platform', () => {
        vi.stubGlobal('navigator', { platform: 'MacIntel' });
        expect(getModifierSymbol()).toBe('\u2318'); // ⌘
    });

    it('returns command symbol for iPhone', () => {
        vi.stubGlobal('navigator', { platform: 'iPhone' });
        expect(getModifierSymbol()).toBe('\u2318');
    });

    it('returns Ctrl when navigator is undefined', () => {
        // `navigator` is a read-only global accessor in this environment, so it
        // can't be assigned directly — stub it instead (afterEach unstubs it).
        vi.stubGlobal('navigator', undefined);
        expect(getModifierSymbol()).toBe('Ctrl');
    });
});

// ---------------------------------------------------------------------------
// formatShortcut
// ---------------------------------------------------------------------------

describe('formatShortcut', () => {
    it('formats modifier shortcuts as Mod+KEY', () => {
        vi.stubGlobal('navigator', { platform: 'Win32' });
        const shortcut: KeyboardShortcut = { key: 'k', ctrlOrMeta: true, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('Ctrl+K');
    });

    it('formats bare key shortcuts as just the key', () => {
        const shortcut: KeyboardShortcut = { key: '/', ctrlOrMeta: false, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('/');
    });

    it('formats Escape as Esc', () => {
        const shortcut: KeyboardShortcut = { key: 'Escape', ctrlOrMeta: false, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('Esc');
    });

    it('uppercases letter keys', () => {
        vi.stubGlobal('navigator', { platform: 'Win32' });
        const shortcut: KeyboardShortcut = { key: 's', ctrlOrMeta: true, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('Ctrl+S');
    });

    it('uses command symbol on Mac', () => {
        vi.stubGlobal('navigator', { platform: 'MacIntel' });
        const shortcut: KeyboardShortcut = { key: 'k', ctrlOrMeta: true, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('\u2318+K');
    });

    it('formats ? shortcut correctly', () => {
        const shortcut: KeyboardShortcut = { key: '?', ctrlOrMeta: false, description: '', action: '' };
        expect(formatShortcut(shortcut)).toBe('?');
    });
});
