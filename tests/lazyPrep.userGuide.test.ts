/**
 * SPEC — docs/USER_GUIDE.md (Wave 1, lane R1: documenting beats and the lazy prep path)
 *
 * Source: docs/design/lazy-dm-lens.md §2 step 3 — "It is also undocumented:
 * docs/USER_GUIDE.md's Running a Session section never mentions Beats, and its
 * one 'Beat Tracking' bullet (under Adventures and Scenes) describes something
 * `Scene` doesn't actually have a field for."
 *
 * A structural doc guard, in the spirit of the wp-i2 source-text tests: it reads
 * the guide off disk and asserts on the three sections this lane changes. It
 * checks that the right things are SAID and that the wrong things are GONE — it
 * cannot check that the prose is good, only that it is present, correct about
 * where beats live, and written in the guide's voice.
 *
 * THE CONTRACT
 *
 * 1. THE FALSE BULLET IS GONE. "Adventures and Scenes" no longer claims a scene
 *    carries beat tracking. A scene carries read-aloud text, GM notes, skill
 *    checks and rewards — those four stay.
 *
 * 2. BEATS ARE DOCUMENTED WHERE THEY LIVE. "Running a Session" gains a Beats
 *    subsection that says beats belong to the session (not to a scene), that
 *    they are added, checked off and removed in the Session Runner, and that
 *    they are a loose checklist rather than a structured entity.
 *
 * 3. THE LAZY PATH IS DESCRIBED. "Session Prep" describes it by what the DM
 *    does — write a strong start, list a few beats, glance at the secrets, go —
 *    naming all three of those steps.
 *
 * 4. IT IS SAID IN THE GUIDE'S VOICE, per docs/design/schema-presentation-guide.md
 *    §6 (notation ban) and §7 (tone): no field or type names, no storage
 *    machinery, no emoji, no exclamation marks in the sections this lane owns.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STRONG_START_OPEN, STRONG_START_CLOSE } from './helpers/strongStartFormat';

const guide = readFileSync(fileURLToPath(new URL('../docs/USER_GUIDE.md', import.meta.url)), 'utf8');

/**
 * Returns the body of a markdown section, from its heading up to the next
 * heading of the same or a shallower level. Returns '' if the heading is absent.
 */
function section(markdown: string, heading: string): string {
    const level = heading.match(/^#+/)?.[0].length ?? 2;
    const lines = markdown.split('\n');
    const start = lines.findIndex(l => l.trim() === heading.trim());
    if (start === -1) return '';
    const rest = lines.slice(start + 1);
    const endOffset = rest.findIndex(l => {
        const m = l.match(/^(#+)\s/);
        return !!m && m[1].length <= level;
    });
    return (endOffset === -1 ? rest : rest.slice(0, endOffset)).join('\n');
}

const adventuresAndScenes = () => section(guide, '### Adventures and Scenes');
const runningASession = () => section(guide, '## Running a Session');
const sessionPrep = () => section(guide, '## Session Prep');

describe('USER_GUIDE — the Adventures and Scenes section no longer invents a scene field', () => {
    it('has the section', () => {
        expect(adventuresAndScenes().trim().length).toBeGreaterThan(0);
    });

    it('drops the Beat Tracking bullet', () => {
        expect(adventuresAndScenes()).not.toMatch(/beat tracking/i);
    });

    it('does not describe beats as part of a scene at all', () => {
        expect(adventuresAndScenes()).not.toMatch(/\bbeats\b/i);
    });

    it('keeps the four things a generated scene really carries', () => {
        const body = adventuresAndScenes();
        expect(body).toMatch(/read-aloud text/i);
        expect(body).toMatch(/gm notes/i);
        expect(body).toMatch(/skill checks/i);
        expect(body).toMatch(/rewards/i);
    });
});

describe('USER_GUIDE — Running a Session documents Beats', () => {
    it('has a Beats subsection', () => {
        expect(guide).toMatch(/^### Beats$/m);
        expect(runningASession()).toMatch(/^### Beats$/m);
    });

    const beatsSection = () => section(guide, '### Beats');

    it('says beats belong to the session', () => {
        expect(beatsSection()).toMatch(/\bsession\b/i);
    });

    it('describes adding, checking off, and removing a beat', () => {
        const body = beatsSection();
        expect(body).toMatch(/\badd\w*\b/i);
        expect(body).toMatch(/check\w*\s+(?:\w+\s+)?off/i);
        expect(body).toMatch(/\b(remove|delete)\w*\b/i);
    });

    it('frames them as a loose checklist rather than a structured entity', () => {
        expect(beatsSection()).toMatch(/checklist|loose|quick|jot|list/i);
    });
});

describe('USER_GUIDE — Session Prep describes the lazy path', () => {
    it('names the strong start', () => {
        expect(sessionPrep()).toMatch(/strong start/i);
    });

    it('names beats as something you can list at prep time', () => {
        expect(sessionPrep()).toMatch(/\bbeats\b/i);
    });

    it('names the secrets glance', () => {
        expect(sessionPrep()).toMatch(/\bsecrets?\b/i);
    });

    it('tells the DM the first thing they will say is what a strong start is', () => {
        expect(sessionPrep()).toMatch(/first thing you['’]ll say|first thing you say/i);
    });
});

describe('USER_GUIDE — the changed sections stay in the guide\'s voice', () => {
    const owned = () => [adventuresAndScenes(), runningASession(), sessionPrep()].join('\n');

    it('shows no field, type or property names', () => {
        const body = owned();
        for (const forbidden of [
            'prepNotes',
            'strongStart',
            'SessionLog',
            'linkedEntityIds',
            'isCompleted',
            'plannedSceneIds',
            'activeSceneId',
            'beats[]',
        ]) {
            expect(body).not.toContain(forbidden);
        }
    });

    it('never exposes the storage delimiters', () => {
        expect(guide).not.toContain(STRONG_START_OPEN);
        expect(guide).not.toContain(STRONG_START_CLOSE);
    });

    it('uses no emoji and no exclamation marks', () => {
        const body = owned();
        expect(body).not.toContain('!');
        expect(body).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    });
});
