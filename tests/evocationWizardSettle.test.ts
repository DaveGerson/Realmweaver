import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment } from './helpers/testStoreFactory';

// EvocationWizard transitively imports the entity editors, which touch the
// campaignService singleton — stub localStorage first, matching the pattern
// used by other component-level unit tests (see tests/mentionInput.test.ts).
setupTestEnvironment();

let settleFulfilled: typeof import('../components/dialogs/EvocationWizard').settleFulfilled;

beforeAll(async () => {
  const mod = await import('../components/dialogs/EvocationWizard');
  settleFulfilled = mod.settleFulfilled;
});

describe('settleFulfilled', () => {
  it('returns all values in order when every promise fulfills', async () => {
    const promises = [Promise.resolve('a'), Promise.resolve('b'), Promise.resolve('c')];
    const { values, rejectedCount } = await settleFulfilled(promises, () => {});
    expect(values).toEqual(['a', 'b', 'c']);
    expect(rejectedCount).toBe(0);
  });

  it('keeps the fulfilled values and reports a count instead of discarding the whole batch when one promise rejects', async () => {
    // Regression: this previously used Promise.all, so a single rejected generation
    // call (e.g. one failed NPC prompt) would throw away every other successfully
    // generated entity in the same "Generate" click.
    const promises = [
      Promise.resolve('npc-1'),
      Promise.reject(new Error('AI call failed')),
      Promise.resolve('npc-3'),
    ];
    const { values, rejectedCount } = await settleFulfilled(promises, () => {});
    expect(values).toEqual(['npc-1', 'npc-3']);
    expect(rejectedCount).toBe(1);
  });

  it('reports every rejection when all promises fail', async () => {
    const promises = [Promise.reject(new Error('one')), Promise.reject(new Error('two'))];
    const { values, rejectedCount } = await settleFulfilled(promises, () => {});
    expect(values).toEqual([]);
    expect(rejectedCount).toBe(2);
  });

  it('invokes the onReject callback with each rejection reason', async () => {
    const reasons: unknown[] = [];
    const boom = new Error('boom');
    await settleFulfilled([Promise.resolve('ok'), Promise.reject(boom)], (reason) => reasons.push(reason));
    expect(reasons).toEqual([boom]);
  });

  it('resolves an empty batch with no values and no rejections', async () => {
    const { values, rejectedCount } = await settleFulfilled([], () => {});
    expect(values).toEqual([]);
    expect(rejectedCount).toBe(0);
  });
});
