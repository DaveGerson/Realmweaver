/**
 * SPEC — data/randomTables.ts (§4.9 of the lazy-dm-lens research report;
 * Quick Tables — instant, offline-safe random tables for Quick Tools)
 *
 * Every hand-authored table must honor the same invariant an AI-generated
 * `RollableTable` (`generateRollableTable`) is expected to: its entries'
 * ranges are contiguous and cover the FULL range of its own die, with no
 * gaps and no overlaps. This file pins that invariant, plus the small
 * range-parsing helpers `QuickTablesPanel.tsx` relies on to resolve a roll
 * to a result.
 */

import { describe, it, expect } from 'vitest';
import {
  QUICK_TABLES,
  parseTableRange,
  tableDieSides,
  resolveTableEntry,
} from '../data/randomTables';

describe('the required named tables all exist, with the right die', () => {
  it('includes all five tables named in the design report', () => {
    const byTitle = new Map(QUICK_TABLES.map((t) => [t.title, t]));
    expect(byTitle.get('Tavern Interruption')?.dieType).toBe('d8');
    expect(byTitle.get('The Watch Notices')?.dieType).toBe('d6');
    expect(byTitle.get('A Rumor Making the Rounds')?.dieType).toBe('d10');
    expect(byTitle.get('Complication on the Road')?.dieType).toBe('d8');
    expect(byTitle.get("What's in the Pocket")?.dieType).toBe('d6');
  });

  it('has at least 5 tables and no duplicate titles', () => {
    expect(QUICK_TABLES.length).toBeGreaterThanOrEqual(5);
    const titles = QUICK_TABLES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("every table's ranges are contiguous and cover its full die", () => {
  it.each(QUICK_TABLES.map((t) => [t.title, t] as const))('%s', (_title, table) => {
    const sides = tableDieSides(table);
    expect(sides).toBeGreaterThan(0);

    const covered = new Set<number>();
    for (const entry of table.entries) {
      const range = parseTableRange(entry.range);
      expect(range).not.toBeNull();
      const [low, high] = range as [number, number];
      for (let n = low; n <= high; n++) {
        expect(covered.has(n)).toBe(false); // no overlap between entries
        covered.add(n);
      }
    }
    for (let n = 1; n <= sides; n++) {
      expect(covered.has(n)).toBe(true); // no gap anywhere in 1..sides
    }
    expect(covered.size).toBe(sides); // nothing rolls outside the die's range
  });

  it('gives every entry a non-empty result', () => {
    for (const table of QUICK_TABLES) {
      for (const entry of table.entries) {
        expect(entry.result.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('parseTableRange', () => {
  it('parses a single number as [n, n]', () => {
    expect(parseTableRange('4')).toEqual([4, 4]);
  });

  it('parses a dashed range as [low, high]', () => {
    expect(parseTableRange('2-6')).toEqual([2, 6]);
  });

  it('tolerates surrounding and internal whitespace', () => {
    expect(parseTableRange('  3 - 5 ')).toEqual([3, 5]);
  });

  it('rejects a reversed range', () => {
    expect(parseTableRange('6-2')).toBeNull();
  });

  it('rejects non-numeric or malformed input', () => {
    expect(parseTableRange('abc')).toBeNull();
    expect(parseTableRange('')).toBeNull();
    expect(parseTableRange('1-2-3')).toBeNull();
  });
});

describe('tableDieSides', () => {
  it('parses the side count from dieType, case-insensitively', () => {
    expect(tableDieSides({ title: 't', dieType: 'd8', entries: [] })).toBe(8);
    expect(tableDieSides({ title: 't', dieType: 'D20', entries: [] })).toBe(20);
  });

  it('returns 0 for an unparseable dieType', () => {
    expect(tableDieSides({ title: 't', dieType: 'weird', entries: [] })).toBe(0);
  });
});

describe('resolveTableEntry', () => {
  const table = QUICK_TABLES.find((t) => t.title === 'The Watch Notices')!;

  it('finds the matching entry for every roll on the die', () => {
    for (let roll = 1; roll <= 6; roll++) {
      expect(resolveTableEntry(table, roll)).toBeTruthy();
    }
  });

  it('returns undefined for a roll outside every range', () => {
    expect(resolveTableEntry(table, 0)).toBeUndefined();
    expect(resolveTableEntry(table, 99)).toBeUndefined();
  });
});
