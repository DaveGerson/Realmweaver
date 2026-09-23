/**
 * SPEC — Fantastic Location Aspects (Sly Flourish's Lazy DM step 5, "develop
 * fantastic locations": two or three evocative sensory one-liners, lighter
 * than a paragraph). Files under test: `services/ai/realmWeaver.ts`
 * (`locationSchema`, `generateLocation`'s postProcess, `generateLocationAspects`),
 * `services/ai/mockService.ts` (mock parity for both paths), and
 * `services/aiService.ts` (the facade switch for `generateLocationAspects`).
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * ---------------------------------
 * 1. `locationSchema` gains an OPTIONAL `aspects: string[]` property so a
 *    freshly generated location arrives with its aspects in the SAME model
 *    call as its name/description/secrets — never a second round trip.
 *    "Optional" means not in the schema's `required` array — a model that
 *    omits the field must not fail schema validation.
 *
 * 2. `generateLocation`'s postProcess makes a missing/malformed `aspects`
 *    structurally safe: absent, `null`, a non-array, or an array of
 *    non-strings all normalise to `undefined` — never a thrown error and
 *    never an empty array (`Location.aspects` is meant to be entirely absent
 *    when there is nothing, per `types/Location.ts`). A well-formed array is
 *    trimmed, blanks are dropped, and the result is capped at four entries so
 *    a runaway model cannot flood the editor's list.
 *
 * 3. `generateLocationAspects(location, campaignContext?)` retrofits aspects
 *    onto an existing location in ONE standalone `generateWithSchema` call —
 *    it is not a re-run of the full location generator. The "prompt" is
 *    built entirely from the location's own name/description: this is a
 *    zero-typed-prompt feature, so nothing the caller passes is a free-text
 *    box a DM edited. It never throws on malformed model output — the result
 *    is always an array, possibly empty (mirroring `generateSecretBatch`'s
 *    contract) — but a provider-level rejection still propagates.
 *
 * 4. Mock parity is mandatory for both paths: `mockService.generateLocation`
 *    now includes non-blank aspects, and `mockService.generateLocationAspects`
 *    resolves to a well-formed, non-empty array without touching the
 *    provider stack.
 *
 * 5. The facade (`services/aiService.ts`) owns the mock switch for
 *    `generateLocationAspects`, exactly like every other AI facade function.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const core = vi.hoisted(() => ({ generateWithSchema: vi.fn() }));

vi.mock('../../services/ai/core', () => ({
    generateWithSchema: core.generateWithSchema,
    generateText: vi.fn(),
    generateChatCompletion: vi.fn(),
}));

const {
    locationSchema,
    generateLocation: realGenerateLocation,
    generateLocationAspects: realGenerateLocationAspects,
} = await import('../../services/ai/realmWeaver');
const mockService = await import('../../services/ai/mockService');
const aiService = await import('../../services/aiService');

beforeEach(() => {
    core.generateWithSchema.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. locationSchema — aspects is present, optional, and array-of-string
// ---------------------------------------------------------------------------

describe('realmWeaver.locationSchema — the widened schema', () => {
    it('declares an aspects property typed as an array of strings', () => {
        const aspectsProp = (locationSchema.properties as Record<string, { type: string; items?: { type: string } }>).aspects;

        expect(aspectsProp).toBeDefined();
        expect(aspectsProp.type).toBe('array');
        expect(aspectsProp.items?.type).toBe('string');
    });

    it('does not require aspects — a model that omits it is still schema-valid', () => {
        expect(locationSchema.required).not.toContain('aspects');
        // The three original fields must still be required — widening must not
        // loosen the existing contract.
        expect(locationSchema.required).toEqual(['name', 'description', 'secrets']);
    });
});

// ---------------------------------------------------------------------------
// 2. generateLocation — postProcess tolerates missing/malformed aspects
// ---------------------------------------------------------------------------

describe('realmWeaver.generateLocation — aspects postProcess', () => {
    it('passes through a clean aspects array from the model', async () => {
        core.generateWithSchema.mockResolvedValue({
            name: 'The Sunken Ward',
            description: 'A flooded district.',
            secrets: 'A hidden trapdoor.',
            aspects: ['Cold water laps at ankle height.', 'Rot and salt hang in the air.'],
        });

        const location = await realGenerateLocation('A flooded district', undefined);

        expect(location.aspects).toEqual([
            'Cold water laps at ankle height.',
            'Rot and salt hang in the air.',
        ]);
    });

    const tolerated: Array<[string, unknown]> = [
        ['the field is absent entirely', undefined],
        ['the field is null', null],
        ['the field is a non-array string', 'not an array'],
        ['the field is a number', 42],
        ['every entry is a non-string', [1, 2, 3]],
    ];

    it.each(tolerated)('normalises to undefined, never throws, when %s', async (_label, aspectsValue) => {
        const payload: Record<string, unknown> = {
            name: 'The Sunken Ward',
            description: 'A flooded district.',
            secrets: 'A hidden trapdoor.',
        };
        if (aspectsValue !== undefined) payload.aspects = aspectsValue;
        core.generateWithSchema.mockResolvedValue(payload);

        let location: Awaited<ReturnType<typeof realGenerateLocation>> | undefined;
        await expect(async () => {
            location = await realGenerateLocation('A flooded district', undefined);
        }).not.toThrow();

        expect(location?.aspects).toBeUndefined();
    });

    it('trims whitespace and drops blank entries', async () => {
        core.generateWithSchema.mockResolvedValue({
            name: 'The Sunken Ward',
            description: 'A flooded district.',
            secrets: 'A hidden trapdoor.',
            aspects: ['  Real aspect.  ', '   ', '', 'Another real one.'],
        });

        const location = await realGenerateLocation('A flooded district', undefined);

        expect(location.aspects).toEqual(['Real aspect.', 'Another real one.']);
    });

    it('caps a runaway aspects array at four entries', async () => {
        core.generateWithSchema.mockResolvedValue({
            name: 'The Sunken Ward',
            description: 'A flooded district.',
            secrets: 'A hidden trapdoor.',
            aspects: Array.from({ length: 20 }, (_, i) => `Aspect ${i}`),
        });

        const location = await realGenerateLocation('A flooded district', undefined);

        expect(location.aspects).toHaveLength(4);
    });

    it('an all-blank aspects array normalises to undefined, not an empty array', async () => {
        core.generateWithSchema.mockResolvedValue({
            name: 'The Sunken Ward',
            description: 'A flooded district.',
            secrets: 'A hidden trapdoor.',
            aspects: ['   ', ''],
        });

        const location = await realGenerateLocation('A flooded district', undefined);

        expect(location.aspects).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. generateLocationAspects — one call, zero-typed-prompt, safe output
// ---------------------------------------------------------------------------

describe('realmWeaver.generateLocationAspects — one call, one schema', () => {
    it('calls generateWithSchema exactly once', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects({ name: 'The Sunken Ward', description: 'A flooded district.' });

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    });

    it('builds the prompt from the location\'s own name and description — nothing else', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects({ name: 'The Weeping Cistern', description: 'A forgotten reservoir.' });

        const prompt = String(core.generateWithSchema.mock.calls[0][0]);
        expect(prompt).toContain('The Weeping Cistern');
        expect(prompt).toContain('A forgotten reservoir.');
    });

    it('falls back to "Not specified" for an empty description rather than leaving it blank', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects({ name: 'The Weeping Cistern', description: '' });

        const prompt = String(core.generateWithSchema.mock.calls[0][0]);
        expect(prompt).toContain('Not specified');
    });

    it('passes the caller campaign context through', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects(
            { name: 'The Weeping Cistern', description: 'A forgotten reservoir.' },
            'CAMPAIGN CONTEXT BLOCK',
        );

        expect(core.generateWithSchema.mock.calls[0]).toContain('CAMPAIGN CONTEXT BLOCK');
    });

    it('sends a schema naming a plain array-of-strings aspects field', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects({ name: 'The Weeping Cistern', description: 'A forgotten reservoir.' });

        const schema = core.generateWithSchema.mock.calls[0][1] as {
            properties: { aspects: { type: string; items?: { type: string } } };
            required: string[];
        };
        expect(schema.properties.aspects.type).toBe('array');
        expect(schema.properties.aspects.items?.type).toBe('string');
        expect(schema.required).toContain('aspects');
    });

    it('the request never carries a caller-typed prompt box — only name/description reach the model', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        await realGenerateLocationAspects({ name: 'X', description: 'Y' });

        // The instructions (not the prompt) carry the fixed, non-editable ask.
        const instructions = String(core.generateWithSchema.mock.calls[0][2] ?? '');
        expect(instructions.toLowerCase()).toContain('sensory');
    });

    it('normalises the result: trims, drops blanks, caps at four', async () => {
        core.generateWithSchema.mockResolvedValue({
            aspects: ['  One.  ', '', '   ', 'Two.', 'Three.', 'Four.', 'Five.'],
        });

        const result = await realGenerateLocationAspects({ name: 'X', description: 'Y' });

        expect(result).toEqual(['One.', 'Two.', 'Three.', 'Four.']);
    });

    it('returns an empty array — never throws — for null, garbage, or an empty payload', async () => {
        for (const payload of [null, undefined, {}, { aspects: null }, 'nope', 42]) {
            core.generateWithSchema.mockResolvedValue(payload);
            await expect(
                realGenerateLocationAspects({ name: 'X', description: 'Y' }),
            ).resolves.toEqual([]);
        }
    });

    it('lets a provider error propagate rather than swallowing it into an empty array', async () => {
        core.generateWithSchema.mockRejectedValue(new Error('Provider exploded'));

        await expect(
            realGenerateLocationAspects({ name: 'X', description: 'Y' }),
        ).rejects.toThrow('Provider exploded');
    });
});

// ---------------------------------------------------------------------------
// 4. Mock parity
// ---------------------------------------------------------------------------

describe('mockService.generateLocation — includes aspects', () => {
    it('resolves with 2-3 non-blank aspects alongside the rest of the location', async () => {
        vi.useFakeTimers();

        const pending = mockService.generateLocation('anything', 'CONTEXT');
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(Array.isArray(result.aspects)).toBe(true);
        expect(result.aspects!.length).toBeGreaterThanOrEqual(2);
        expect(result.aspects!.length).toBeLessThanOrEqual(3);
        for (const aspect of result.aspects!) {
            expect(aspect.trim().length).toBeGreaterThan(0);
        }
    });
});

describe('mockService.generateLocationAspects — the offline path', () => {
    it('resolves to a well-formed, non-empty array of aspects', async () => {
        vi.useFakeTimers();

        const pending = mockService.generateLocationAspects(
            { name: 'The Sunken Ward', description: 'A flooded district.' },
            'CONTEXT',
        );
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(result.length).toBeGreaterThan(0);
        for (const aspect of result) {
            expect(typeof aspect).toBe('string');
            expect(aspect.trim().length).toBeGreaterThan(0);
        }
    });

    it('never touches the provider stack', async () => {
        vi.useFakeTimers();

        const pending = mockService.generateLocationAspects({ name: 'X', description: 'Y' });
        await vi.runAllTimersAsync();
        await pending;

        expect(core.generateWithSchema).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 5. The facade switch
// ---------------------------------------------------------------------------

describe('aiService.generateLocationAspects — the facade switch', () => {
    it('routes to the mock when isMockMode is true', async () => {
        vi.useFakeTimers();

        const pending = aiService.generateLocationAspects(
            { name: 'X', description: 'Y' },
            true,
            'CONTEXT',
        );
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(result.length).toBeGreaterThan(0);
        expect(core.generateWithSchema).not.toHaveBeenCalled();
    });

    it('routes to the real generator when isMockMode is false, passing context through', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: ['A damp draft.'] });

        const result = await aiService.generateLocationAspects(
            { name: 'X', description: 'Y' },
            false,
            'CONTEXT BLOCK',
        );

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
        expect(core.generateWithSchema.mock.calls[0]).toContain('CONTEXT BLOCK');
        expect(result).toEqual(['A damp draft.']);
    });

    it('defaults to the real generator when isMockMode is omitted', async () => {
        core.generateWithSchema.mockResolvedValue({ aspects: [] });

        await aiService.generateLocationAspects({ name: 'X', description: 'Y' });

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    });
});
