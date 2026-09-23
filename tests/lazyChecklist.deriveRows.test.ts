/**
 * SPEC — deriveLazyChecklistRows (Wave 2, lane 2: SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4.5. File under test:
 * utils/lazyChecklist.ts.
 *
 * THE CONTRACT
 * ------------
 * 1. Exactly eight rows, in Shea's order, "Review the characters" first.
 * 2. Every row's `detail` is a neutral, present-tense sentence — never a
 *    "missing" or warning phrasing, whatever the input looks like.
 * 3. "Relevant monsters" ALWAYS reads "Not tracked here — pick them at the
 *    table." regardless of any other input — it never varies.
 * 4. Only three rows carry a `stepId` (Strong start -> strongStart, Potential
 *    scenes -> beats, Secrets and clues -> secretsCheck); the rest have none.
 * 5. Pure: same input always produces the same output, and nothing here
 *    throws for zeroed-out input.
 */

import { describe, it, expect } from 'vitest';
import { deriveLazyChecklistRows, type DeriveLazyChecklistInput } from '../utils/lazyChecklist';

const EMPTY: DeriveLazyChecklistInput = {
  hasPlayerCharacters: false,
  strongStart: '',
  beatsCount: 0,
  scenesSelectedCount: 0,
  unrevealedSecretsCount: 0,
  locationsCount: 0,
  npcsCount: 0,
  itemsCount: 0,
  sceneRewardsCount: 0,
  lazyStepsAvailable: true,
};

const FILLED: DeriveLazyChecklistInput = {
  hasPlayerCharacters: true,
  strongStart: 'The bell starts ringing by itself.',
  beatsCount: 2,
  scenesSelectedCount: 1,
  unrevealedSecretsCount: 3,
  locationsCount: 2,
  npcsCount: 4,
  itemsCount: 5,
  sceneRewardsCount: 1,
  lazyStepsAvailable: true,
};

const rowById = (rows: ReturnType<typeof deriveLazyChecklistRows>, id: string) => {
  const row = rows.find(r => r.id === id);
  if (!row) throw new Error(`No row with id "${id}"`);
  return row;
};

describe('deriveLazyChecklistRows — shape', () => {
  it('returns exactly eight rows', () => {
    expect(deriveLazyChecklistRows(EMPTY)).toHaveLength(8);
  });

  it('orders Shea\'s steps with "Review the characters" first', () => {
    const rows = deriveLazyChecklistRows(EMPTY);
    expect(rows.map(r => r.label)).toEqual([
      'Review the characters',
      'Strong start',
      'Potential scenes',
      'Secrets and clues',
      'Fantastic locations',
      'Important NPCs',
      'Relevant monsters',
      'Magic item rewards',
    ]);
  });

  it('is pure — the same input always produces the same output', () => {
    expect(deriveLazyChecklistRows(FILLED)).toEqual(deriveLazyChecklistRows({ ...FILLED }));
  });

  it('never throws on zeroed-out input', () => {
    expect(() => deriveLazyChecklistRows(EMPTY)).not.toThrow();
  });
});

describe('deriveLazyChecklistRows — only the steps with a wizard home get a stepId', () => {
  it('gives exactly three rows a stepId', () => {
    const rows = deriveLazyChecklistRows(EMPTY);
    const withStep = rows.filter(r => r.stepId !== undefined);
    expect(withStep.map(r => r.id).sort()).toEqual(['potential-scenes', 'secrets-and-clues', 'strong-start']);
  });

  it('points each at the right wizard step', () => {
    const rows = deriveLazyChecklistRows(EMPTY);
    expect(rowById(rows, 'strong-start').stepId).toBe('strongStart');
    expect(rowById(rows, 'potential-scenes').stepId).toBe('beats');
    expect(rowById(rows, 'secrets-and-clues').stepId).toBe('secretsCheck');
  });

  it('leaves the other five rows with no stepId at all', () => {
    const rows = deriveLazyChecklistRows(EMPTY);
    for (const id of ['review-characters', 'fantastic-locations', 'important-npcs', 'relevant-monsters', 'magic-item-rewards']) {
      expect(rowById(rows, id).stepId).toBeUndefined();
    }
  });
});

describe('deriveLazyChecklistRows — the lazy-only rows have nowhere to jump outside the lazy path', () => {
  it('strips the stepId from all three lazy-only rows when lazyStepsAvailable is false', () => {
    const rows = deriveLazyChecklistRows({ ...FILLED, lazyStepsAvailable: false });
    expect(rowById(rows, 'strong-start').stepId).toBeUndefined();
    expect(rowById(rows, 'potential-scenes').stepId).toBeUndefined();
    expect(rowById(rows, 'secrets-and-clues').stepId).toBeUndefined();
  });

  it('leaves every row\'s detail text unaffected — only the jump target changes', () => {
    const withSteps = deriveLazyChecklistRows(FILLED);
    const withoutSteps = deriveLazyChecklistRows({ ...FILLED, lazyStepsAvailable: false });
    expect(withoutSteps.map(r => r.detail)).toEqual(withSteps.map(r => r.detail));
    expect(withoutSteps.map(r => r.label)).toEqual(withSteps.map(r => r.label));
  });

  it('still gives no stepId to the five rows that never have one, regardless of the flag', () => {
    const rows = deriveLazyChecklistRows({ ...FILLED, lazyStepsAvailable: false });
    for (const id of ['review-characters', 'fantastic-locations', 'important-npcs', 'relevant-monsters', 'magic-item-rewards']) {
      expect(rowById(rows, id).stepId).toBeUndefined();
    }
  });
});

describe('deriveLazyChecklistRows — "Relevant monsters" never varies', () => {
  it('always reads the fixed, honest line, filled or empty input alike', () => {
    const emptyDetail = rowById(deriveLazyChecklistRows(EMPTY), 'relevant-monsters').detail;
    const filledDetail = rowById(deriveLazyChecklistRows(FILLED), 'relevant-monsters').detail;
    expect(emptyDetail).toBe('Not tracked here — pick them at the table.');
    expect(filledDetail).toBe('Not tracked here — pick them at the table.');
  });
});

describe('deriveLazyChecklistRows — every row in its unfilled state', () => {
  it('review the characters: no PCs on file', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'review-characters').detail).toBe('No player characters logged yet.');
  });

  it('strong start: nothing written', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'strong-start').detail).toBe('Not written yet.');
  });

  it('strong start: whitespace-only counts as nothing written', () => {
    const rows = deriveLazyChecklistRows({ ...EMPTY, strongStart: '   \n  ' });
    expect(rowById(rows, 'strong-start').detail).toBe('Not written yet.');
  });

  it('potential scenes: nothing sketched', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'potential-scenes').detail).toBe('Nothing sketched yet.');
  });

  it('secrets and clues: nothing unrevealed', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'secrets-and-clues').detail).toBe('Nothing unrevealed to glance at yet.');
  });

  it('fantastic locations: none gathered', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'fantastic-locations').detail).toBe('None gathered yet.');
  });

  it('important NPCs: none gathered', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'important-npcs').detail).toBe('None gathered yet.');
  });

  it('magic item rewards: nothing flagged', () => {
    expect(rowById(deriveLazyChecklistRows(EMPTY), 'magic-item-rewards').detail).toBe(
      'None flagged yet — Items and scene rewards both work.'
    );
  });

  it('never uses a "missing" word for any row, filled or unfilled', () => {
    for (const input of [EMPTY, FILLED]) {
      for (const row of deriveLazyChecklistRows(input)) {
        expect(row.detail.toLowerCase()).not.toContain('missing');
      }
    }
  });
});

describe('deriveLazyChecklistRows — every row in its filled state', () => {
  it('review the characters: PCs on file', () => {
    expect(rowById(deriveLazyChecklistRows(FILLED), 'review-characters').detail).toBe('Your player characters are on file.');
  });

  it('strong start: written', () => {
    expect(rowById(deriveLazyChecklistRows(FILLED), 'strong-start').detail).toBe('Written.');
  });

  it('potential scenes: reports both beats and selected scenes when both are present', () => {
    const detail = rowById(deriveLazyChecklistRows(FILLED), 'potential-scenes').detail;
    expect(detail).toContain('2 beats');
    expect(detail).toContain('1 scene selected');
  });

  it('potential scenes: singular counts read naturally', () => {
    const rows = deriveLazyChecklistRows({ ...EMPTY, beatsCount: 1, scenesSelectedCount: 0 });
    expect(rowById(rows, 'potential-scenes').detail).toBe('1 beat.');
  });

  it('secrets and clues: counts the unrevealed roster', () => {
    expect(rowById(deriveLazyChecklistRows(FILLED), 'secrets-and-clues').detail).toBe('3 secrets unrevealed, ready to drop in.');
  });

  it('secrets and clues: singular reads naturally', () => {
    const rows = deriveLazyChecklistRows({ ...EMPTY, unrevealedSecretsCount: 1 });
    expect(rowById(rows, 'secrets-and-clues').detail).toBe('1 secret unrevealed, ready to drop in.');
  });

  it('fantastic locations: counts gathered locations', () => {
    expect(rowById(deriveLazyChecklistRows(FILLED), 'fantastic-locations').detail).toBe('2 locations gathered for tonight.');
  });

  it('important NPCs: counts gathered NPCs', () => {
    expect(rowById(deriveLazyChecklistRows(FILLED), 'important-npcs').detail).toBe('4 NPCs gathered for tonight.');
  });

  it('magic item rewards: reports scene rewards and campaign items together', () => {
    const detail = rowById(deriveLazyChecklistRows(FILLED), 'magic-item-rewards').detail;
    expect(detail).toContain('1 scene with rewards written in');
    expect(detail).toContain('5 items in your campaign');
  });

  it('magic item rewards: either half alone still reads cleanly', () => {
    const itemsOnly = deriveLazyChecklistRows({ ...EMPTY, itemsCount: 3 });
    expect(rowById(itemsOnly, 'magic-item-rewards').detail).toBe('3 items in your campaign.');

    const rewardsOnly = deriveLazyChecklistRows({ ...EMPTY, sceneRewardsCount: 2 });
    expect(rowById(rewardsOnly, 'magic-item-rewards').detail).toBe('2 scenes with rewards written in.');
  });
});
