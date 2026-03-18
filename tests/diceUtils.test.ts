import { describe, it, expect, vi } from 'vitest';
import { parseFormula, rollDice, formatFormula } from '../utils/diceUtils';

describe('parseFormula', () => {
    // Basic formulas
    it('parses simple NdX', () => {
        expect(parseFormula('1d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
        expect(parseFormula('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
        expect(parseFormula('4d8')).toEqual({ count: 4, sides: 8, modifier: 0 });
    });

    it('parses NdX with positive modifier', () => {
        expect(parseFormula('2d6+4')).toEqual({ count: 2, sides: 6, modifier: 4 });
        expect(parseFormula('1d20+5')).toEqual({ count: 1, sides: 20, modifier: 5 });
    });

    it('parses NdX with negative modifier', () => {
        expect(parseFormula('1d20-2')).toEqual({ count: 1, sides: 20, modifier: -2 });
        expect(parseFormula('2d6-1')).toEqual({ count: 2, sides: 6, modifier: -1 });
    });

    it('parses keep highest (kh)', () => {
        expect(parseFormula('4d6kh3')).toEqual({ count: 4, sides: 6, keepHighest: 3, modifier: 0 });
        expect(parseFormula('2d20kh1')).toEqual({ count: 2, sides: 20, keepHighest: 1, modifier: 0 });
    });

    it('parses keep lowest (kl)', () => {
        expect(parseFormula('2d20kl1')).toEqual({ count: 2, sides: 20, keepLowest: 1, modifier: 0 });
    });

    it('parses combined keep + modifier', () => {
        expect(parseFormula('4d6kh3+2')).toEqual({ count: 4, sides: 6, keepHighest: 3, modifier: 2 });
        expect(parseFormula('2d20kl1-1')).toEqual({ count: 2, sides: 20, keepLowest: 1, modifier: -1 });
    });

    it('is case-insensitive', () => {
        expect(parseFormula('2D6+4')).toEqual({ count: 2, sides: 6, modifier: 4 });
        expect(parseFormula('4D6KH3')).toEqual({ count: 4, sides: 6, keepHighest: 3, modifier: 0 });
    });

    it('trims whitespace', () => {
        expect(parseFormula('  2d6+4  ')).toEqual({ count: 2, sides: 6, modifier: 4 });
    });

    // Invalid formulas
    it('rejects empty string', () => {
        expect(parseFormula('')).toBeNull();
    });

    it('rejects non-formula text', () => {
        expect(parseFormula('hello')).toBeNull();
        expect(parseFormula('d20')).toBeNull(); // missing count
        expect(parseFormula('20')).toBeNull();
    });

    it('rejects count of 0', () => {
        expect(parseFormula('0d6')).toBeNull();
    });

    it('rejects sides of 0', () => {
        expect(parseFormula('1d0')).toBeNull();
    });

    it('rejects count > 100', () => {
        expect(parseFormula('101d6')).toBeNull();
    });

    it('rejects sides > 1000', () => {
        expect(parseFormula('1d1001')).toBeNull();
    });

    it('rejects keepHighest > count', () => {
        expect(parseFormula('2d6kh3')).toBeNull();
    });

    it('rejects keepLowest > count', () => {
        expect(parseFormula('2d6kl3')).toBeNull();
    });

    it('rejects keepHighest of 0', () => {
        expect(parseFormula('4d6kh0')).toBeNull();
    });

    it('rejects keepLowest of 0', () => {
        expect(parseFormula('4d6kl0')).toBeNull();
    });

    // Edge cases
    it('handles d100', () => {
        expect(parseFormula('1d100')).toEqual({ count: 1, sides: 100, modifier: 0 });
    });

    it('handles large valid values', () => {
        expect(parseFormula('100d1000')).toEqual({ count: 100, sides: 1000, modifier: 0 });
    });

    it('handles modifier of +0', () => {
        expect(parseFormula('1d6+0')).toEqual({ count: 1, sides: 6, modifier: 0 });
    });
});

describe('rollDice', () => {
    it('returns correct number of results', () => {
        const result = rollDice({ count: 4, sides: 6, modifier: 0 });
        expect(result.results).toHaveLength(4);
    });

    it('all results are within valid range', () => {
        // Roll many times to test range
        for (let i = 0; i < 100; i++) {
            const result = rollDice({ count: 1, sides: 6, modifier: 0 });
            expect(result.results[0]).toBeGreaterThanOrEqual(1);
            expect(result.results[0]).toBeLessThanOrEqual(6);
        }
    });

    it('applies positive modifier correctly', () => {
        const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const result = rollDice({ count: 1, sides: 6, modifier: 3 });
        // Math.floor(0.5 * 6) + 1 = 4, + 3 = 7
        expect(result.total).toBe(7);
        mockRandom.mockRestore();
    });

    it('applies negative modifier correctly', () => {
        const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const result = rollDice({ count: 1, sides: 20, modifier: -2 });
        // Math.floor(0.99 * 20) + 1 = 20, - 2 = 18
        expect(result.total).toBe(18);
        mockRandom.mockRestore();
    });

    it('keepHighest keeps only the N highest values', () => {
        // Mock to produce [1, 6, 3, 5]
        const values = [0, 0.99, 0.4, 0.8]; // maps to [1, 6, 3, 5] on d6
        let callIndex = 0;
        const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => values[callIndex++]);

        const result = rollDice({ count: 4, sides: 6, keepHighest: 3, modifier: 0 });
        expect(result.results).toEqual([1, 6, 3, 5]);
        expect(result.keptResults).toEqual([6, 5, 3]); // sorted desc, top 3
        expect(result.total).toBe(14); // 6+5+3
        mockRandom.mockRestore();
    });

    it('keepLowest keeps only the N lowest values', () => {
        const values = [0.99, 0, 0.5, 0.8]; // maps to [6, 1, 4, 5] on d6
        let callIndex = 0;
        const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => values[callIndex++]);

        const result = rollDice({ count: 4, sides: 6, keepLowest: 2, modifier: 0 });
        expect(result.results).toEqual([6, 1, 4, 5]);
        expect(result.keptResults).toEqual([1, 4]); // sorted asc, bottom 2
        expect(result.total).toBe(5); // 1+4
        mockRandom.mockRestore();
    });

    it('advantage (2d20kh1) returns higher of two rolls', () => {
        const values = [0.3, 0.8]; // maps to [7, 17] on d20
        let callIndex = 0;
        const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => values[callIndex++]);

        const result = rollDice({ count: 2, sides: 20, keepHighest: 1, modifier: 0 });
        expect(result.total).toBe(17);
        mockRandom.mockRestore();
    });

    it('disadvantage (2d20kl1) returns lower of two rolls', () => {
        const values = [0.3, 0.8]; // maps to [7, 17] on d20
        let callIndex = 0;
        const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => values[callIndex++]);

        const result = rollDice({ count: 2, sides: 20, keepLowest: 1, modifier: 0 });
        expect(result.total).toBe(7);
        mockRandom.mockRestore();
    });

    it('without keep, keptResults equals results', () => {
        const result = rollDice({ count: 3, sides: 6, modifier: 0 });
        expect(result.keptResults).toEqual(result.results);
    });

    it('handles single die roll correctly', () => {
        const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0); // always returns 1
        const result = rollDice({ count: 1, sides: 20, modifier: 0 });
        expect(result.results).toEqual([1]);
        expect(result.total).toBe(1);
        mockRandom.mockRestore();
    });

    it('total can go negative with modifier', () => {
        const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0); // always returns 1
        const result = rollDice({ count: 1, sides: 4, modifier: -5 });
        expect(result.total).toBe(-4); // 1 + (-5)
        mockRandom.mockRestore();
    });
});

describe('formatFormula', () => {
    it('formats simple NdX', () => {
        expect(formatFormula(2, 6)).toBe('2d6');
        expect(formatFormula(1, 20)).toBe('1d20');
    });

    it('formats with positive modifier', () => {
        expect(formatFormula(2, 6, undefined, undefined, 4)).toBe('2d6+4');
    });

    it('formats with negative modifier', () => {
        expect(formatFormula(1, 20, undefined, undefined, -2)).toBe('1d20-2');
    });

    it('formats keepHighest', () => {
        expect(formatFormula(4, 6, 3)).toBe('4d6kh3');
    });

    it('formats keepLowest', () => {
        expect(formatFormula(2, 20, undefined, 1)).toBe('2d20kl1');
    });

    it('formats combined keep + modifier', () => {
        expect(formatFormula(4, 6, 3, undefined, 2)).toBe('4d6kh3+2');
        expect(formatFormula(2, 20, undefined, 1, -1)).toBe('2d20kl1-1');
    });

    it('ignores zero modifier', () => {
        expect(formatFormula(1, 20, undefined, undefined, 0)).toBe('1d20');
    });
});
