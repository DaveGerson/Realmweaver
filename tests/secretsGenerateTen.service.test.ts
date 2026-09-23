/**
 * SPEC — Wave 2, lane SECRETS (R2): the "Generate ten" AI stack.
 *
 * `docs/design/lazy-dm-lens.md` R2 is Shea's step 4 verbatim: over-prepare a
 * cheap list of secrets and clues, keep the ones you like, discard the rest at
 * no cost. The AI half of that is ONE model call that proposes roughly ten
 * entries from campaign context.
 *
 * THE STACK (the mandatory three-file shape from `services/ai/CLAUDE.md`):
 *
 *   `services/ai/realmWeaver.ts`  → `generateSecretBatch(prompt, campaignContext?)`
 *   `services/ai/mockService.ts`  → `generateSecretBatch(prompt, campaignContext?)`
 *   `services/aiService.ts`       → `generateSecretBatch(prompt, isMockMode?, campaignContext?)`
 *
 * plus `export type { SecretDraft }` from the facade, so `SecretsTracker` never
 * imports `services/ai/*`.
 *
 * A `SecretDraft` is `{ title, content, category, notes? }` — no `id`, no
 * `createdAt`, no `isRevealed`. Nothing is persisted until the GM keeps a card
 * and `campaignService.createSecret` mints those. It deliberately lives in
 * `services/ai/realmWeaver.ts`, not in `types/`: this lane's only permitted
 * `types/` change is the three `Secret` fields.
 *
 * CONTRACT
 *
 * 1. **One call.** `realmWeaver.generateSecretBatch` invokes
 *    `core.generateWithSchema` exactly once — never once per proposal. The
 *    caller's prompt reaches the model, the caller's `campaignContext` is
 *    passed through as the context argument (the caller builds it with
 *    `buildCampaignContext({ variant: 'generation', ... })`), and the
 *    instructions ask for about ten entries.
 *
 * 2. **The schema names the shape.** It asks for `title`, `content` and a
 *    `category` constrained to the four `Secret` categories.
 *
 * 3. **Model output is made safe here, not downstream.** The result is ALWAYS
 *    an array — `[]` for null/garbage/an empty payload, never a throw. Both a
 *    `{ secrets: [...] }` envelope and a bare array are accepted. An entry
 *    missing a non-blank `title` or `content` is dropped. An unrecognised
 *    `category` falls back to `'secret'`. A blank `notes` is omitted rather
 *    than stored as `''`. The batch is capped at 12 so a runaway model cannot
 *    flood the preview panel.
 *
 * 4. **Mock parity is mandatory.** `mockService.generateSecretBatch` resolves
 *    to roughly ten well-formed, distinct drafts and never touches the provider
 *    stack. The facade routes to it whenever `isMockMode` is true and to
 *    `realmWeaver` otherwise. No test in this repo may reach the Claude CLI or
 *    the network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const core = vi.hoisted(() => ({ generateWithSchema: vi.fn() }));

vi.mock('../services/ai/core', () => ({
    generateWithSchema: core.generateWithSchema,
    generateText: vi.fn(),
    generateChatCompletion: vi.fn(),
}));

const { generateSecretBatch: realGenerateSecretBatch } = await import('../services/ai/realmWeaver');
const mockService = await import('../services/ai/mockService');
const aiService = await import('../services/aiService');

const CATEGORIES = ['secret', 'clue', 'revelation', 'rumor'];

const draft = (over: Record<string, unknown> = {}) => ({
    title: 'The wet footprints',
    content: 'They lead away from the throne, never toward it.',
    category: 'clue',
    ...over,
});

beforeEach(() => {
    core.generateWithSchema.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1 + 2. One call, with the right prompt, context and schema
// ---------------------------------------------------------------------------

describe('realmWeaver.generateSecretBatch — one call, one schema', () => {
    it('calls generateWithSchema exactly once', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [draft()] });

        await realGenerateSecretBatch('Ten secrets for tonight', 'CONTEXT BLOCK');

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    });

    it('passes the caller prompt and the campaign context through', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [draft()] });

        await realGenerateSecretBatch('Focus on the drowned court', 'CAMPAIGN CONTEXT BLOCK');

        const args = core.generateWithSchema.mock.calls[0];
        expect(String(args[0])).toContain('Focus on the drowned court');
        expect(args).toContain('CAMPAIGN CONTEXT BLOCK');
    });

    it('asks the model for about ten entries', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [draft()] });

        await realGenerateSecretBatch('', undefined);

        const instructions = String(core.generateWithSchema.mock.calls[0][2] ?? '');
        expect(instructions.toLowerCase()).toMatch(/\bten\b|\b10\b/);
    });

    it('sends a schema naming title, content and the four categories', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [draft()] });

        await realGenerateSecretBatch('', undefined);

        const schema = JSON.stringify(core.generateWithSchema.mock.calls[0][1]);
        expect(schema).toContain('title');
        expect(schema).toContain('content');
        expect(schema).toContain('category');
        for (const category of CATEGORIES) {
            expect(schema).toContain(category);
        }
    });
});

// ---------------------------------------------------------------------------
// 3. Normalisation of model output
// ---------------------------------------------------------------------------

describe('realmWeaver.generateSecretBatch — model output is made safe', () => {
    it('unwraps a { secrets: [...] } envelope', async () => {
        core.generateWithSchema.mockResolvedValue({
            secrets: [draft({ title: 'One' }), draft({ title: 'Two' })],
        });

        const result = await realGenerateSecretBatch('', undefined);

        expect(result.map(d => d.title)).toEqual(['One', 'Two']);
    });

    it('accepts a bare array just as well', async () => {
        core.generateWithSchema.mockResolvedValue([draft({ title: 'One' })]);

        expect((await realGenerateSecretBatch('', undefined)).map(d => d.title)).toEqual(['One']);
    });

    it('returns an empty array for null, garbage or an empty payload', async () => {
        for (const payload of [null, undefined, {}, { secrets: null }, 'nope', 42]) {
            core.generateWithSchema.mockResolvedValue(payload);
            await expect(realGenerateSecretBatch('', undefined)).resolves.toEqual([]);
        }
    });

    it('drops entries with a blank or missing title or content', async () => {
        core.generateWithSchema.mockResolvedValue({
            secrets: [
                draft({ title: 'Keeps this one' }),
                draft({ title: '   ' }),
                draft({ title: undefined }),
                draft({ content: '' }),
                draft({ content: undefined }),
            ],
        });

        const result = await realGenerateSecretBatch('', undefined);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Keeps this one');
    });

    it('falls back to the "secret" category for anything unrecognised', async () => {
        core.generateWithSchema.mockResolvedValue({
            secrets: [
                draft({ title: 'A', category: 'mystery' }),
                draft({ title: 'B', category: undefined }),
                draft({ title: 'C', category: 'revelation' }),
            ],
        });

        const result = await realGenerateSecretBatch('', undefined);

        expect(result.map(d => d.category)).toEqual(['secret', 'secret', 'revelation']);
    });

    it('omits a blank notes rather than storing an empty string', async () => {
        core.generateWithSchema.mockResolvedValue({
            secrets: [draft({ title: 'A', notes: '   ' }), draft({ title: 'B', notes: 'Use in scene 2.' })],
        });

        const result = await realGenerateSecretBatch('', undefined);

        expect(result[0].notes).toBeUndefined();
        expect(result[1].notes).toBe('Use in scene 2.');
    });

    it('caps a runaway batch at twelve entries', async () => {
        core.generateWithSchema.mockResolvedValue({
            secrets: Array.from({ length: 40 }, (_, i) => draft({ title: `Entry ${i}` })),
        });

        expect(await realGenerateSecretBatch('', undefined)).toHaveLength(12);
    });

    it('lets a provider error propagate rather than swallowing it into an empty batch', async () => {
        core.generateWithSchema.mockRejectedValue(new Error('Provider exploded'));

        await expect(realGenerateSecretBatch('', undefined)).rejects.toThrow('Provider exploded');
    });
});

// ---------------------------------------------------------------------------
// 4. Mock parity and the facade switch
// ---------------------------------------------------------------------------

describe('mockService.generateSecretBatch — the offline path', () => {
    it('resolves to roughly ten well-formed, distinct drafts', async () => {
        vi.useFakeTimers();

        const pending = mockService.generateSecretBatch('anything', 'CONTEXT');
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(result.length).toBeGreaterThanOrEqual(8);
        expect(result.length).toBeLessThanOrEqual(12);
        for (const entry of result) {
            expect(entry.title.trim().length).toBeGreaterThan(0);
            expect(entry.content.trim().length).toBeGreaterThan(0);
            expect(CATEGORIES).toContain(entry.category);
            expect(entry).not.toHaveProperty('id');
            expect(entry).not.toHaveProperty('createdAt');
            expect(entry).not.toHaveProperty('isRevealed');
        }
        expect(new Set(result.map(e => e.title)).size).toBe(result.length);
    });

    it('never touches the provider stack', async () => {
        vi.useFakeTimers();

        const pending = mockService.generateSecretBatch('anything', 'CONTEXT');
        await vi.runAllTimersAsync();
        await pending;

        expect(core.generateWithSchema).not.toHaveBeenCalled();
    });
});

describe('aiService.generateSecretBatch — the facade switch', () => {
    it('routes to the mock when isMockMode is true', async () => {
        vi.useFakeTimers();

        const pending = aiService.generateSecretBatch('anything', true, 'CONTEXT');
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(result.length).toBeGreaterThanOrEqual(8);
        expect(core.generateWithSchema).not.toHaveBeenCalled();
    });

    it('routes to the real generator when isMockMode is false', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [draft()] });

        const result = await aiService.generateSecretBatch('anything', false, 'CONTEXT BLOCK');

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
        expect(core.generateWithSchema.mock.calls[0]).toContain('CONTEXT BLOCK');
        expect(result).toHaveLength(1);
    });

    it('defaults to the real generator when isMockMode is omitted', async () => {
        core.generateWithSchema.mockResolvedValue({ secrets: [] });

        await aiService.generateSecretBatch('anything');

        expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    });
});
